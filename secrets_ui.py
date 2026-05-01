"""Local web UI for pasting secrets into .env.

Zero deps (stdlib http.server). Run on localhost only — never bound to
0.0.0.0 — so nothing leaves the machine.

Start it:
    python3 secrets_ui.py            # http://127.0.0.1:7878
    python3 secrets_ui.py --port 9000

The UI:
- Lists every key currently in .env (values masked)
- Lets you paste a new value for any key, click Save → writes .env
- Lets you add a new KEY=value pair
- A "test ANTHROPIC_API_KEY" button hits the Claude API once and reports OK / error

Closes itself with Ctrl-C.
"""

import argparse
import html
import json
import os
import re
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Dict, List, Tuple

ENV_PATH = Path(__file__).resolve().parent / ".env.local"
EXAMPLE_PATH = Path(__file__).resolve().parent / ".env.example"


def parse_env(path: Path) -> List[Tuple[str, str, bool]]:
    """Returns list of (key, value, is_set). Order preserved."""
    out: List[Tuple[str, str, bool]] = []
    seen = set()
    if path.exists():
        for line in path.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            k, v = stripped.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k in seen:
                continue
            seen.add(k)
            out.append((k, v, bool(v)))
    # Also surface keys present in .env.example but not in .env
    if EXAMPLE_PATH.exists():
        for line in EXAMPLE_PATH.read_text().splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            k = stripped.split("=", 1)[0].strip()
            if k and k not in seen:
                out.append((k, "", False))
                seen.add(k)
    return out


def write_env(updates: Dict[str, str]) -> None:
    """Atomically merge updates into .env, preserving comments and order."""
    lines: List[str] = []
    seen = set()
    if ENV_PATH.exists():
        for raw in ENV_PATH.read_text().splitlines():
            stripped = raw.strip()
            if "=" in stripped and not stripped.startswith("#"):
                k = stripped.split("=", 1)[0].strip()
                if k in updates:
                    lines.append(f"{k}={updates[k]}")
                    seen.add(k)
                    continue
            lines.append(raw)
    for k, v in updates.items():
        if k not in seen:
            lines.append(f"{k}={v}")
    tmp = ENV_PATH.with_suffix(".env.tmp")
    tmp.write_text("\n".join(lines) + "\n")
    tmp.replace(ENV_PATH)


def mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "•" * len(value)
    return value[:4] + "•" * (len(value) - 8) + value[-4:]


def test_anthropic() -> Dict:
    """Make one tiny API call to verify the key works."""
    # Reload .env into env so a freshly-saved key is picked up.
    for raw in (ENV_PATH.read_text().splitlines() if ENV_PATH.exists() else []):
        s = raw.strip()
        if "=" in s and not s.startswith("#"):
            k, v = s.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and v:
                os.environ[k] = v
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return {"ok": False, "error": "ANTHROPIC_API_KEY is empty"}
    try:
        import anthropic
    except ImportError:
        return {"ok": False, "error": "anthropic package not installed; pip install anthropic"}
    try:
        client = anthropic.Anthropic(api_key=key)
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=20,
            messages=[{"role": "user", "content": "Reply with the word OK."}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        return {"ok": True, "response": text.strip()[:60]}
    except Exception as e:
        return {"ok": False, "error": str(e)[:240]}


def detect_warning(key: str, value: str) -> str:
    """Return a warning string if the value looks wrong for its key, else ''.
    These are detection rules — not exhaustive validation, just sanity checks
    for the common ways people paste the wrong thing into the wrong slot."""
    if not value:
        return ""
    # Wrong-type-of-key traps
    if key == "SUPABASE_SECRET_KEY" and value.startswith("sb_publishable_"):
        return "wrong key — this is a publishable key. Need sb_secret_… (Supabase → API Keys → reveal Secret)"
    if key == "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" and value.startswith("sb_secret_"):
        return "wrong key — this is the secret key. Need sb_publishable_… (browser-safe)"
    if key == "STRIPE_SECRET_KEY" and not (value.startswith("sk_") or value.startswith("sb_secret_") or value.startswith("rk_")):
        return "doesn't look like a Stripe secret key (expected sk_ / sb_secret_ / rk_)"
    if key == "STRIPE_WEBHOOK_SECRET" and not value.startswith("whsec_"):
        return "doesn't look like a Stripe webhook secret (expected whsec_…)"
    if key == "ANTHROPIC_API_KEY" and not value.startswith("sk-ant-"):
        return "doesn't look like an Anthropic key (expected sk-ant-…)"
    if key == "RESEND_API_KEY" and not value.startswith("re_"):
        return "doesn't look like a Resend key (expected re_…)"
    # Test-vs-live mode warnings — flag when going to production
    if key == "STRIPE_SECRET_KEY" and value.startswith("sk_test_"):
        return "TEST mode key — swap for sk_live_… in Stripe dashboard (toggle Test mode OFF) to take real payments"
    if key == "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" and value.startswith("pk_test_"):
        return "TEST mode key — swap for pk_live_… in Stripe dashboard to take real payments"
    return ""


def render_page(rows: List[Tuple[str, str, bool]], flash: str = "") -> str:
    flash_html = f'<div class="flash">{html.escape(flash)}</div>' if flash else ""
    row_html = []
    for k, v, is_set in rows:
        warning = detect_warning(k, v)
        is_warning = bool(warning)
        masked = html.escape(mask(v))
        status_dot = "⚠" if is_warning else ("●" if is_set else "○")
        if is_warning:
            status_class = "warning"
        elif is_set:
            status_class = "set"
        else:
            status_class = "unset"
        # On warning rows: clear the masked placeholder so user sees a clean
        # input ready for the new value (instead of stale •••• that they have
        # to wonder about).
        placeholder = "" if is_warning else (masked or "paste new value")
        if not placeholder:
            placeholder = "paste correct value here"
        warning_html = (
            f'<div class="warning-text">⚠ {html.escape(warning)}</div>'
            if is_warning else ""
        )
        row_html.append(f"""
        <form method="POST" action="/save" class="row {status_class}">
          <span class="dot">{status_dot}</span>
          <label>{html.escape(k)}</label>
          <input type="password" name="value" placeholder="{placeholder}" autocomplete="off">
          <input type="hidden" name="key" value="{html.escape(k)}">
          <button type="submit">save</button>
        </form>{warning_html}""")
    rows_html = "\n".join(row_html)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>autonomous_empire — secrets</title>
<style>
  body {{ font-family: -apple-system, system-ui, sans-serif; max-width: 720px;
          margin: 40px auto; padding: 0 20px; color: #222; }}
  h1 {{ font-size: 20px; margin-bottom: 4px; }}
  .sub {{ color: #888; font-size: 13px; margin-bottom: 24px; }}
  .row {{ display: grid; grid-template-columns: 24px 220px 1fr 80px;
          align-items: center; gap: 10px; padding: 6px 0;
          border-bottom: 1px solid #eee; }}
  .dot {{ color: #ccc; font-weight: bold; }}
  .set .dot {{ color: #3a3; }}
  .warning {{ background: #fff8dc; border-bottom-color: #e5c773; }}
  .warning .dot {{ color: #b78003; }}
  .warning input[type=password] {{ border-color: #e5c773; background: #fffceb; }}
  .warning-text {{ background: #fff8dc; color: #6b4d00; padding: 4px 12px 8px 58px;
          font-size: 12px; border-bottom: 1px solid #eee; margin-top: -1px; }}
  label {{ font-family: ui-monospace, monospace; font-size: 13px; }}
  input[type=password] {{ font-family: ui-monospace, monospace;
          padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; }}
  button {{ padding: 6px 10px; border: 1px solid #ccc; background: #f6f6f6;
          border-radius: 4px; cursor: pointer; }}
  button:hover {{ background: #eee; }}
  .flash {{ background: #efe; color: #161; padding: 8px 12px;
          border-radius: 4px; margin-bottom: 16px; font-size: 13px; }}
  .test {{ margin-top: 24px; padding-top: 16px; border-top: 2px solid #eee; }}
  .test-result {{ font-family: ui-monospace, monospace; font-size: 13px;
          padding: 10px; background: #f6f6f6; border-radius: 4px;
          white-space: pre-wrap; margin-top: 10px; }}
  .ok {{ background: #efe; color: #161; }}
  .err {{ background: #fee; color: #611; }}
  .add {{ margin-top: 24px; }}
  .add input[type=text] {{ padding: 6px 10px; border: 1px solid #ccc;
          border-radius: 4px; width: 220px; font-family: ui-monospace, monospace; }}
</style></head>
<body>
<h1>autonomous_empire / secrets</h1>
<p class="sub">All saves write to <code>{ENV_PATH}</code>. Local only — nothing leaves this machine.</p>
{flash_html}
{rows_html}
<form method="POST" action="/save" class="row add">
  <span class="dot">+</span>
  <input type="text" name="key" placeholder="NEW_KEY_NAME" required>
  <input type="password" name="value" placeholder="value" autocomplete="off" required>
  <button type="submit">add</button>
</form>
<div class="test">
  <form method="POST" action="/test">
    <button type="submit">test ANTHROPIC_API_KEY</button>
  </form>
  <div id="result"></div>
</div>
</body></html>"""


def render_test_page(result: Dict) -> str:
    css = "ok" if result.get("ok") else "err"
    body = json.dumps(result, indent=2)
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>test result</title>
<style>body{{font-family:system-ui;max-width:720px;margin:40px auto;padding:0 20px}}
pre{{padding:10px;border-radius:4px;font-family:ui-monospace,monospace;white-space:pre-wrap}}
.ok{{background:#efe;color:#161}} .err{{background:#fee;color:#611}}</style></head>
<body><h1>test result</h1><pre class="{css}">{html.escape(body)}</pre>
<p><a href="/">← back</a></p></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, body: str, code: int = 200, content: str = "text/html") -> None:
        encoded = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", f"{content}; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            flash = ""
            if "?saved=" in self.path:
                flash = "Saved. Re-run your script to pick it up."
            self._send(render_page(parse_env(ENV_PATH), flash=flash))
        else:
            self._send("not found", code=404, content="text/plain")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8")
        form = urllib.parse.parse_qs(body)
        if self.path == "/save":
            key = (form.get("key") or [""])[0].strip()
            value = (form.get("value") or [""])[0]
            if not re.match(r"^[A-Z][A-Z0-9_]*$", key):
                self._send(render_page(parse_env(ENV_PATH),
                          flash=f"Invalid key '{key}' — uppercase letters/numbers/underscore only"),
                          code=400)
                return
            write_env({key: value})
            # 303 → GET / so refresh doesn't re-submit.
            self.send_response(303)
            self.send_header("Location", "/?saved=1")
            self.end_headers()
        elif self.path == "/test":
            self._send(render_test_page(test_anthropic()))
        else:
            self._send("not found", code=404, content="text/plain")

    def log_message(self, fmt, *args):  # quiet
        return


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=7878)
    args = ap.parse_args()
    server = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"\n  ▸ secrets UI: http://127.0.0.1:{args.port}")
    print(f"  ▸ writing to: {ENV_PATH}")
    print("  ▸ Ctrl-C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  ▸ stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
