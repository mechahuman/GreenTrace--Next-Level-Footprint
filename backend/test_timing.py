import nbformat
from nbconvert.preprocessors import ExecutePreprocessor
import json

nb_node = nbformat.from_dict({
    "cells": [
        {"cell_type": "code", "execution_count": None, "metadata": {}, "source": "import time; time.sleep(0.5)", "outputs": []},
        {"cell_type": "code", "execution_count": None, "metadata": {}, "source": "x = 10", "outputs": []}
    ],
    "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}},
    "nbformat": 4,
    "nbformat_minor": 4,
})

ep = ExecutePreprocessor(timeout=60, kernel_name='python3')
ep.preprocess(nb_node, {'metadata': {'path': '.'}})

for i, cell in enumerate(nb_node.cells):
    print(f"Cell {i} metadata:", cell.metadata)
