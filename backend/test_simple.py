"""
Focused output test - print only what matters.
"""
import sys, os, tempfile, nbformat
from nbformat.v4 import new_notebook, new_code_cell

nb = new_notebook()
nb.cells = [
    new_code_cell("x = 1"),
    new_code_cell("def square(n): return n*n"),
    new_code_cell("r1 = sum(range(1_000_000))"),
    new_code_cell("r2 = sum(i*i for i in range(5_000_000))"),
    new_code_cell("r3 = sorted([i%997 for i in range(3_000_000)])"),
    new_code_cell("import time; time.sleep(0.5)"),
    new_code_cell("print('done')"),
]
tmp = tempfile.mktemp(suffix=".ipynb")
with open(tmp, "w") as f:
    nbformat.write(nb, f)

class FakeStatic:
    training_cell_indices = [3, 4]
    testing_cell_indices = []
    preprocessing_cell_indices = []

from core.notebook_runner import run_notebook
cells, hw, kwh, co2 = run_notebook(tmp, FakeStatic(), region="IND", timeout=120)
os.unlink(tmp)

with open("results.txt", "w") as f:
    f.write(f"Total: {kwh} kWh | {co2} gCO2\n\n")
    for c in cells:
        f.write(f"Cell{c.cell_index+1}: dur={c.duration_seconds}s  kwh={c.energy_kwh}  co2={c.co2_grams}  src={c.source_preview[:50]!r}\n")

print("Results written to results.txt")
