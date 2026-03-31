"""
Validate per-cell measurement with process CPU-time approach.
Cells that do more CPU work must get higher CO2.
"""
import sys, os, tempfile, nbformat
from nbformat.v4 import new_notebook, new_code_cell

nb = new_notebook()
nb.cells = [
    # Fast/trivial cells
    new_code_cell("x = 1"),
    new_code_cell("def square(n): return n*n"),
    new_code_cell("import os"),
    # Medium CPU work
    new_code_cell("r1 = sum(range(1_000_000))"),
    # Heavy CPU work
    new_code_cell("r2 = sum(i*i for i in range(5_000_000))"),
    # Very heavy CPU work
    new_code_cell("r3 = sorted([i % 997 for i in range(3_000_000)])"),
    # I/O wait (low CPU)
    new_code_cell("import time; time.sleep(0.5)"),
    # Trivial print
    new_code_cell("print('done')"),
]

tmp = tempfile.mktemp(suffix=".ipynb")
with open(tmp, "w") as f:
    nbformat.write(nb, f)

class FakeStatic:
    training_cell_indices = [4, 5]
    testing_cell_indices = []
    preprocessing_cell_indices = []

from core.notebook_runner import run_notebook

print("Running per-cell measurement with process CPU-time tracking...")
cells, hw, total_kwh, total_co2 = run_notebook(tmp, FakeStatic(), region="IND", timeout=120)
os.unlink(tmp)

print(f"\nHardware: {hw.cpu_model}")
print(f"Logical cores used for scaling: reported by psutil\n")

print(f"{'Cell':<8} {'Dur(s)':<10} {'kWh':<18} {'CO2(g)':<14} Source")
print("-" * 85)
for c in cells:
    print(f"Cell {c.cell_index+1:<3} {c.duration_seconds:<10.5f} {c.energy_kwh:<18.12f} {c.co2_grams:<14.8f} {repr(c.source_preview[:40])}")

print(f"\nTotal: {total_kwh:.12f} kWh | {total_co2:.8f} gCO2")

# Check that heavier cells have higher emissions
trivial  = cells[0].co2_grams   # x = 1
medium   = cells[3].co2_grams   # sum(range(1M))
heavy    = cells[4].co2_grams   # sum(i*i for 5M)
vheavy   = cells[5].co2_grams   # sorted 3M items
sleep_c  = cells[6].co2_grams   # sleep 0.5s (low cpu)

print("\n--- Results ---")
print(f"  x = 1 (trivial):            {trivial:.10f} gCO2")
print(f"  sum(range(1M)) (medium):    {medium:.10f} gCO2")
print(f"  sum(i*i, 5M) (heavy):       {heavy:.10f} gCO2")
print(f"  sorted(3M) (very heavy):    {vheavy:.10f} gCO2")
print(f"  sleep(0.5s) (low cpu):      {sleep_c:.10f} gCO2")

passed = True
if heavy > trivial:
    print("PASS: heavy CPU > trivial x=1")
else:
    print(f"FAIL: heavy ({heavy:.10f}) should > trivial ({trivial:.10f})")
    passed = False

if medium > trivial:
    print("PASS: medium CPU > trivial")
else:
    print(f"FAIL: medium ({medium:.10f}) should > trivial ({trivial:.10f})")
    passed = False

# Unique values check
values = [c.co2_grams for c in cells if c.source_preview.strip()]
unique = len(set(values))
print(f"\nUnique CO2 values across {len(values)} non-empty cells: {unique}")
if unique >= len(values) // 2:
    print("PASS: Most cells have unique CO2 values (not hardcoded)")
else:
    print("WARN: Many cells share the same CO2 value - may need investigation")

print("\nDone." if passed else "\n[Some assertions FAILED]")
