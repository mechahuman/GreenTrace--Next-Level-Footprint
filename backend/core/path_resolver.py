"""
GreenTrace — Dataset Path Resolver
====================================
Before executing a notebook, this module:
  1. Scans every code cell for ALL file-read patterns (pandas, numpy, open, etc.)
  2. Collects every literal path the notebook references
  3. Looks up each uploaded dataset file by its basename
  4. Copies that file to EVERY expected path in the temp working directory

This means: if the notebook says pd.read_csv('data/input/train.csv') and the user
uploads a file called 'train.csv', this resolver will create data/input/train.csv
inside the temp dir automatically — so execution succeeds regardless of hardcoded
paths (Kaggle paths, relative paths, nested folders, etc.)

Pre-requisite contract (user-facing):
  The notebook must be working correctly on the user's machine before analysis.
  GreenTrace measures the carbon of a *successful* execution.
"""

from __future__ import annotations

import os
import re
import shutil
import logging
from typing import List, Dict, Set

log = logging.getLogger(__name__)


# ── Regex patterns that capture literal file paths ─────────────────────────────
# Each captures group 1 = the path string (single or double quoted).

_FILE_PATTERNS: List[str] = [
    # pandas  ──────────────────────────────────────────────────────────────────
    r'(?:read_csv|read_excel|read_json|read_parquet|read_feather|read_table|read_pickle|read_hdf|read_stata|read_sas|read_spss|read_orc|read_xml)\s*\(\s*["\']([^"\']+)["\']',
    # numpy  ───────────────────────────────────────────────────────────────────
    r'\bnp\.(?:load|loadtxt|genfromtxt|fromfile)\s*\(\s*["\']([^"\']+)["\']',
    # built-in open  ───────────────────────────────────────────────────────────
    r'\bopen\s*\(\s*["\']([^"\']+)["\']',
    # Pathlib  ─────────────────────────────────────────────────────────────────
    r'\bPath\s*\(\s*["\']([^"\']+)["\']',
    # PyTorch  ─────────────────────────────────────────────────────────────────
    r'\btorch\.load\s*\(\s*["\']([^"\']+)["\']',
    # joblib  ──────────────────────────────────────────────────────────────────
    r'\bjoblib\.load\s*\(\s*["\']([^"\']+)["\']',
    # PIL / scikit-image / imageio  ────────────────────────────────────────────
    r'\bImage\.open\s*\(\s*["\']([^"\']+)["\']',
    r'\bimageio\.(?:imread|read)\s*\(\s*["\']([^"\']+)["\']',
    # OpenCV  ──────────────────────────────────────────────────────────────────
    r'\bcv2\.(?:imread|VideoCapture)\s*\(\s*["\']([^"\']+)["\']',
    # os.listdir / os.walk / os.scandir  ──────────────────────────────────────
    r'\bos\.(?:listdir|scandir|walk)\s*\(\s*["\']([^"\']+)["\']',
    # glob  ────────────────────────────────────────────────────────────────────
    r'\bglob\.glob\s*\(\s*["\']([^"\']+)["\']',
    r'\bpathlib\.Path\s*\(\s*["\']([^"\']+)["\']',
    # tf/keras  ────────────────────────────────────────────────────────────────
    r'\btf\.(?:io\.read_file|keras\.utils\.get_file)\s*\(\s*["\']([^"\']+)["\']',
    r'\bkeras\.utils\.get_file\s*\(\s*["\']([^"\']+)["\'][^,]*,\s*["\']([^"\']+)["\']',
    # dataset_path = '...'  (common variable assignment)  ─────────────────────
    r'''(?:data(?:set)?_?(?:path|dir|folder|file|root)|file_?path|csv_?path|train_?(?:path|file)|test_?(?:path|file)|val_?(?:path|file)|img_?(?:path|dir)|input_?(?:path|dir))\s*=\s*["\']([^"\']+)["\']''',
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in _FILE_PATTERNS]


def _extract_notebook_file_refs(nb) -> Set[str]:
    """Return every literal path found in code cells."""
    found: Set[str] = set()
    for cell in nb.cells:
        if cell.cell_type != "code":
            continue
        src = cell.source
        for pat in _COMPILED:
            for m in pat.finditer(src):
                for g in m.groups():
                    if g:
                        found.add(g)

    # Filter out obvious non-paths
    result: Set[str] = set()
    for ref in found:
        ref = ref.strip()
        if not ref or len(ref) < 2:
            continue
        # Skip URLs
        if re.match(r'^https?://', ref) or re.match(r'^s3://', ref):
            continue
        # Skip pure variable placeholders  {var}
        if '{' in ref:
            continue
        # Skip things that look like format strings / wildcards only
        if ref in ('*', '**', '.', '..'):
            continue
        result.add(ref)

    return result


def _build_basename_index(tmp_dir: str) -> Dict[str, List[str]]:
    """
    Walk tmp_dir and build a map:  basename_lower -> [absolute_path, ...]
    This lets us find any uploaded file regardless of where it landed.
    """
    index: Dict[str, List[str]] = {}
    for root, _dirs, files in os.walk(tmp_dir):
        for fname in files:
            key = fname.lower()
            abs_path = os.path.join(root, fname)
            index.setdefault(key, []).append(abs_path)
    return index


def prepare_execution_env(tmp_dir: str, nb) -> List[str]:
    """
    Main entry point.  Call this after saving the notebook and dataset files to
    tmp_dir, before launching the Jupyter kernel.

    Returns a list of human-readable log lines describing what was resolved.
    """
    refs = _extract_notebook_file_refs(nb)
    if not refs:
        return []

    index = _build_basename_index(tmp_dir)
    log_lines: List[str] = []

    for ref in sorted(refs):
        target = os.path.join(tmp_dir, ref)

        # Already exists — nothing to do
        if os.path.exists(target):
            log_lines.append(f"[ok]      {ref}")
            continue

        # Try to match by basename
        ref_basename = os.path.basename(ref).lower()
        candidates = index.get(ref_basename, [])

        if not candidates:
            log_lines.append(f"[missing] {ref}  (no uploaded file with this name)")
            continue

        # Pick the first match (there should normally only be one)
        src_path = candidates[0]

        # Create directory structure and copy
        target_dir = os.path.dirname(target)
        try:
            os.makedirs(target_dir, exist_ok=True)
            shutil.copy2(src_path, target)
            log_lines.append(f"[mapped]  {os.path.basename(src_path)} → {ref}")
        except Exception as e:
            log_lines.append(f"[error]   could not map {ref}: {e}")

    return log_lines
