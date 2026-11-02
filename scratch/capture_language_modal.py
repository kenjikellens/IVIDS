import subprocess
import urllib.request
import json
import time
import os
import asyncio
import websockets
import base64

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
user_dir = os.path.abspath("scratch/edge_profile")
os.makedirs(user_dir, exist_ok=True)

proc = subprocess.Popen([
    EDGE,
    "--remote-debugging-port=9222",
    f"--user-data-dir={user_dir}",
    "--headless=new",
    "--disable-gpu",
    "--window-size=1280,720",
    "http://127.0.0.1:8000"
])

async def capture():
    for _ in range(15):
        try:
            with urllib.request.urlopen("http://127.0.0.1:9222/json") as r:
                tabs = json.loads(r.read())
                page_tabs = [t for t in tabs if t.get("type") == "page"]
                if page_tabs:
                    break
        except Exception:
            pass
        await asyncio.sleep(0.5)

    ws_url = page_tabs[0]['webSocketDebuggerUrl']

    async with websockets.connect(ws_url) as ws:
        msg_id = 1
        async def send(method, params=None):
            nonlocal msg_id
            mid = msg_id
            msg_id += 1
            await ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
            while True:
                raw = await ws.recv()
                msg = json.loads(raw)
                if msg.get("id") == mid:
                    return msg.get("result", {})

        await send("Page.enable")
        await send("Runtime.enable")

        # Wait for app load
        await asyncio.sleep(1.5)

        # Load settings and open language modal
        res = await send("Runtime.evaluate", {
            "expression": """
            (async () => {
                await window.Router.loadPage('settings');
                await new Promise(r => setTimeout(r, 800));
                const btn = document.getElementById('edit-language-btn');
                if (btn) btn.click();
                await new Promise(r => setTimeout(r, 600));
                const modal = document.getElementById('language-modal');
                const applyBtn = modal?.querySelector('.modal__footer .btn--primary');
                const cancelBtn = modal?.querySelector('.modal__footer .btn--secondary');
                const footer = modal?.querySelector('.modal__footer');
                return {
                    modalExists: !!modal,
                    modalOpen: modal?.classList.contains('is-open'),
                    applyBtnExists: !!applyBtn,
                    cancelBtnExists: !!cancelBtn,
                    applyWidth: applyBtn?.offsetWidth,
                    cancelWidth: cancelBtn?.offsetWidth,
                    applyRect: applyBtn ? applyBtn.getBoundingClientRect() : null,
                    cancelRect: cancelBtn ? cancelBtn.getBoundingClientRect() : null,
                    footerRect: footer ? footer.getBoundingClientRect() : null,
                    applyClasses: applyBtn?.className,
                    cancelClasses: cancelBtn?.className,
                    footerClasses: footer?.className
                };
            })()
            """,
            "awaitPromise": True,
            "returnByValue": True
        })
        print("DOM State:", json.dumps(res.get("result", {}).get("value"), indent=2))

        # Capture screenshot
        ss = await send("Page.captureScreenshot")
        img_bytes = base64.b64decode(ss['data'])
        out_file = r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\verified_screenshot.png"
        with open(out_file, "wb") as f:
            f.write(img_bytes)
        print("Screenshot written to:", out_file)

try:
    asyncio.run(capture())
finally:
    proc.terminate()
    print("Edge closed.")
