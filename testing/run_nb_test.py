import nbformat
import sys
import os

sys.path.append(r'c:\COLLEGE\Third Year\CC\Innovative\backend')
from core.notebook_runner import _run_cells_per_cell

nb_path = r'c:\COLLEGE\Third Year\CC\Innovative\testing\Real Estate Investment Advisor.ipynb'
work_dir = r'c:\COLLEGE\Third Year\CC\Innovative\testing'
with open(nb_path, encoding='utf-8') as f:
    nb = nbformat.read(f, as_version=4)

res = _run_cells_per_cell(
    nb=nb, work_dir=work_dir, region='IND',
    system_ram_gb=16.0, logical_cores=8, cpu_tdp_w=65.0, has_gpu=False, timeout=120
)

import collections
errors = collections.defaultdict(int)
for r in res:
    if r.error is not None:
        try:
            etype = r.error.strip().split('\n')[-1].split(':')[0]
            errors[etype] += 1
        except:
            pass

print('Error Summary:')
for k, v in errors.items():
    print(f'  {k}: {v}')

print('\nFirst few errors:')
count = 0
for r in res:
    if r.error is not None:
        last_line = r.error.strip().split('\n')[-1]
        print(f'Cell {r.cell_index}: {last_line}')
        count += 1
        if count >= 10: break
