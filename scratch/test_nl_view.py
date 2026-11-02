import subprocess
import urllib.request
import json
import time
import os
import asyncio
import websockets
import base64
from PIL import Image

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
user_dir = os.path.abspath("scratch/edge_profile")

proc = subprocess.Popen([
    EDGE,
    "--remote-debugging-port=9222",
    f"--user-data-dir={user_dir}",
    "--headless=new",
    "--disable-gpu",
    "--window-size=1280,720",
    "http://127.0.0.1:8000"
])

async def capture_nl():
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
                msg = json.loads(await ws.recv())
                if msg.get("id") == mid:
                    return msg.get("result", {})

        await send("Page.enable")
        await send("Runtime.enable")
        await asyncio.sleep(1.5)

        # Set language to 'nl' in settings, load settings, open modal
        await send("Runtime.evaluate", {
            "expression": """
            (async () => {
                if (window.i18n) await window.i18n.setLanguage('nl');
                await window.Router.loadPage('settings');
                await new Promise(r => setTimeout(r, 600));
                if (window.settingsInstance) {
                    window.settingsInstance.settings.language = 'nl';
                    window.settingsInstance.pendingSettings.language = 'nl';
                }
                document.getElementById('edit-language-btn')?.click();
                await new Promise(r => setTimeout(r, 500));
            })()
            """,
            "awaitPromise": True,
            "returnByValue": True
        })

        ss = await send("Page.captureScreenshot")
        img_bytes = base64.b64decode(ss['data'])
        out_file = r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\verified_nl.png"
        with open(out_file, "wb") as f:
            f.write(img_bytes)
        
        im = Image.open(out_file)
        crop = im.crop((180, 40, 1080, 560))
        crop.save(r"C:\Users\kenji\.gemini\antigravity\brain\3ba5181d-fe21-449f-a0cd-7fd2dc55a42a\verified_nl_crop.png")
        print("NL Crop saved.")

try:
    asyncio.run(capture_nl())
finally:
    proc.terminate()

