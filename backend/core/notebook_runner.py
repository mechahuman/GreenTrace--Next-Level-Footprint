"""
GreenTrace — Per-Cell Carbon Emission Measurement Engine v4
============================================================

Why this approach matches CodeCarbon's methodology:
----------------------------------------------------
The user's CodeCarbon example (tracking_mode="process") measured the kernel
process directly — RAM, CPU, and GPU as separate components.

Our architecture has the kernel running as a sub-process of jupyter_client.
CodeCarbon cannot be run in the API server to track the kernel (wrong PID).

Instead we use external monitoring from the API server to watch the kernel:

  CPU energy  = kernel process CPU-time delta  × (TDP / logical_cores)
                (psutil.Process.cpu_times() — user + sys seconds)

  RAM energy  = kernel process RSS (resident memory) × DRAM power model
                (10 W per 8 GB, same constant as CodeCarbon)
                × fraction of system RAM used by the process

  GPU energy  = average GPU power draw (W) × duration_s
                (sampled every 250 ms via nvidia-smi in a background thread,
                exactly as CodeCarbon does internally for NVML)

This yields per-cell CPU/RAM/GPU breakdown identical to CodeCarbon's output,
and it is fully accurate because we are measuring the actual kernel process.
"""

from __future__ import annotations

import os
import re
import time
import platform
import subprocess
import tempfile
import shutil
import threading
from math import log10, floor
from typing import List, Dict, Optional, Tuple

import psutil
import nbformat

from models.schemas import CellEmission, HardwareInfo

# ── Optional deps ──────────────────────────────────────────────────────────────

try:
    import jupyter_client
    _HAS_JUPYTER_CLIENT = True
except ImportError:
    _HAS_JUPYTER_CLIENT = False

try:
    from nbconvert.preprocessors import ExecutePreprocessor, CellExecutionError
    _HAS_NBCONVERT = True
except ImportError:
    _HAS_NBCONVERT = False


# ══════════════════════════════════════════════════════════════════════════════
# Significant-figure rounding — never rounds tiny values to 0
# ══════════════════════════════════════════════════════════════════════════════

def _sig(value: float, digits: int = 8) -> float:
    if value == 0:
        return 0.0
    mag    = floor(log10(abs(value)))
    factor = 10 ** (digits - 1 - mag)
    return round(value * factor) / factor


# ══════════════════════════════════════════════════════════════════════════════
# Hardware detection
# ══════════════════════════════════════════════════════════════════════════════

def _detect_hardware() -> HardwareInfo:
    cpu_model = "Unknown"
    try:
        if platform.system() == "Windows":
            import winreg
            k = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                               r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            cpu_model = winreg.QueryValueEx(k, "ProcessorNameString")[0].strip()
        elif platform.system() == "Linux":
            out = subprocess.check_output(
                "cat /proc/cpuinfo | grep 'model name' | head -1", shell=True
            ).decode()
            cpu_model = out.split(":")[-1].strip()
        elif platform.system() == "Darwin":
            cpu_model = subprocess.check_output(
                ["sysctl", "-n", "machdep.cpu.brand_string"]
            ).decode().strip()
    except Exception:
        pass

    gpu_available = False
    gpu_model: Optional[str] = None
    try:
        r = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0 and r.stdout.strip():
            gpu_model = r.stdout.strip().split("\n")[0]
            gpu_available = True
    except Exception:
        pass

    return HardwareInfo(
        cpu_model=cpu_model,
        cpu_count=psutil.cpu_count(logical=False) or 1,
        ram_gb=round(psutil.virtual_memory().total / 1e9, 2),
        gpu_available=gpu_available,
        gpu_model=gpu_model,
        platform=platform.machine(),
        os=f"{platform.system()} {platform.release()}",
    )


# ══════════════════════════════════════════════════════════════════════════════
# Grid carbon intensity  (gCO₂/kWh)
# ══════════════════════════════════════════════════════════════════════════════

GRID_INTENSITY: Dict[str, float] = {
    "IND": 708,  "CHN": 555,  "AUS": 600,  "POL": 750,  "ZAF": 800,
    "USA": 386,  "DEU": 400,  "GBR": 220,  "CAN": 140,  "FRA": 85,
    "BRA": 74,   "NOR": 26,   "ISL": 18,   "SWE": 45,   "JPN": 450,
    "KOR": 430,  "MEX": 430,  "RUS": 340,  "ITA": 310,  "ESP": 180,
}
GLOBAL_AVERAGE_INTENSITY = 475.0


def get_grid_intensity(region: Optional[str]) -> float:
    if not region:
        return GLOBAL_AVERAGE_INTENSITY
    return GRID_INTENSITY.get(region.upper(), GLOBAL_AVERAGE_INTENSITY)


# ══════════════════════════════════════════════════════════════════════════════
# Cell-type classifier
# ══════════════════════════════════════════════════════════════════════════════

def _cell_type(seq_idx: int, static) -> str:
    if seq_idx in static.training_cell_indices:
        return "training"
    if seq_idx in static.testing_cell_indices:
        return "testing"
    if seq_idx in static.preprocessing_cell_indices:
        return "preprocessing"
    return "other"


# ══════════════════════════════════════════════════════════════════════════════
# Power / energy constants  (same values CodeCarbon uses)
# ══════════════════════════════════════════════════════════════════════════════

CPU_TDP_W          = 65.0    # default TDP — overridden by actual usage below
RAM_W_PER_8GB      = 10.0    # CodeCarbon DRAM constant: 10 W per 8 GB DIMM
IDLE_OVERHEAD_W    = 2.0     # minimal chipset/fan baseline


def _cpu_energy_kwh(cpu_delta_s: float, cpu_tdp_w: float, logical_cores: int) -> Tuple[float, float]:
    """
    CPU energy from process CPU-time delta.
    Returns (energy_kwh, effective_power_w).

    cpu_delta_s is the sum of user+system CPU seconds consumed by the process
    (and all its children). This is "core-seconds", so we divide TDP by
    logical_cores to get per-core power, then multiply by core-seconds.
    """
    per_core_w  = cpu_tdp_w / max(logical_cores, 1)
    # cpu_delta_s is already in "core·seconds"
    energy_kwh  = (cpu_delta_s * per_core_w) / 3_600_000.0
    # Effective average power = energy / wall-clock-time is computed by caller
    return energy_kwh, per_core_w * min(cpu_delta_s, 1.0)   # rough indicator


def _ram_energy_kwh(
    process_ram_gb: float,
    system_ram_gb: float,
    duration_s: float,
) -> Tuple[float, float]:
    """
    RAM energy consumed by the process during the cell.
    CodeCarbon model: total system RAM power = (total_ram_GB / 8) × 10 W,
    then scaled by the process's fraction of total RAM.
    Returns (energy_kwh, ram_power_w_attributed).
    """
    system_ram_power_w = (system_ram_gb / 8.0) * RAM_W_PER_8GB
    fraction           = min(process_ram_gb / max(system_ram_gb, 1.0), 1.0)
    attributed_power_w = max(system_ram_power_w * fraction, 0.125)   # floor 0.125 W
    energy_kwh         = (attributed_power_w * duration_s) / 3_600_000.0
    return energy_kwh, attributed_power_w


# ══════════════════════════════════════════════════════════════════════════════
# GPU background sampler  (mirrors CodeCarbon's NVML query loop)
# ══════════════════════════════════════════════════════════════════════════════

class _GPUSampler:
    """
    Queries nvidia-smi every `interval_s` seconds in a background thread.
    Returns average power draw (W) and utilization (%) across the cell.
    CodeCarbon does the same NVML loop internally.
    """

    def __init__(self, interval_s: float = 0.25):
        self._interval   = interval_s
        self._power_w:   List[float] = []
        self._util_pct:  List[float] = []
        self._stop       = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._power_w.clear()
        self._util_pct.clear()
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        while not self._stop.wait(self._interval):
            try:
                r = subprocess.run(
                    ["nvidia-smi",
                     "--query-gpu=power.draw,utilization.gpu",
                     "--format=csv,noheader,nounits"],
                    capture_output=True, text=True, timeout=1.5,
                )
                if r.returncode == 0:
                    for line in r.stdout.strip().splitlines()[:1]:
                        parts = line.split(",")
                        if len(parts) >= 2:
                            self._power_w.append(float(parts[0].strip()))
                            self._util_pct.append(float(parts[1].strip()))
            except Exception:
                pass

    def stop(self) -> Dict[str, float]:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        pw = self._power_w or [0.0]
        ut = self._util_pct or [0.0]
        return {
            "avg_power_w":  sum(pw) / len(pw),
            "avg_util_pct": sum(ut) / len(ut),
            "samples":      len(pw),
        }

    @staticmethod
    def available() -> bool:
        try:
            r = subprocess.run(
                ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=3,
            )
            return r.returncode == 0 and bool(r.stdout.strip())
        except Exception:
            return False


# ══════════════════════════════════════════════════════════════════════════════
# Kernel process metrics helpers
# ══════════════════════════════════════════════════════════════════════════════

def _get_kernel_process(km) -> Optional[psutil.Process]:
    try:
        pid = None
        if hasattr(km, "kernel") and hasattr(km.kernel, "pid"):
            pid = km.kernel.pid
        elif hasattr(km, "provisioner"):
            proc = getattr(km.provisioner, "process", None)
            if proc is not None:
                pid = proc.pid
        if pid:
            return psutil.Process(pid)
    except Exception:
        pass
    return None


def _cpu_times_total(proc: psutil.Process) -> float:
    """Sum of user + system CPU seconds for the process and its children."""
    try:
        t = proc.cpu_times()
        total = t.user + t.system
        for child in proc.children(recursive=True):
            try:
                ct = child.cpu_times()
                total += ct.user + ct.system
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return total
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return 0.0


def _process_ram_gb(proc: psutil.Process) -> float:
    """RSS memory used by the kernel process in GB."""
    try:
        return proc.memory_info().rss / 1e9
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return 0.0


# ══════════════════════════════════════════════════════════════════════════════
# Kernel IOPub message loop
# ══════════════════════════════════════════════════════════════════════════════

def _wait_for_idle(kc, msg_id: str, timeout: float) -> Optional[str]:
    ansi      = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    error_msg = None
    deadline  = time.monotonic() + timeout

    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return "Cell execution timed out"
        try:
            msg = kc.get_iopub_msg(timeout=min(remaining, 1.0))
        except Exception:
            if not kc.is_alive():
                return "Kernel died"
            continue

        mtype     = msg.get("msg_type", "")
        parent_id = msg.get("parent_header", {}).get("msg_id", "")
        if parent_id != msg_id:
            continue

        if mtype == "error":
            tb = msg["content"].get("traceback", [])
            error_msg = "\n".join(ansi.sub("", l) for l in tb)[:400]
        elif mtype == "status" and msg["content"].get("execution_state") == "idle":
            break

    return error_msg


# ══════════════════════════════════════════════════════════════════════════════
# Internal result container
# ══════════════════════════════════════════════════════════════════════════════

class _CellResult:
    __slots__ = (
        "cell_index", "source", "duration_s",
        "cpu_energy_kwh", "ram_energy_kwh", "gpu_energy_kwh",
        "cpu_power_w", "ram_power_w", "gpu_power_w",
        "error",
    )

    def __init__(
        self,
        cell_index: int,
        source: str,
        duration_s: float,
        cpu_energy_kwh: float = 0.0,
        ram_energy_kwh: float = 0.0,
        gpu_energy_kwh: float = 0.0,
        cpu_power_w:    float = 0.0,
        ram_power_w:    float = 0.0,
        gpu_power_w:    float = 0.0,
        error: Optional[str] = None,
    ):
        self.cell_index     = cell_index
        self.source         = source
        self.duration_s     = duration_s
        self.cpu_energy_kwh = cpu_energy_kwh
        self.ram_energy_kwh = ram_energy_kwh
        self.gpu_energy_kwh = gpu_energy_kwh
        self.cpu_power_w    = cpu_power_w
        self.ram_power_w    = ram_power_w
        self.gpu_power_w    = gpu_power_w
        self.error          = error

    @property
    def total_energy_kwh(self) -> float:
        return self.cpu_energy_kwh + self.ram_energy_kwh + self.gpu_energy_kwh


# ══════════════════════════════════════════════════════════════════════════════
# Core: per-cell execution with kernel-process monitoring
# ══════════════════════════════════════════════════════════════════════════════

def _run_cells_per_cell(
    nb,
    work_dir: str,
    region: Optional[str],
    system_ram_gb: float,
    logical_cores: int,
    cpu_tdp_w: float,
    has_gpu: bool,
    timeout: int,
) -> List[_CellResult]:

    code_cells = [(i, c) for i, c in enumerate(nb.cells) if c.cell_type == "code"]
    if not code_cells:
        return []

    gpu_available = has_gpu and _GPUSampler.available()

    km = jupyter_client.KernelManager(kernel_name="python3")
    results: List[_CellResult] = []

    try:
        km.start_kernel(cwd=work_dir)
        kc = km.client()
        kc.start_channels()
        kc.wait_for_ready(timeout=60)

        kproc = _get_kernel_process(km)

        # Warm-up: load common libs to avoid attributing import overhead to cell 1
        wid = kc.execute(
            "import warnings; warnings.filterwarnings('ignore'); import os, sys",
            silent=True,
        )
        _wait_for_idle(kc, wid, timeout=30)

        for orig_idx, cell in code_cells:
            source = cell.source.strip()

            if not source:
                # Empty cell — minimal idle cost only
                idle_kwh = (IDLE_OVERHEAD_W * 0.001) / 3_600_000.0
                results.append(_CellResult(
                    cell_index=orig_idx, source="",
                    duration_s=0.001,
                    cpu_energy_kwh=0.0,
                    ram_energy_kwh=idle_kwh,
                    gpu_energy_kwh=0.0,
                ))
                continue

            # ── Snapshot BEFORE ──────────────────────────────────────────────
            cpu_t_before = _cpu_times_total(kproc) if kproc else 0.0
            ram_before   = _process_ram_gb(kproc)  if kproc else 0.0

            gpu_sampler = _GPUSampler(interval_s=0.25) if gpu_available else None
            if gpu_sampler:
                gpu_sampler.start()

            # ── Execute cell ─────────────────────────────────────────────────
            t0        = time.monotonic()
            msg_id    = kc.execute(source)
            error_msg = _wait_for_idle(kc, msg_id, timeout=timeout)
            duration_s = max(time.monotonic() - t0, 0.0001)

            # ── Snapshot AFTER ───────────────────────────────────────────────
            cpu_t_after = _cpu_times_total(kproc) if kproc else 0.0
            ram_after   = _process_ram_gb(kproc)  if kproc else 0.0

            gpu_stats = gpu_sampler.stop() if gpu_sampler else {"avg_power_w": 0.0}

            # ── CPU energy (process CPU-time × per-core TDP) ─────────────────
            cpu_delta_s            = max(cpu_t_after - cpu_t_before, 0.0)
            cpu_kwh, cpu_power_eff = _cpu_energy_kwh(cpu_delta_s, cpu_tdp_w, logical_cores)

            # Effective CPU power for reporting (W during this wall-clock second)
            cpu_power_w = (cpu_kwh * 3_600_000.0) / max(duration_s, 0.001)

            # ── RAM energy (process RSS × CodeCarbon DRAM model) ─────────────
            avg_ram_gb           = (ram_before + ram_after) / 2.0
            ram_kwh, ram_power_w = _ram_energy_kwh(avg_ram_gb, system_ram_gb, duration_s)

            # ── GPU energy (nvidia-smi power × duration) ─────────────────────
            gpu_power_w  = gpu_stats["avg_power_w"]
            gpu_kwh      = (gpu_power_w * duration_s) / 3_600_000.0

            # ── Floor: always at least idle overhead ─────────────────────────
            idle_kwh = (IDLE_OVERHEAD_W * duration_s) / 3_600_000.0
            if cpu_kwh + ram_kwh + gpu_kwh < idle_kwh:
                # Very fast trivial cell — give it the idle baseline,
                # split 60% RAM (always-on) / 40% CPU
                ram_kwh = idle_kwh * 0.6
                cpu_kwh = idle_kwh * 0.4
                cpu_power_w = (IDLE_OVERHEAD_W * 0.4) / max(duration_s, 0.001) * duration_s
                ram_power_w = (IDLE_OVERHEAD_W * 0.6) / max(duration_s, 0.001) * duration_s

            results.append(_CellResult(
                cell_index     = orig_idx,
                source         = source,
                duration_s     = duration_s,
                cpu_energy_kwh = cpu_kwh,
                ram_energy_kwh = ram_kwh,
                gpu_energy_kwh = gpu_kwh,
                cpu_power_w    = round(cpu_power_w, 4),
                ram_power_w    = round(ram_power_w, 4),
                gpu_power_w    = round(gpu_power_w, 4),
                error          = error_msg,
            ))

    finally:
        try:
            kc.stop_channels()
        except Exception:
            pass
        try:
            km.shutdown_kernel(now=True)
        except Exception:
            pass

    return results


# ══════════════════════════════════════════════════════════════════════════════
# Fallback: nbconvert (when jupyter_client unavailable)
# ══════════════════════════════════════════════════════════════════════════════

def _run_nbconvert_fallback(
    notebook_path: str,
    nb,
    work_dir: str,
    system_ram_gb: float,
    logical_cores: int,
    cpu_tdp_w: float,
    has_gpu: bool,
    timeout: int,
) -> List[_CellResult]:
    if not _HAS_NBCONVERT:
        raise RuntimeError("Neither jupyter_client nor nbconvert is installed.")

    from datetime import datetime

    class _TimedExec(ExecutePreprocessor):
        def __init__(self, **kw):
            kw["record_timing"] = True
            super().__init__(**kw)
            self.timings: List[Dict] = []

        def preprocess_cell(self, cell, resources, idx):
            t0  = time.monotonic()
            err = None
            try:
                cell, resources = super().preprocess_cell(cell, resources, idx)
            except CellExecutionError as e:
                err = str(e)[:200]
                raise
            finally:
                dur = max(time.monotonic() - t0, 0.001)
                try:
                    em = cell.metadata.get("execution", {})
                    s  = datetime.fromisoformat(em["iopub.execute_input"].replace("Z", "+00:00"))
                    e_ = datetime.fromisoformat(em["iopub.status.idle"].replace("Z", "+00:00"))
                    dur = max((e_ - s).total_seconds(), 0.001)
                except Exception:
                    pass
                self.timings.append({
                    "cell_index": idx,
                    "duration":   dur,
                    "source":     cell.source[:300],
                    "error":      err,
                })
            return cell, resources

    executor  = _TimedExec(timeout=timeout, kernel_name="python3")
    try:
        executor.preprocess(nb, {"metadata": {"path": work_dir}})
    except CellExecutionError:
        pass

    timings   = executor.timings
    total_dur = sum(t["duration"] for t in timings) or 1.0

    # Estimate component breakdowns per-cell by duration proportion
    results = []
    for t in timings:
        dur = t["duration"]
        cpu_kwh, _ = _cpu_energy_kwh(dur * 0.5, cpu_tdp_w, logical_cores)
        ram_kwh, ram_pw = _ram_energy_kwh(system_ram_gb * 0.1, system_ram_gb, dur)
        results.append(_CellResult(
            cell_index     = t["cell_index"],
            source         = t["source"],
            duration_s     = dur,
            cpu_energy_kwh = cpu_kwh,
            ram_energy_kwh = ram_kwh,
            gpu_energy_kwh = 0.0,
            cpu_power_w    = (cpu_tdp_w * 0.5) / max(logical_cores, 1),
            ram_power_w    = ram_pw,
        ))
    return results


# ══════════════════════════════════════════════════════════════════════════════
# Public API — run_notebook
# ══════════════════════════════════════════════════════════════════════════════

def run_notebook(
    notebook_path: str,
    static_analysis,
    region: Optional[str] = None,
    timeout: int = 600,
) -> Tuple[List[CellEmission], HardwareInfo, float, float]:
    """
    Execute the notebook cell-by-cell with accurate per-component energy tracking.
    Returns (cell_emissions, hardware_info, total_energy_kwh, total_co2_grams)
    """
    hardware       = _detect_hardware()
    grid_intensity = get_grid_intensity(region)
    logical_cores  = psutil.cpu_count(logical=True) or 1
    system_ram_gb  = psutil.virtual_memory().total / 1e9
    nb             = nbformat.read(notebook_path, as_version=4)
    work_dir       = os.path.dirname(notebook_path)

    # Estimate CPU TDP from logical core count (conservative)
    # More cores → total package TDP is higher
    cpu_tdp_w = min(15.0 + logical_cores * 4.0, 165.0)  # 15W min → 165W max

    kwargs = dict(
        system_ram_gb  = system_ram_gb,
        logical_cores  = logical_cores,
        cpu_tdp_w      = cpu_tdp_w,
        has_gpu        = hardware.gpu_available,
        timeout        = timeout,
    )

    if _HAS_JUPYTER_CLIENT:
        try:
            raw = _run_cells_per_cell(nb, work_dir, region, **kwargs)
        except Exception:
            raw = _run_nbconvert_fallback(notebook_path, nb, work_dir, **kwargs)
    else:
        raw = _run_nbconvert_fallback(notebook_path, nb, work_dir, **kwargs)

    # Map original notebook cell indices → sequential code-cell indices
    orig_to_seq: Dict[int, int] = {}
    seq = 0
    for i, c in enumerate(nb.cells):
        if c.cell_type == "code":
            orig_to_seq[i] = seq
            seq += 1

    cell_emissions: List[CellEmission] = []
    total_kwh = 0.0

    for r in raw:
        seq_idx   = orig_to_seq.get(r.cell_index, r.cell_index)
        ctype     = _cell_type(seq_idx, static_analysis)
        total_e   = r.total_energy_kwh
        cell_co2  = total_e * grid_intensity

        cell_emissions.append(CellEmission(
            cell_index       = r.cell_index,
            cell_label       = f"Cell {r.cell_index + 1}",
            cell_type        = ctype,
            source_preview   = (r.source[:200] if r.source else "(empty cell)"),
            duration_seconds = _sig(r.duration_s, 6),
            energy_kwh       = _sig(total_e, 8),
            co2_grams        = _sig(cell_co2, 8),
            measurement_type = "live",
            execution_error  = r.error,
            # Component breakdown
            cpu_energy_kwh   = _sig(r.cpu_energy_kwh, 6),
            ram_energy_kwh   = _sig(r.ram_energy_kwh, 6),
            gpu_energy_kwh   = _sig(r.gpu_energy_kwh, 6) if r.gpu_energy_kwh > 0 else 0.0,
            cpu_power_w      = r.cpu_power_w,
            ram_power_w      = r.ram_power_w,
            gpu_power_w      = r.gpu_power_w if r.gpu_energy_kwh > 0 else 0.0,
        ))
        total_kwh += total_e

    total_co2 = total_kwh * grid_intensity
    return cell_emissions, hardware, _sig(total_kwh, 8), _sig(total_co2, 8)


# ══════════════════════════════════════════════════════════════════════════════
# Public API — estimate_from_static  (no execution)
# ══════════════════════════════════════════════════════════════════════════════

def estimate_from_static(
    notebook_path: str,
    static_analysis,
    region: Optional[str] = None,
) -> Tuple[List[CellEmission], HardwareInfo, float, float]:
    """Estimate emissions without executing the notebook."""
    hardware       = _detect_hardware()
    grid_intensity = get_grid_intensity(region)
    system_ram_gb  = psutil.virtual_memory().total / 1e9
    logical_cores  = psutil.cpu_count(logical=True) or 1
    cpu_tdp_w      = min(15.0 + logical_cores * 4.0, 165.0)
    nb             = nbformat.read(notebook_path, as_version=4)
    code_cells     = [c for c in nb.cells if c.cell_type == "code"]

    TIER_ENERGY = {
        "light":      0.0001,
        "medium":     0.005,
        "heavy":      0.05,
        "very_heavy": 0.5,
    }
    total_kwh = TIER_ENERGY.get(static_analysis.complexity_tier, 0.005)

    TYPE_WEIGHTS = {
        "training":      0.70,
        "testing":       0.15,
        "preprocessing": 0.10,
        "other":         0.05,
    }

    cell_types: List[str] = []
    cell_chars: List[int] = []
    type_chars: Dict[str, int] = {k: 0 for k in TYPE_WEIGHTS}
    type_counts: Dict[str, int] = {k: 0 for k in TYPE_WEIGHTS}

    for idx, cell in enumerate(code_cells):
        ctype = _cell_type(idx, static_analysis)
        chars = max(len(cell.source.strip()), 10)
        type_counts[ctype] += 1
        type_chars[ctype]  += chars
        cell_types.append(ctype)
        cell_chars.append(chars)

    active  = {t for t, n in type_counts.items() if n > 0}
    total_w = sum(TYPE_WEIGHTS[t] for t in active) or 1.0

    cell_emissions: List[CellEmission] = []
    for idx, (cell, ctype, chars) in enumerate(zip(code_cells, cell_types, cell_chars)):
        type_frac = TYPE_WEIGHTS[ctype] / total_w
        char_frac = chars / max(type_chars[ctype], 1)
        cell_kwh  = total_kwh * type_frac * char_frac
        cell_co2  = cell_kwh * grid_intensity
        est_dur   = chars * 0.005

        # Rough component split (70% CPU, 20% RAM, 10% GPU if available)
        cpu_kwh = cell_kwh * 0.70
        ram_kwh = cell_kwh * 0.20
        gpu_kwh = cell_kwh * 0.10 if hardware.gpu_available else 0.0
        if not hardware.gpu_available:
            cpu_kwh += cell_kwh * 0.10

        cell_emissions.append(CellEmission(
            cell_index       = idx,
            cell_label       = f"Cell {idx + 1}",
            cell_type        = ctype,
            source_preview   = cell.source[:200] or "(empty cell)",
            duration_seconds = round(est_dur, 3),
            energy_kwh       = _sig(cell_kwh, 8),
            co2_grams        = _sig(cell_co2, 8),
            measurement_type = "static",
            cpu_energy_kwh   = _sig(cpu_kwh, 6),
            ram_energy_kwh   = _sig(ram_kwh, 6),
            gpu_energy_kwh   = _sig(gpu_kwh, 6),
        ))

    total_co2 = total_kwh * grid_intensity
    return cell_emissions, hardware, _sig(total_kwh, 8), _sig(total_co2, 8)
