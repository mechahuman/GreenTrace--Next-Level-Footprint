import tempfile
import os
import nbformat
import shutil
import sys

sys.path.append(r'c:\COLLEGE\Third Year\CC\Innovative\backend')
from core.path_resolver import prepare_execution_env

with tempfile.TemporaryDirectory() as tmp_dir:
    # mock notebook upload
    nb_src = r'c:\COLLEGE\Third Year\CC\Innovative\testing\Real Estate Investment Advisor.ipynb'
    nb_dest = os.path.join(tmp_dir, 'Real Estate Investment Advisor.ipynb')
    shutil.copy(nb_src, nb_dest)

    # mock dataset upload (using basename)
    data_dest = os.path.join(tmp_dir, 'india_housing_prices.csv')
    with open(data_dest, 'w') as f:
        f.write('dummy,data\n1,2\n')
    
    nb = nbformat.read(nb_dest, as_version=4)
    logs = prepare_execution_env(tmp_dir, nb)
    print(f"PATH RESOLVER LOGS:")
    for log in logs:
        print("  - " + log)

    print('\nContents of tmp_dir:', os.listdir(tmp_dir))
