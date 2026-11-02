import subprocess
import time
import urllib.request
import json
import asyncio
import websockets
import os
import base64
import tempfile
import shutil

EDGE_EXE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = 9222
tmp_dir = tempfile.mkdtemp()

cmd = [
    EDGE_EXE,
    f"--remote-debugging-port={PORT}",
    f"--user-data-dir={tmp_dir}",
    "--headless=new",
    "--disable-gpu",
    "--window-size=1280,720",
    "http://127.0.0.1:8000"
]

proc = subprocess.Popen(cmd)

async def main():
    for _ in range(10):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as res:
                tabs = json.loads(res.read().decode())
                if tabs:
                    break
        except Exception:
            time.sleep(0.5)
    
    print("Found tabs:", len(tabs))
    target_tab = tabs[0]
    ws_url = target_tab['webSocketDebuggerUrl']

    async with websockets.connect(ws_url) as ws:
        msg_id = 1
        async def send_cmd(method, params=None):
            nonlocal msg_id
            mid = msg_id
            msg_id += 1
            payload = {"id": mid, "method": method, "params": params or {}}
            await ws.send(json.dumps(payload))
            while True:
                resp = json.loads(await ws.recv())
                if resp.get("id") == mid:
                    return resp.get("result", {})

        await send_cmd("Page.enable")
        await send_cmd("Runtime.enable")
        
        await asyncio.sleep(2)
        
        eval_res = await send_cmd("Runtime.evaluate", {
            "expression": """
            (async () => {
                window.location.hash = '#settings';
                await new Promise(r => setTimeout(r, 800));
                const editBtn = document.getElementById('edit-language-btn');
                if (editBtn) editBtn.click();
                await new Promise(r => setTimeout(r, 600));
                const modal = document.getElementById('language-modal');
                const applyBtn = modal?.querySelector('.modal__footer .btn--primary');
                const cancelBtn = modal?.querySelector('.modal__footer .btn--secondary');
                const footer = modal?.querySelector('.modal__footer');
                return {
                    modalOpen: modal?.classList.contains('is-open'),
                    applyBtnExists: !!applyBtn,
                    applyWidth: applyBtn?.offsetWidth,
                    cancelWidth: cancelBtn?.offsetWidth,
                    footerDisplay: footer ? window.getComputedStyle(footer).display : null,
                    footerFlexDir: footer ? window.getComputedStyle(footer).flexDirection : null,
                    applyDisplay: applyBtn ? window.getComputedStyle(applyBtn).display : null,
                    applyComputedWidth: applyBtn ? window.getComputedStyle(applyBtn).width : null,
                    applyText: applyBtn ? applyBtn.innerText : null
                };
            })()
            """,
            "awaitPromise": True,
            "returnByValue": True
        })
        print("DOM State:", json.dumps(eval_res.get("result", {}).get("value"), indent=2))

        ss = await send_cmd("Page.captureScreenshot")
        img_data = base64.b64decode(ss['data'])
        out_path = os.path.join(os.path.dirname(__file__), "edge_screenshot.png")
        with open(out_path, "wb") as f:
            f.write(img_data)
        print("Screenshot saved to:", out_path)

try:
    asyncio.run(main())
finally:
    proc.terminate()
    try:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except Exception:
        pass
