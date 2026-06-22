"""
IVIDS Broken Channel Scanner
=============================
Standalone CLI tool that fetches all M3U playlists defined in sources.js,
tests every unique stream URL with a HEAD request (falling back to a ranged GET),
and writes confirmed broken URLs to broken-channels.json.

Usage:
    python scan_broken_channels.py              # Full scan (all sources)
    python scan_broken_channels.py --workers 20 # Full scan with 20 concurrent workers
    python scan_broken_channels.py --timeout 6  # Custom per-stream timeout in seconds
    python scan_broken_channels.py --clear      # Clear the broken list before scanning
"""

import os
import sys
import re
import json
import time
import argparse
import requests
from requests.adapters import HTTPAdapter
import concurrent.futures
from collections import OrderedDict

# Create a shared requests Session with connection pooling
session = requests.Session()
# Setup adapter to allow connection pooling for worker threads
adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100)
session.mount('http://', adapter)
session.mount('https://', adapter)


# ── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, 'app', 'src', 'main', 'assets', 'main')
SOURCES_JS = os.path.join(ASSETS_DIR, 'logic', 'livetv', 'sources.js')
BROKEN_DB  = os.path.join(ASSETS_DIR, 'logic', 'livetv', 'broken-channels.json')
WORKING_DB = os.path.join(ASSETS_DIR, 'logic', 'livetv', 'working-channels.json')


# ── Source Extraction ────────────────────────────────────────────────────────

def extract_source_urls():
    """
    Parses sources.js to extract all M3U playlist URLs defined in the preset sources.
    Returns a list of (name, url) tuples by scanning the source file content.
    """
    with open(SOURCES_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    sources = []
    # Match each source block: "key": { name: "...", url: "...", ... }
    pattern = re.compile(
        r'name:\s*"([^"]+)".*?url:\s*"([^"]+)"',
        re.DOTALL
    )
    for match in pattern.finditer(content):
        sources.append((match.group(1), match.group(2)))

    return sources


# ── M3U Parsing ──────────────────────────────────────────────────────────────

def parse_m3u(text):
    """
    Parses raw M3U text content and extracts stream URLs and their associated display names.
    Returns a list of (name, url) tuples from the parsed playlist.
    """
    lines = text.split('\n')
    channels = []
    current_name = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line.startswith('#EXTINF:'):
            comma_idx = line.rfind(',')
            current_name = line[comma_idx + 1:].strip() if comma_idx != -1 else 'Unknown'
        elif line.startswith('#'):
            continue
        else:
            # This is a URL line
            channels.append((current_name or 'Unknown', line))
            current_name = None

    return channels


def fetch_playlist(url):
    """
    Downloads an M3U playlist from a remote URL and parses its channels.
    Returns a list of (name, url) tuples, returning an empty list on failure.
    """
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (IVIDS Scanner)'}
        resp = session.get(url, headers=headers, timeout=20)
        if resp.status_code < 400:
            content = resp.content.decode('utf-8', errors='replace')
            return parse_m3u(content)
    except Exception as e:
        print(f"  ⚠ Failed to fetch playlist: {e}")
    return []


# ── Stream Verification ──────────────────────────────────────────────────────

def check_stream(url, timeout):
    """
    Tests a single stream URL using a direct ranged GET request (bytes=0-0) with stream=True.
    Many IPTV servers reject HEAD requests, so performing a ranged GET directly avoids redundant handshakes.
    Returns True if the stream is online, or False if the request fails or times out.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (IVIDS Scanner)',
        'Accept': '*/*',
        'Range': 'bytes=0-0'
    }

    try:
        # Use stream=True to avoid buffering the stream body
        response = session.get(url, headers=headers, timeout=timeout, stream=True)
        if response.status_code < 400:
            response.close() # Close to return connection to the pool
            return True
    except Exception:
        pass

    return False


# ── Database I/O ─────────────────────────────────────────────────────────────

def load_broken_db():
    """
    Loads the persistent broken channels database from the local JSON file.
    This reads broken-channels.json to determine which stream URLs are known to be offline.
    """
    try:
        with open(BROKEN_DB, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return set(data) if isinstance(data, list) else set()
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_broken_db(broken_set):
    """
    Writes the updated set of broken stream URLs back to the broken-channels.json file.
    The URLs are saved as a sorted JSON array to keep version control diffs clean.
    """
    sorted_list = sorted(broken_set)
    with open(BROKEN_DB, 'w', encoding='utf-8') as f:
        json.dump(sorted_list, f, indent=2)


def load_working_db():
    """
    Loads the persistent working channels database from the local JSON file.
    This reads working-channels.json to determine which stream URLs are verified as online.
    """
    try:
        with open(WORKING_DB, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return set(data) if isinstance(data, list) else set()
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_working_db(working_set):
    """
    Writes the updated set of working stream URLs back to the working-channels.json file.
    The URLs are saved as a sorted JSON array to keep version control diffs clean.
    """
    sorted_list = sorted(working_set)
    with open(WORKING_DB, 'w', encoding='utf-8') as f:
        json.dump(sorted_list, f, indent=2)


# ── Main Scanner ─────────────────────────────────────────────────────────────

def run_scan(workers, timeout, clear, recheck=False):
    """
    Orchestrates the full scan: fetches playlists, checks streams, and saves results.
    It updates the broken/working databases and skips already scanned URLs unless rechecking.
    """
    print("=" * 60)
    print("        IVIDS Broken Channel Scanner")
    print("=" * 60)
    print()

    # Load or clear existing databases
    if clear:
        broken_urls = set()
        working_urls = set()
        print("🗑  Cleared existing broken and working channels databases.")
    else:
        broken_urls = load_broken_db()
        working_urls = load_working_db()
        print(f"📂 Loaded {len(broken_urls)} broken and {len(working_urls)} working channels.")

    # Extract sources
    sources = extract_source_urls()
    print(f"📡 Found {len(sources)} playlist sources in sources.js")
    print()

    # Fetch all playlists and deduplicate
    all_channels = OrderedDict()  # url -> name (preserves first-seen name)

    for i, (name, url) in enumerate(sources, 1):
        print(f"  [{i}/{len(sources)}] Fetching: {name}...")
        channels = fetch_playlist(url)
        new_count = 0
        for ch_name, ch_url in channels:
            if ch_url not in all_channels:
                all_channels[ch_url] = ch_name
                new_count += 1
        print(f"           → {len(channels)} channels ({new_count} new unique)")

    total_unique = len(all_channels)
    print()
    print(f"📊 Total unique streams to scan: {total_unique}")

    # Determine which URLs to check
    if recheck:
        # Check all unique channels except those known to be broken (still skip broken to avoid spamming)
        urls_to_check = [u for u in all_channels if u not in broken_urls]
        skipped = total_unique - len(urls_to_check)
        if skipped > 0:
            print(f"⏭  Skipping {skipped} already known broken channels (recheck enabled).")
    else:
        # Skip both broken and working
        urls_to_check = [u for u in all_channels if u not in broken_urls and u not in working_urls]
        skipped = total_unique - len(urls_to_check)
        if skipped > 0:
            print(f"⏭  Skipping {skipped} already scanned (broken or working) channels.")

    print(f"🔍 Scanning {len(urls_to_check)} streams with {workers} workers (timeout: {timeout}s)...")
    print()

    # Progress tracking
    checked = 0
    new_broken = 0
    online = 0
    start_time = time.time()

    def process_url(url):
        """Checks a single URL and returns (url, is_alive)."""
        alive = check_stream(url, timeout)
        return (url, alive)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_url, url): url for url in urls_to_check}

        for future in concurrent.futures.as_completed(futures):
            url = futures[future]
            checked += 1
            try:
                _, alive = future.result()
                if alive:
                    online += 1
                    working_urls.add(url)
                    broken_urls.discard(url)
                    status_icon = "✅"
                else:
                    new_broken += 1
                    broken_urls.add(url)
                    working_urls.discard(url)
                    status_icon = "❌"
            except Exception:
                new_broken += 1
                broken_urls.add(url)
                working_urls.discard(url)
                status_icon = "❌"

            # Progress line (overwrite in place)
            name = all_channels.get(url, 'Unknown')[:40]
            elapsed = time.time() - start_time
            rate = checked / elapsed if elapsed > 0 else 0
            remaining = (len(urls_to_check) - checked) / rate if rate > 0 else 0

            sys.stdout.write(
                f"\r  {status_icon} [{checked}/{len(urls_to_check)}] "
                f"✅{online} ❌{new_broken} "
                f"({rate:.1f}/s, ~{remaining:.0f}s left) "
                f"{name:<40}"
            )
            sys.stdout.flush()

            # Periodically save progress (every 50 checks)
            if checked % 50 == 0:
                save_broken_db(broken_urls)
                save_working_db(working_urls)

    print()
    print()

    # Final save
    save_broken_db(broken_urls)
    save_working_db(working_urls)

    elapsed = time.time() - start_time
    print("=" * 60)
    print("  Scan Complete!")
    print("=" * 60)
    print(f"  ⏱  Duration:       {elapsed:.1f}s")
    print(f"  📊 Total checked:  {checked}")
    print(f"  ✅ Online:         {online}")
    print(f"  ❌ Newly broken:   {new_broken}")
    print(f"  📂 Total broken:   {len(broken_urls)}")
    print(f"  📂 Total working:  {len(working_urls)}")
    print(f"  💾 Saved to database files.")
    print("=" * 60)


# ── CLI Entry Point ──────────────────────────────────────────────────────────

if __name__ == '__main__':
    # Force stdout and stderr to use UTF-8 on Windows to avoid UnicodeEncodeError with emojis
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(
        description='IVIDS Broken Channel Scanner - scans IPTV streams and persists broken/working status.'
    )
    parser.add_argument(
        '--workers', type=int, default=10,
        help='Number of concurrent scanner threads (default: 10)'
    )
    parser.add_argument(
        '--timeout', type=int, default=5,
        help='Timeout per stream check in seconds (default: 5)'
    )
    parser.add_argument(
        '--clear', action='store_true',
        help='Clear both the broken and working channels databases before scanning'
    )
    parser.add_argument(
        '--recheck', action='store_true',
        help='Force rechecking of already scanned working channels'
    )
    args = parser.parse_args()

    try:
        run_scan(workers=args.workers, timeout=args.timeout, clear=args.clear, recheck=args.recheck)
    except KeyboardInterrupt:
        print("\n\n⚠ Scan interrupted. Progress has been saved.")
        sys.exit(1)

