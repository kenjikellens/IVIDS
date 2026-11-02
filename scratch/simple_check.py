import subprocess
import urllib.request
import json
import time
import os

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
user_dir = os.path.abspath("scratch/edge_profile")
os.makedirs(user_dir, exist_ok=True)

proc = subprocess.Popen([
    EDGE,
    "--remote-debugging-port=9222",
    f"--user-data-dir={user_dir}",
    "--headless=new",
    "--disable-gpu",
    "http://127.0.0.1:8000"
])

print("Edge started with PID:", proc.pid)
time.sleep(2)
try:
    with urllib.request.urlopen("http://127.0.0.1:9222/json") as r:
        data = json.loads(r.read())
        print("Success! Tabs:", [t.get("title") for t in data])
finally:
    proc.terminate()
    print("Edge terminated.")

