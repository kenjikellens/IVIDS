import subprocess
import urllib.request
import json
import time
import os
import asyncio
import websockets

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

async def check():
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

        res = await send("Runtime.evaluate", {
            "expression": """
            (async () => {
                await window.Router.loadPage('settings');
                await new Promise(r => setTimeout(r, 800));
                document.getElementById('edit-language-btn')?.click();
                await new Promise(r => setTimeout(r, 600));
                const modal = document.getElementById('language-modal');
                const apply = modal?.querySelector('.modal__footer .btn--primary');
                const cancel = modal?.querySelector('.modal__footer .btn--secondary');
                const dialog = modal?.querySelector('.modal__dialog');
                const body = modal?.querySelector('.modal__body');
                const getR = el => el ? {
                    x: el.getBoundingClientRect().x,
                    y: el.getBoundingClientRect().y,
                    w: el.getBoundingClientRect().width,
                    h: el.getBoundingClientRect().height
                } : null;
                return {
                    dialog: getR(dialog),
                    body: getR(body),
                    apply: getR(apply),
                    cancel: getR(cancel),
                    bodyScrollTop: body?.scrollTop,
                    bodyScrollHeight: body?.scrollHeight,
                    bodyClientHeight: body?.clientHeight
                };
            })()
            """,
            "awaitPromise": True,
            "returnByValue": True
        })
        print(json.dumps(res.get("result", {}).get("value"), indent=2))

try:
    asyncio.run(check())
finally:
    proc.terminate()

