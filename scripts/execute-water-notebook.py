"""Execute this project's plain Python notebook cells in a fresh process.

Uses the standard library: no bundled archives, hidden shell setup or Jupyter
dependency. This is sequential Python execution, not a Jupyter kernel run.
"""
import contextlib
import io
import json
import sys
import time
from pathlib import Path

path = Path(sys.argv[1]).resolve()
notebook = json.loads(path.read_text())
namespace = {'__name__': '__main__'}
count = 0
started = time.perf_counter()
for cell in notebook['cells']:
    if cell['cell_type'] != 'code':
        continue
    count += 1
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        exec(compile(''.join(cell['source']), f'{path.name}:cell{count}', 'exec'), namespace)
    cell['execution_count'] = count
    cell['outputs'] = [{'output_type': 'stream', 'name': 'stdout', 'text': output.getvalue().splitlines(True)}] if output.getvalue() else []
notebook['metadata']['execution'] = {'method': 'sequential Python cells in a fresh interpreter; shared Node engine', 'code_cells': count, 'duration_seconds': round(time.perf_counter() - started, 3), 'jupyter_kernel': False}
path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + '\n')
print(f'{count} code cells executed successfully: {path.name}')
