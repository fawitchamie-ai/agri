#!/usr/bin/env bash
set -euo pipefail

# Test-only render of the public landing page. No account, real parcel,
# cloud secret, production endpoint, or production database is used.
visual_tmp="${RUNNER_TEMP:-/tmp}/agri-visual-review"
mkdir -p "$visual_tmp"
pnpm build >"$visual_tmp/build.log" 2>&1 || { tail -100 "$visual_tmp/build.log"; exit 1; }
# The production build includes the pre-rendered welcome page. Remove scripts
# to inspect the static first paint without any API calls or workspace data.
"${VISUAL_PYTHON:-python3}" - <<'PY'
import pathlib, re
root = pathlib.Path('dist/client')
html = (root / '_shell/index.html').read_text(encoding='utf-8')
html = re.sub(r'<script\b[^>]*>.*?</script\s*>', '', html, flags=re.I | re.S)
(root / 'index.html').write_text(html, encoding='utf-8')
PY
"${VISUAL_PYTHON:-python3}" -m http.server 5173 --bind 127.0.0.1 --directory dist/client >"$visual_tmp/server.log" 2>&1 &
visual_server=$!
trap 'kill "$visual_server" 2>/dev/null || true' EXIT
for attempt in $(seq 1 40); do
  if curl --silent --fail --max-time 3 http://127.0.0.1:5173/ -o /dev/null; then break; fi
  if ! kill -0 "$visual_server" 2>/dev/null; then cat "$visual_tmp/server.log"; exit 1; fi
  sleep 1
done
curl --silent --fail --max-time 5 http://127.0.0.1:5173/ -o /dev/null || { cat "$visual_tmp/server.log"; exit 1; }
visual_browser="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
for viewport in desktop mobile; do
  if [[ "$viewport" == desktop ]]; then visual_size='1365,1000'; else visual_size='390,844'; fi
  timeout 50 "$visual_browser" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --no-proxy-server \
    --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=15000 \
    --window-size="$visual_size" --screenshot="$visual_tmp/$viewport.png" http://127.0.0.1:5173/ 2>"$visual_tmp/$viewport-browser.log"
done
"${VISUAL_PYTHON:-python3}" - "$visual_tmp" <<'PY'
import base64
import pathlib
import sys
from PIL import Image

root = pathlib.Path(sys.argv[1])
for name in ('desktop', 'mobile'):
    source = root / f'{name}.png'
    if not source.exists():
        raise SystemExit(f'Capture absente : {name}')
    img = Image.open(source).convert('RGB')
    expected = (1365, 1000) if name == 'desktop' else (390, 844)
    if img.size != expected:
        raise SystemExit(f'Capture {name} : dimensions {img.size}, attendues {expected}')
    target = root / f'{name}.jpg'
    img.save(target, 'JPEG', quality=65, optimize=True)
    data = base64.b64encode(target.read_bytes()).decode('ascii')
    print(f'VISUAL_{name.upper()}_BEGIN {img.width}x{img.height}')
    for n in range(0, len(data), 4096):
        print('VISUAL_DATA ' + data[n:n+4096])
    print(f'VISUAL_{name.upper()}_END')
PY
