import base64
import gzip
import http.server
import io
import ipaddress
import json
import mimetypes
import os
import re
import socket
import ssl
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import ThreadingHTTPServer

# Unverified SSL context used strictly for third-party IPTV video stream CDNs with broken certs
_UNVERIFIED_SSL_CTX = ssl._create_unverified_context()

# Register the SVG MIME type to ensure Windows systems serve vector graphics correctly
mimetypes.add_type('image/svg+xml', '.svg')

# MIME types eligible for gzip compression to reduce transfer sizes
COMPRESSIBLE_TYPES = {
    'text/html', 'text/css', 'text/javascript', 'application/javascript',
    'application/json', 'application/xml', 'text/xml', 'image/svg+xml',
    'application/vnd.apple.mpegurl', 'text/plain'
}

# Files that rarely change and can be cached longer during development
VENDOR_PATTERNS = {'hls.min.js', 'hls.js'}

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.abspath(os.path.join(BASE_DIR, 'app', 'src', 'main', 'assets', 'main'))
BROKEN_CHANNELS_PATH = os.path.join(ASSETS_DIR, 'logic', 'livetv', 'broken-channels.json')
ENV_FILE_PATH = os.path.join(BASE_DIR, '.env')
MAX_BROKEN_CHANNEL_BODY_BYTES = 16384
MAX_BROKEN_CHANNEL_URL_LENGTH = 2048
MAX_BROKEN_CHANNELS = 5000


class EnvConfigCache:
    """
    Thread-safe mtime-cached loader for the local .env file.
    Avoids re-reading and parsing .env from disk on every Debrid status or stream lookup.
    """

    def __init__(self, env_path):
        self._env_path = env_path
        self._lock = threading.Lock()
        self._mtime = None
        self._values = {}

    def get(self, key, default=''):
        """Returns a config key from process environment or cached .env file."""
        env_val = os.environ.get(key)
        if env_val is not None:
            return env_val.strip()
        with self._lock:
            self._refresh_locked()
            return self._values.get(key, default).strip()

    def _refresh_locked(self):
        """Reloads .env key=value pairs only when the file modification time changes."""
        if not os.path.isfile(self._env_path):
            self._mtime = None
            self._values = {}
            return
        try:
            mtime = os.path.getmtime(self._env_path)
            if mtime == self._mtime:
                return
            parsed = {}
            with open(self._env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    stripped = line.strip()
                    if not stripped or stripped.startswith('#') or '=' not in stripped:
                        continue
                    k, v = stripped.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k:
                        parsed[k] = v
            self._values = parsed
            self._mtime = mtime
        except Exception:
            pass


ENV_CACHE = EnvConfigCache(ENV_FILE_PATH)


def resolve_url(base_url, relative_url):
    """
    Resolves a potentially relative URL against a base URL for M3U8 manifest proxying.
    """
    if relative_url.startswith('http://') or relative_url.startswith('https://'):
        return relative_url
    return urllib.parse.urljoin(base_url, relative_url)


def rewrite_m3u8(content, base_url, proxy_prefix, extra_query=''):
    """
    Rewrites relative and absolute URLs inside .m3u8 manifest content to route through the local proxy.
    """
    lines = content.split('\n')
    rewritten = []
    suffix = extra_query if extra_query else ''
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            if 'URI="' in stripped:
                def replace_uri(match):
                    """Replaces URI attribute values with proxied equivalents."""
                    absolute = resolve_url(base_url, match.group(1))
                    return f'URI="{proxy_prefix}{urllib.parse.quote(absolute, safe="")}{suffix}"'
                stripped = re.sub(r'URI="([^"]*)"', replace_uri, stripped)
            rewritten.append(stripped)
        else:
            absolute = resolve_url(base_url, stripped)
            rewritten.append(f'{proxy_prefix}{urllib.parse.quote(absolute, safe="")}{suffix}')
    return '\n'.join(rewritten)


class UrlSafetyGuard:
    """
    Validates outbound proxy and addon URLs against SSRF targets with a thread-safe DNS TTL cache.
    Blocks loopback, private, link-local, multicast, CGNAT, and unspecified IP ranges.
    """

    _CGNAT_NETWORK = ipaddress.ip_network('100.64.0.0/10')
    _ZERO_NETWORK = ipaddress.ip_network('0.0.0.0/8')
    _FORBIDDEN_HOSTS = frozenset({'localhost', '0.0.0.0', '127.0.0.1', '::1', 'metadata', 'metadata.google.internal'})

    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()

    def is_public_ip(self, ip_obj):
        """Returns True only if ip_obj is globally routable (unwrapping IPv4-mapped IPv6 addresses)."""
        if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped is not None:
            return self.is_public_ip(ip_obj.ipv4_mapped)
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified
        ):
            return False
        if isinstance(ip_obj, ipaddress.IPv4Address):
            if ip_obj in self._CGNAT_NETWORK or ip_obj in self._ZERO_NETWORK:
                return False
        return True

    def classify_hostname(self, hostname_lower):
        """Classifies hostname as 'ok', 'dns_error', or 'forbidden' with TTL caching."""
        try:
            if not hostname_lower or hostname_lower in self._FORBIDDEN_HOSTS or hostname_lower.endswith('.localhost'):
                return 'forbidden'

            now = time.time()
            with self._lock:
                cached = self._cache.get(hostname_lower)
                if cached and cached[1] > now:
                    return cached[0]

            stripped = hostname_lower.strip('[]')
            try:
                ip_obj = ipaddress.ip_address(stripped)
                status = 'ok' if self.is_public_ip(ip_obj) else 'forbidden'
                self._store_cache(hostname_lower, status, now + 60.0)
                return status
            except ValueError:
                pass

            try:
                addr_infos = socket.getaddrinfo(hostname_lower, None)
            except socket.gaierror:
                self._store_cache(hostname_lower, 'dns_error', now + 10.0)
                return 'dns_error'

            if not addr_infos:
                self._store_cache(hostname_lower, 'dns_error', now + 10.0)
                return 'dns_error'

            for info in addr_infos:
                ip_str = info[4][0]
                if '%' in ip_str or not self.is_public_ip(ipaddress.ip_address(ip_str)):
                    self._store_cache(hostname_lower, 'forbidden', now + 60.0)
                    return 'forbidden'

            self._store_cache(hostname_lower, 'ok', now + 60.0)
            return 'ok'
        except Exception:
            return 'forbidden'

    def _store_cache(self, hostname_lower, status, expires_at):
        """Stores a host classification in the bounded TTL cache under lock."""
        with self._lock:
            if len(self._cache) > 2048:
                self._cache.clear()
            self._cache[hostname_lower] = (status, expires_at)

    def classify_url(self, url):
        """Validates scheme and hostname of a candidate URL, returning 'ok', 'dns_error', or 'forbidden'."""
        try:
            if not isinstance(url, str):
                return 'forbidden'
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme.lower() not in ('http', 'https') or not parsed.hostname:
                return 'forbidden'
            return self.classify_hostname(parsed.hostname.lower())
        except Exception:
            return 'forbidden'

    def is_safe_url(self, url):
        """Returns True when a URL uses http/https and resolves strictly to public IP addresses."""
        return self.classify_url(url) == 'ok'


URL_GUARD = UrlSafetyGuard()


def is_safe_url(url):
    """Module-level helper delegating URL safety checks to URL_GUARD."""
    return URL_GUARD.is_safe_url(url)


class ForbiddenRedirectError(urllib.error.HTTPError):
    """Raised when an upstream HTTP redirect attempts to target a forbidden or unsafe SSRF URL."""


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """
    Custom HTTP redirect handler validating every redirect Location URL with UrlSafetyGuard.
    Prevents SSRF bypasses via 301/302/307/308 redirects to loopback, private, or metadata targets.
    """

    max_redirections = 5

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        """Validates the resolved redirect destination before allowing urllib to follow it."""
        if not URL_GUARD.is_safe_url(newurl):
            raise ForbiddenRedirectError(newurl, 403, 'Forbidden redirect target', headers, None)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


# Strict TLS opener for Real-Debrid API and Stremio metadata endpoints
_STRICT_OPENER = urllib.request.build_opener(
    SafeRedirectHandler(),
    urllib.request.HTTPSHandler(context=ssl.create_default_context())
)

# Permissive TLS opener reserved strictly for third-party IPTV/video stream CDNs
_PROXY_OPENER = urllib.request.build_opener(
    SafeRedirectHandler(),
    urllib.request.HTTPSHandler(context=_UNVERIFIED_SSL_CTX)
)


class StaticFileCache:
    """
    In-memory cache for gzip-compressed static assets with mtime invalidation.
    """

    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()

    def get_compressed(self, path):
        """Retrieves gzip-compressed bytes and ETag for path, refreshing from disk when modified."""
        try:
            mtime = os.path.getmtime(path)
            with self._lock:
                cached = self._cache.get(path)
                if cached and cached[0] == mtime:
                    return cached[1], cached[2]

            with open(path, 'rb') as f:
                raw_body = f.read()

            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6) as gz:
                gz.write(raw_body)
            compressed = buf.getvalue()
            etag = f'"{int(mtime)}-{len(compressed)}"'

            with self._lock:
                self._cache[path] = (mtime, compressed, etag)
            return compressed, etag
        except Exception:
            return None, None


STATIC_CACHE = StaticFileCache()


class BrokenChannelsStore:
    """
    Thread-safe persistence store for broken-channels.json guarded by a threading.Lock.
    Prevents concurrent POST requests from corrupting the JSON file on disk.
    """

    def __init__(self, file_path, max_items=MAX_BROKEN_CHANNELS):
        self._file_path = file_path
        self._max_items = max_items
        self._lock = threading.Lock()

    def read_raw(self):
        """Reads raw JSON text from broken-channels.json or returns '[]' when missing."""
        with self._lock:
            try:
                with open(self._file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except FileNotFoundError:
                return '[]'

    def append_url(self, url):
        """Appends a validated URL if not already recorded; returns (added_count, limit_reached)."""
        with self._lock:
            try:
                with open(self._file_path, 'r', encoding='utf-8') as f:
                    broken_list = json.load(f)
                if not isinstance(broken_list, list):
                    broken_list = []
            except (FileNotFoundError, json.JSONDecodeError):
                broken_list = []

            if url not in broken_list:
                if len(broken_list) >= self._max_items:
                    return len(broken_list), True
                broken_list.append(url)
                with open(self._file_path, 'w', encoding='utf-8') as f:
                    json.dump(broken_list, f, indent=2)
                sys.stderr.write(f"[IVIDS] Added broken channel: {url[:80]}...\n")
            return len(broken_list), False


BROKEN_CHANNELS_STORE = BrokenChannelsStore(BROKEN_CHANNELS_PATH)


class DebridService:
    """
    Encapsulates Real-Debrid account checks, Stremio addon queries, and magnet/link resolution.
    Uses strict TLS certificate verification (_STRICT_OPENER) to protect Bearer API tokens.
    """

    def __init__(self, env_cache, url_guard):
        self._env_cache = env_cache
        self._url_guard = url_guard
        self._rd_user_cache = {}
        self._cache_lock = threading.Lock()

    def get_backup_token(self):
        """Returns the Real-Debrid API key from environment or mtime-cached .env file."""
        return self._env_cache.get('REAL_DEBRID_API_KEY', '')

    def check_premium(self, token):
        """Verifies Real-Debrid Premium account status over verified HTTPS with a 120s TTL cache."""
        if not token:
            return False
        now = time.time()
        with self._cache_lock:
            cached = self._rd_user_cache.get(token)
            if cached and cached[1] > now:
                return cached[0]
        try:
            info = self.rd_api_request('/user', token, timeout=5)
            is_prem = bool(info.get('type') == 'premium' or (info.get('premium') or 0) > 0)
            with self._cache_lock:
                self._rd_user_cache[token] = (is_prem, now + 120.0)
            return is_prem
        except Exception:
            with self._cache_lock:
                self._rd_user_cache[token] = (False, now + 30.0)
            return False

    def rd_api_request(self, path, token, method='GET', form_data=None, timeout=10):
        """Executes a TLS-verified HTTPS call to api.real-debrid.com/rest/1.0."""
        url = f'https://api.real-debrid.com/rest/1.0{path}'
        headers = {'Authorization': f'Bearer {token}', 'User-Agent': 'IVIDS/1.0'}
        data_bytes = urllib.parse.urlencode(form_data).encode('utf-8') if form_data is not None else None
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        with _STRICT_OPENER.open(req, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            return json.loads(raw) if raw else {}

    def build_stremio_stream_url(self, addon_base, media_type, stream_id, token):
        """Constructs a Stremio addon /stream/{type}/{id}.json URL with optional Debrid config."""
        cleaned = (addon_base or '').strip().rstrip('/')
        if cleaned.endswith('/manifest.json'):
            cleaned = cleaned[:-len('/manifest.json')].rstrip('/')
        parsed = urllib.parse.urlparse(cleaned)
        host = (parsed.hostname or '').lower()
        path_only = (parsed.path or '').strip('/')
        if token and not path_only:
            if 'torrentio' in host:
                cfg = f'sort=qualitysize|realdebrid={token}'
                cleaned = f'{cleaned}/{urllib.parse.quote(cfg, safe="|=,")}'
            elif 'comet' in host:
                cfg_obj = {'debridService': 'realdebrid', 'debridApiKey': token}
                b64 = base64.b64encode(json.dumps(cfg_obj, separators=(',', ':')).encode('utf-8')).decode('ascii')
                cleaned = f'{cleaned}/{b64}'
        return f'{cleaned}/stream/{urllib.parse.quote(media_type)}/{urllib.parse.quote(stream_id)}.json'

    def fetch_stremio_streams(self, addon_base, media_type, stream_id, token):
        """Queries a Stremio addon stream endpoint over verified HTTPS after SSRF validation."""
        target_url = self.build_stremio_stream_url(addon_base, media_type, stream_id, token)
        if self._url_guard.classify_url(target_url) != 'ok':
            return None, 'Forbidden addon URL'
        req = urllib.request.Request(target_url, headers={'User-Agent': 'IVIDS/1.0', 'Accept': 'application/json'})
        with _STRICT_OPENER.open(req, timeout=8) as resp:
            raw = resp.read(4 * 1024 * 1024).decode('utf-8', errors='replace')
            data = json.loads(raw)
            return (data.get('streams', []) if isinstance(data, dict) else []), None


DEBRID_SERVICE = DebridService(ENV_CACHE, URL_GUARD)


class StreamProxyService:
    """
    Reverse stream proxy helper managing dead-host TTL caching and upstream header profile fallback.
    Guarded by a threading.Lock so concurrent video threads safely share dead-host state.
    """

    CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    VLC_UA = 'VLC/3.0.20 LibVLC/3.0.20'

    def __init__(self, url_guard):
        self._url_guard = url_guard
        self._dead_hosts = {}
        self._lock = threading.Lock()

    def is_dead_host(self, host):
        """Checks whether a hostname failed DNS recently within its 30s TTL window."""
        if not host:
            return False
        now = time.time()
        with self._lock:
            ts = self._dead_hosts.get(host)
            if ts is None:
                return False
            if now - ts < 30.0:
                return True
            del self._dead_hosts[host]
            return False

    def mark_dead_host(self, host):
        """Records a hostname as unreachable for 30 seconds under lock."""
        if not host:
            return
        with self._lock:
            if len(self._dead_hosts) > 512:
                self._dead_hosts.clear()
            self._dead_hosts[host] = time.time()


STREAM_PROXY = StreamProxyService(URL_GUARD)


_cached_version = None
_cached_version_mtime = 0


def get_app_version():
    """
    Retrieves the application version string from package.json with mtime-based memory caching.
    """
    global _cached_version, _cached_version_mtime
    try:
        project_root = os.path.abspath(os.path.dirname(__file__))
        package_json_path = os.path.join(project_root, 'package.json')
        mtime = os.path.getmtime(package_json_path)
        if _cached_version is not None and mtime == _cached_version_mtime:
            return _cached_version
        with open(package_json_path, 'r', encoding='utf-8') as f:
            pkg = json.load(f)
        _cached_version = pkg.get('version', '0.4.1')
        _cached_version_mtime = mtime
        return _cached_version
    except Exception:
        return '0.4.1'

class IVIDSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Custom request handler that serves static files from the assets directory,
    redirects root to the GUI, and provides a /proxy endpoint for CORS bypass.
    Adds gzip compression and intelligent caching.
    """
    # Instance flag to track whether Cache-Control was explicitly set by a handler
    _cache_control_set = False

    def __init__(self, *args, **kwargs):
        """
        Pins static serving to ASSETS_DIR regardless of the process working directory.
        This avoids 404s when run_pc.py is launched from an IDE, shortcut, or stale shell cwd.
        """
        super().__init__(*args, directory=ASSETS_DIR, **kwargs)

    def translate_path(self, path):
        """
        Translates a request path to a local file path inside ASSETS_DIR.
        Supports Android-style prefixes, maps empty requests to the root index.html,
        and automatically falls back to serving files from the 'gui' subdirectory.
        """
        parsed = urllib.parse.urlparse(path)
        clean_path = urllib.parse.unquote(parsed.path)
        clean_path = clean_path.split('?', 1)[0].split('#', 1)[0]
        clean_path = clean_path.replace('\\', '/')

        # Strip Android asset prefix
        android_prefix = '/app/src/main/assets/main/'

        if clean_path.startswith(android_prefix):
            clean_path = clean_path[len(android_prefix):]

        parts = [p for p in clean_path.split('/') if p and p not in ('.', '..')]

        # Default root or map to gui directory if the resource belongs to the GUI frontend
        if not parts:
            parts = ['gui', 'index.html']
        elif parts[0] not in {'gui', 'logic', 'config.xml', 'icon.png'}:
            parts.insert(0, 'gui')

        resolved = os.path.abspath(os.path.join(ASSETS_DIR, *parts))
        if not (resolved == ASSETS_DIR or resolved.startswith(ASSETS_DIR + os.sep)):
            return os.path.join(ASSETS_DIR, 'gui', 'index.html')
        return resolved

    def do_OPTIONS(self):
        """
        Handles CORS preflight OPTIONS requests by returning permissive access headers.
        Allows the browser to proceed with the actual GET/POST request.
        """
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):
        """
        Handles HTTP GET requests by routing API, proxy, and stub requests to their handlers.
        Redirects empty roots to index.html and serves static assets with compression.
        """
        parsed_path = urllib.parse.urlparse(self.path).path
        decoded_path = urllib.parse.unquote(parsed_path)
        if parsed_path == '/' or parsed_path == '':
            self.send_response(301)
            self.send_header('Location', '/index.html')
            self.end_headers()
        elif parsed_path == '/api/broken-channels':
            self._handle_get_broken_channels()
        elif parsed_path == '/api/version':
            self._handle_get_version()
        elif parsed_path == '/api/debrid/status':
            self._handle_debrid_status()
        elif parsed_path == '/api/debrid/streams':
            self._handle_debrid_streams()
        elif '$WEBAPIS/webapis/webapis.js' in decoded_path:
            self._handle_webapis_stub()
        elif parsed_path.startswith('/proxy'):
            self._handle_proxy()
        elif parsed_path.startswith('/resolve-stream'):
            self._handle_resolve_stream()
        else:
            self._serve_static_with_compression()

    def do_POST(self):
        """
        Handles HTTP POST requests. Routes broken channel persistence and Debrid link resolution.
        """
        parsed_path = urllib.parse.urlparse(self.path).path
        if parsed_path == '/api/broken-channels':
            self._handle_post_broken_channels()
        elif parsed_path == '/api/debrid/resolve':
            self._handle_debrid_resolve()
        else:
            self.send_error(404, 'Not Found')

    def _read_json_body(self, max_bytes):
        """Reads and parses a bounded JSON object body from the request stream, sending 400/413 on invalid input."""
        raw_len = self.headers.get('Content-Length')
        if raw_len is None:
            self.send_error(400, 'Missing Content-Length')
            return None
        try:
            content_length = int(raw_len)
        except ValueError:
            self.send_error(400, 'Invalid Content-Length')
            return None
        if content_length <= 0:
            self.send_error(400, 'Empty request body')
            return None
        if content_length > max_bytes:
            self.send_error(413, 'Request body too large')
            return None
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(400, 'Invalid JSON payload')
            return None
        if not isinstance(payload, dict):
            self.send_error(400, 'JSON payload must be an object')
            return None
        return payload

    def _handle_get_broken_channels(self):
        """Returns the current broken-channels.json file contents via the thread-safe store."""
        try:
            body = BROKEN_CHANNELS_STORE.read_raw().encode('utf-8')
            self._send_json_response(body, 200)
        except Exception:
            self.send_error(500, 'Failed to read broken channels')

    def _handle_get_version(self):
        """Returns the cached application version as a JSON payload."""
        try:
            body = json.dumps({'version': get_app_version()}).encode('utf-8')
            self._send_json_response(body, 200)
        except Exception:
            self.send_error(500, 'Failed to read version')

    def _handle_resolve_stream(self):
        """
        Extracts direct .m3u8 or .mp4 stream URLs from validated movie/TV embed endpoints
        using _PROXY_OPENER (with SafeRedirectHandler) to protect against SSRF redirects.
        """
        try:
            parsed = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed.query)

            content_id = (query_params.get('id', [''])[0] or '').strip()
            media_type = (query_params.get('type', ['movie'])[0] or 'movie').strip()
            season = (query_params.get('season', ['1'])[0] or '1').strip()
            episode = (query_params.get('episode', ['1'])[0] or '1').strip()

            if not content_id or not re.match(r'^[A-Za-z0-9_-]{1,32}$', content_id):
                self._send_json_response(json.dumps({'status': 'error', 'message': 'Invalid or missing content ID'}).encode('utf-8'), 400)
                return
            if not re.match(r'^\d{1,4}$', season) or not re.match(r'^\d{1,4}$', episode):
                self._send_json_response(json.dumps({'status': 'error', 'message': 'Invalid season or episode'}).encode('utf-8'), 400)
                return

            safe_id = urllib.parse.quote(content_id, safe='')
            if media_type == 'tv':
                target_urls = [
                    f'https://vidlink.pro/tv/{safe_id}/{season}/{episode}',
                    f'https://vidsrc.to/embed/tv/{safe_id}/{season}/{episode}',
                    f'https://player.videasy.net/tv/{safe_id}/{season}/{episode}'
                ]
            else:
                target_urls = [
                    f'https://vidlink.pro/movie/{safe_id}',
                    f'https://vidsrc.to/embed/movie/{safe_id}',
                    f'https://player.videasy.net/movie/{safe_id}'
                ]

            headers = {
                'User-Agent': StreamProxyService.CHROME_UA,
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9'
            }

            extracted_stream = None
            for target_url in target_urls:
                if not URL_GUARD.is_safe_url(target_url):
                    continue
                try:
                    req = urllib.request.Request(target_url, headers=headers)
                    with _PROXY_OPENER.open(req, timeout=4) as response:
                        html = response.read(2 * 1024 * 1024).decode('utf-8', errors='ignore')
                        matches = (
                            re.findall(r'(https?://[^\s\'"<>]+?\.m3u8[^\s\'"<>]*?)(?:[\s\'"<>]|$)', html)
                            + re.findall(r'(https?://[^\s\'"<>]+?\.mp4[^\s\'"<>]*?)(?:[\s\'"<>]|$)', html)
                        )
                        if matches:
                            extracted_stream = matches[0]
                            break
                        json_matches = re.findall(r'"(?:file|url|stream|source)":\s*"(https?://[^"]+)"', html)
                        if json_matches:
                            extracted_stream = json_matches[0]
                            break
                except Exception as ex:
                    sys.stderr.write(f"[IVIDS] Resolver warning for {target_url}: {str(ex)}\n")
                    continue

            if extracted_stream:
                proxied_url = f'/proxy?url={urllib.parse.quote(extracted_stream, safe="")}'
                body = json.dumps({'status': 'success', 'streamUrl': proxied_url, 'rawUrl': extracted_stream}).encode('utf-8')
                self._send_json_response(body, 200)
            else:
                body = json.dumps({'status': 'error', 'message': 'No direct stream extracted; falling back to sandboxed iframe'}).encode('utf-8')
                self._send_json_response(body, 200)
        except Exception:
            self._send_json_response(json.dumps({'status': 'error', 'message': 'Stream resolution failed'}).encode('utf-8'), 500)

    def _extract_rd_token(self, qs):
        """Reads Real-Debrid API key from X-RD-Token header first, falling back to query param."""
        header_tok = (self.headers.get('X-RD-Token') or '').strip()
        if header_tok:
            return header_tok
        return (qs.get('token', [''])[0] or '').strip()

    def _handle_debrid_status(self):
        """Reports whether a local .env Real-Debrid backup token exists and has active Premium status."""
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        user_token = self._extract_rd_token(qs)
        env_token = DEBRID_SERVICE.get_backup_token()
        active_token = user_token or env_token
        has_premium = DEBRID_SERVICE.check_premium(active_token) if active_token else False
        body = json.dumps({'envConfigured': bool(env_token), 'hasPremium': has_premium}).encode('utf-8')
        self._send_json_response(body, 200)

    def _handle_debrid_streams(self):
        """Queries a Stremio addon manifest stream endpoint via DebridService over verified HTTPS."""
        try:
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            addon_base = (qs.get('addonBase', [''])[0] or '').strip()
            media_type = (qs.get('type', ['movie'])[0] or 'movie').strip()
            stream_id = (qs.get('id', [''])[0] or '').strip()
            no_token = (qs.get('noToken', ['0'])[0] or '0').strip() == '1'
            user_token = self._extract_rd_token(qs)
            token = '' if no_token else (user_token or DEBRID_SERVICE.get_backup_token())

            if not addon_base or not stream_id:
                self._send_json_response(json.dumps({'streams': [], 'error': 'Missing addonBase or id'}).encode('utf-8'), 400)
                return

            if media_type not in ('movie', 'series'):
                media_type = 'series' if media_type == 'tv' else 'movie'

            streams, err_msg = DEBRID_SERVICE.fetch_stremio_streams(addon_base, media_type, stream_id, token)
            if err_msg:
                self._send_json_response(json.dumps({'streams': [], 'error': err_msg}).encode('utf-8'), 403)
                return
            self._send_json_response(json.dumps({'streams': streams}).encode('utf-8'), 200)
        except Exception as e:
            sys.stderr.write(f"[IVIDS] Debrid stream lookup error: {str(e)}\n")
            self._send_json_response(json.dumps({'streams': [], 'error': 'Addon stream lookup failed'}).encode('utf-8'), 200)

    def _handle_debrid_resolve(self):
        """Resolves a direct Real-Debrid link or cached torrent infoHash via DebridService."""
        try:
            payload = self._read_json_body(65536)
            if payload is None:
                return
            action = (payload.get('action') or 'unrestrict').strip()
            token = (payload.get('token') or '').strip() or DEBRID_SERVICE.get_backup_token()
            if not token:
                self._send_json_response(json.dumps({'status': 'error', 'message': 'No Real-Debrid API key configured'}).encode('utf-8'), 400)
                return

            if action == 'unrestrict':
                link = (payload.get('link') or '').strip()
                if not link or not link.startswith(('http://', 'https://')):
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'Invalid link'}).encode('utf-8'), 400)
                    return
                res = DEBRID_SERVICE.rd_api_request('/unrestrict/link', token, method='POST', form_data={'link': link})
                download_url = res.get('download')
                if download_url:
                    self._send_json_response(json.dumps({'status': 'success', 'url': download_url, 'filename': res.get('filename', '')}).encode('utf-8'), 200)
                    return
                self._send_json_response(json.dumps({'status': 'error', 'message': res.get('error', 'Failed to unrestrict')}).encode('utf-8'), 200)
                return

            if action == 'magnet':
                info_hash = (payload.get('infoHash') or '').strip().lower()
                file_idx = payload.get('fileIdx')
                if not re.match(r'^[a-f0-9]{40}$', info_hash):
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'Invalid infoHash'}).encode('utf-8'), 400)
                    return

                magnet = f'magnet:?xt=urn:btih:{info_hash}'
                added = DEBRID_SERVICE.rd_api_request('/torrents/addMagnet', token, method='POST', form_data={'magnet': magnet})
                torrent_id = added.get('id')
                if not torrent_id:
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'addMagnet failed'}).encode('utf-8'), 200)
                    return

                info = DEBRID_SERVICE.rd_api_request(f'/torrents/info/{torrent_id}', token)
                files = info.get('files') or []
                video_exts = ('.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v')
                selected_id = None
                if file_idx is not None:
                    try:
                        target_idx = int(file_idx)
                        if 0 <= target_idx < len(files):
                            selected_id = files[target_idx].get('id')
                    except (TypeError, ValueError):
                        selected_id = None
                if not selected_id:
                    video_files = [f for f in files if str(f.get('path', '')).lower().endswith(video_exts)]
                    pick_pool = video_files or files
                    if pick_pool:
                        selected_id = max(pick_pool, key=lambda f: f.get('bytes', 0)).get('id')

                if not selected_id:
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'No video file in torrent'}).encode('utf-8'), 200)
                    return

                DEBRID_SERVICE.rd_api_request(f'/torrents/selectFiles/{torrent_id}', token, method='POST', form_data={'files': str(selected_id)})
                info_after = DEBRID_SERVICE.rd_api_request(f'/torrents/info/{torrent_id}', token)
                links = info_after.get('links') or []
                if not links:
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'Torrent not instantly cached on Real-Debrid'}).encode('utf-8'), 200)
                    return

                unrestricted = DEBRID_SERVICE.rd_api_request('/unrestrict/link', token, method='POST', form_data={'link': links[0]})
                download_url = unrestricted.get('download')
                if download_url:
                    self._send_json_response(json.dumps({'status': 'success', 'url': download_url, 'filename': unrestricted.get('filename', '')}).encode('utf-8'), 200)
                    return
                self._send_json_response(json.dumps({'status': 'error', 'message': 'Unrestrict failed'}).encode('utf-8'), 200)
                return

            self._send_json_response(json.dumps({'status': 'error', 'message': 'Unsupported action'}).encode('utf-8'), 400)
        except Exception as e:
            sys.stderr.write(f"[IVIDS] Debrid resolve error: {str(e)}\n")
            self._send_json_response(json.dumps({'status': 'error', 'message': 'Debrid resolution failed'}).encode('utf-8'), 200)

    def _send_json_response(self, body, status_code=200):
        """Sends a JSON byte payload with standard CORS and single no-store Cache-Control header."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        self._cache_control_set = True
        self.end_headers()
        self.wfile.write(body)

    def _send_proxy_cors_and_cache_headers(self, is_m3u8, target_path_lower, expose_headers):
        """Appends CORS headers and single-value Cache-Control policy for proxied media responses."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Expose-Headers', expose_headers)
        if not is_m3u8 and '.m3u' in target_path_lower:
            self.send_header('Cache-Control', 'public, max-age=7200')
        else:
            self.send_header('Cache-Control', 'no-store')
        self._cache_control_set = True

    def _handle_post_broken_channels(self):
        """Validates a posted URL and records it atomically via BROKEN_CHANNELS_STORE."""
        try:
            payload = self._read_json_body(MAX_BROKEN_CHANNEL_BODY_BYTES)
            if payload is None:
                return

            url = payload.get('url')
            if not isinstance(url, str):
                self.send_error(400, 'Invalid url field')
                return

            url = url.strip()
            if not url or len(url) > MAX_BROKEN_CHANNEL_URL_LENGTH or any(ord(c) < 32 or c.isspace() for c in url):
                self.send_error(400, 'Invalid url format')
                return

            parsed_url = urllib.parse.urlparse(url)
            if parsed_url.scheme.lower() not in ('http', 'https') or not parsed_url.hostname:
                self.send_error(400, 'URL must use http or https scheme with a valid host')
                return

            count, limit_reached = BROKEN_CHANNELS_STORE.append_url(url)
            if limit_reached:
                self.send_error(400, 'Broken channels list limit reached')
                return

            self._send_json_response(json.dumps({'ok': True, 'count': count}).encode('utf-8'), 200)
        except Exception:
            self.send_error(500, 'Failed to update broken channels')

    def _handle_webapis_stub(self):
        """
        Serves an empty JavaScript file stub for Tizen's $WEBAPIS to prevent 404 console errors on PC.
        Affects no state; returns static stub content.
        """
        body = b"// Tizen webapis stub for PC"
        self.send_response(200)
        self.send_header('Content-Type', 'application/javascript')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _serve_static_with_compression(self):
        """
        Serves static files with gzip compression using an in-memory mtime cache and ETag 304 support.
        Falls back to standard serving for binary files or if the client does not accept gzip.
        """
        # Check if client accepts gzip
        accept_encoding = self.headers.get('Accept-Encoding', '')
        supports_gzip = 'gzip' in accept_encoding

        if not supports_gzip:
            super().do_GET()
            return

        # Translate the URL path to a local file path
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            super().do_GET()
            return

        # Determine content type
        content_type, _ = mimetypes.guess_type(path)
        if not content_type or content_type not in COMPRESSIBLE_TYPES:
            super().do_GET()
            return

        compressed, etag = STATIC_CACHE.get_compressed(path)
        if compressed is None:
            if not os.path.exists(path):
                self.send_error(404, 'File not found')
            else:
                super().do_GET()
            return

        # Handle conditional 304 Not Modified requests
        if_none_match = self.headers.get('If-None-Match')
        if if_none_match and if_none_match == etag:
            self.send_response(304)
            self.send_header('ETag', etag)
            self.send_header('Vary', 'Accept-Encoding')
            self.end_headers()
            return

        # Set vendor caching for known stable files (e.g. hls.min.js)
        basename = os.path.basename(path)
        if basename in VENDOR_PATTERNS:
            self._cache_control_set = True
            self.send_response(200)
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_response(200)

        self.send_header('Content-Type', content_type)
        self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(compressed)))
        self.send_header('ETag', etag)
        self.send_header('Vary', 'Accept-Encoding')
        self.end_headers()
        self.wfile.write(compressed)

    def _handle_proxy(self):
        """
        Reverse proxy handler that validates target URLs against SSRF and fetches content.
        Enforces a maximum body size, decompresses gzip EPG data, and rewrites M3U8 links.
        """
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        target_url = query.get('url', [None])[0]

        if not target_url:
            self.send_error(400, 'Missing url parameter')
            return

        parsed_target = urllib.parse.urlparse(target_url)
        target_host = (parsed_target.hostname or '').lower()
        if STREAM_PROXY.is_dead_host(target_host):
            self.send_error(502, f'Host unreachable (cached): {target_host}')
            return

        url_status = URL_GUARD.classify_url(target_url)
        if url_status == 'dns_error':
            STREAM_PROXY.mark_dead_host(target_host)
            self.send_error(502, f'Host lookup failed: {target_host}')
            return
        if url_status != 'ok':
            self.send_error(403, 'Forbidden target URL')
            return

        try:
            self._proxy_headers_sent = False
            referer = query.get('referer', [None])[0]
            origin = query.get('origin', [None])[0]
            user_agent = query.get('user-agent', query.get('userAgent', [None]))[0]

            target_lower = target_url.lower()
            if not referer or not origin:
                if any(k in target_lower for k in ('daddylive', 'dlhd', 'daddyhd')):
                    referer = referer or 'https://daddylive.mp/'
                    origin = origin or 'https://daddylive.mp'
                elif 'sportshub' in target_lower:
                    referer = referer or 'https://sportshub.stream/'
                    origin = origin or 'https://sportshub.stream'
                elif '1stream' in target_lower:
                    referer = referer or 'https://1stream.top/'
                    origin = origin or 'https://1stream.top'
                elif 'canal' in target_lower or 'mycanal' in target_lower:
                    referer = referer or 'https://www.canalplus.com/'
                    origin = origin or 'https://www.canalplus.com'

            chrome_ua = StreamProxyService.CHROME_UA
            vlc_ua = StreamProxyService.VLC_UA
            if not user_agent:
                user_agent = chrome_ua

            target_origin = f"{parsed_target.scheme}://{parsed_target.netloc}" if parsed_target.scheme and parsed_target.netloc else None
            is_raw_iptv = bool(re.search(r'^https?://\d+\.\d+\.\d+\.\d+|:(?:8008|8080|8880|25461|1935)/|/play/[a-z0-9]+', target_lower))
            first_ua = vlc_ua if (is_raw_iptv and not query.get('user-agent')) else user_agent
            profiles = [
                (first_ua, referer, origin),
                (vlc_ua, None, None),
                (chrome_ua, f"{target_origin}/" if target_origin else referer, target_origin or origin),
                ('Lavf/60.3.100', None, None)
            ]
            incoming_range = self.headers.get('Range')
            response = None
            last_http_err = None
            for prof_ua, prof_ref, prof_orig in profiles:
                req = urllib.request.Request(target_url)
                req.add_header('User-Agent', prof_ua)
                if prof_ref:
                    req.add_header('Referer', prof_ref)
                if prof_orig:
                    req.add_header('Origin', prof_orig)
                if incoming_range:
                    req.add_header('Range', incoming_range)
                req.add_header('Accept', '*/*')
                try:
                    response = _PROXY_OPENER.open(req, timeout=8)
                    user_agent, referer, origin = prof_ua, prof_ref, prof_orig
                    break
                except ForbiddenRedirectError:
                    raise
                except urllib.error.HTTPError as he:
                    last_http_err = he
                    if he.code in (401, 403, 406):
                        continue
                    raise
            if response is None and last_http_err is not None:
                raise last_http_err
            with response:
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
                upstream_status = getattr(response, 'status', 200) or 200
                final_url = response.geturl() if hasattr(response, 'geturl') else target_url

                parsed_target = urllib.parse.urlparse(final_url or target_url)
                target_path_lower = parsed_target.path.lower()

                if content_type.lower() in ('application/force-download', 'application/octet-stream', 'binary/octet-stream'):
                    if target_path_lower.endswith(('.mp4', '.m4v')):
                        content_type = 'video/mp4'
                    elif target_path_lower.endswith('.mkv'):
                        content_type = 'video/x-matroska'
                    elif target_path_lower.endswith('.webm'):
                        content_type = 'video/webm'

                is_m3u8 = target_path_lower.endswith('.m3u8') or 'mpegurl' in content_type.lower()
                is_partial_or_video = (upstream_status == 206) or content_type.lower().startswith('video/')

                first_chunk = b'' if is_partial_or_video else response.read(65536)

                is_gzip = False
                if first_chunk:
                    is_gzip = (
                        target_path_lower.endswith('.gz') or 
                        response.headers.get('Content-Encoding') == 'gzip' or 
                        first_chunk.startswith(b'\x1f\x8b')
                    )

                if (is_m3u8 or is_gzip) and upstream_status != 206:
                    # Limit size and read the rest in chunks (MAX_PROXY_RESPONSE_SIZE = 50 MB)
                    MAX_PROXY_RESPONSE_SIZE = 50 * 1024 * 1024
                    body_parts = [first_chunk] if first_chunk else []
                    total_read = len(first_chunk)
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        total_read += len(chunk)
                        if total_read > MAX_PROXY_RESPONSE_SIZE:
                            self.send_error(413, 'Payload Too Large')
                            return
                        body_parts.append(chunk)
                    body = b''.join(body_parts)

                    # Decompress gzip files if needed
                    if is_gzip:
                        try:
                            body = gzip.decompress(body)
                            content_type = 'application/xml'
                        except Exception as e:
                            sys.stderr.write(f"[IVIDS] Failed to decompress gzip: {str(e)}\n")

                    # Rewrite .m3u8 manifests so sub-resources also proxy
                    if is_m3u8:
                        text = body.decode('utf-8', errors='replace')
                        proxy_prefix = f'/proxy?url='
                        extra_params = ''
                        if referer:
                            extra_params += f'&referer={urllib.parse.quote(referer, safe="")}'
                        if origin:
                            extra_params += f'&origin={urllib.parse.quote(origin, safe="")}'
                        if user_agent:
                            extra_params += f'&user-agent={urllib.parse.quote(user_agent, safe="")}'
                        text = rewrite_m3u8(text, final_url or target_url, proxy_prefix, extra_params)
                        body = text.encode('utf-8')
                        content_type = 'application/vnd.apple.mpegurl'

                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(body)))
                    self.send_header('X-Final-Url', final_url or target_url)
                    self._send_proxy_cors_and_cache_headers(is_m3u8, target_path_lower, 'Content-Length, Content-Range, Accept-Ranges, X-Final-Url')
                    self.end_headers()
                    self._proxy_headers_sent = True
                    self.wfile.write(body)
                else:
                    # Stream directly to client preserving 206 Partial Content and Content-Range for seeking
                    self.send_response(upstream_status)
                    self.send_header('Content-Type', content_type)
                    upstream_len = response.headers.get('Content-Length')
                    if upstream_len:
                        self.send_header('Content-Length', upstream_len)
                    content_range = response.headers.get('Content-Range')
                    if content_range:
                        self.send_header('Content-Range', content_range)
                    accept_ranges = response.headers.get('Accept-Ranges')
                    if accept_ranges or content_range or content_type.lower().startswith('video/'):
                        self.send_header('Accept-Ranges', accept_ranges or 'bytes')
                    self._send_proxy_cors_and_cache_headers(is_m3u8, target_path_lower, 'Content-Length, Content-Range, Accept-Ranges')
                    self.end_headers()
                    self._proxy_headers_sent = True

                    if first_chunk:
                        self.wfile.write(first_chunk)
                    
                    while True:
                        chunk = response.read(65536)
                        if not chunk:
                            break
                        self.wfile.write(chunk)

        except urllib.error.HTTPError as e:
            try:
                self.send_error(e.code, f'Upstream error: {e.reason}')
            except Exception as se:
                pass
        except (TimeoutError, urllib.error.URLError) as e:
            reason_str = str(getattr(e, 'reason', e)).lower()
            if target_host and ('getaddrinfo' in reason_str or '11001' in reason_str):
                STREAM_PROXY.mark_dead_host(target_host)
            try:
                self.send_error(504 if 'timed out' in reason_str else 502, f'Proxy connection failed: {reason_str}')
            except Exception:
                pass
        except (ConnectionError, OSError) as e:
            # Client connection aborted, reset, or closed gracefully
            if not getattr(self, '_proxy_headers_sent', False):
                try:
                    self.send_error(502, f'Upstream connection failed: {str(e)}')
                except Exception:
                    pass
        except Exception as e:
            try:
                self.send_error(500, f'Proxy error: {str(e)}')
            except Exception as se:
                sys.stderr.write(f"[IVIDS] Failed to send error response to client: {str(se)}\n")

    def end_headers(self):
        """
        Injects no-cache headers for development unless a handler explicitly set Cache-Control.
        Uses an instance flag instead of the broken _headers attribute check.
        """
        if not self._cache_control_set:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        # Reset flag for next request
        self._cache_control_set = False
        super().end_headers()

    def log_message(self, format, *args):
        """
        Suppresses verbose successful HTTP request logs to keep the terminal clean.
        Only logs requests that result in error status codes (>= 400) to assist in debugging.
        """
        try:
            status_code = int(args[1])
            if status_code >= 400:
                sys.stderr.write(f"[IVIDS] {format % args}\n")
        except (IndexError, ValueError):
            pass


class QuietThreadingHTTPServer(ThreadingHTTPServer):
    """
    Threaded HTTP Server that suppresses noisy tracebacks when video clients
    abort connections during rapid channel zapping (WSAECONNABORTED / WinError 10053).
    """
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        exc_type, exc_val, _ = sys.exc_info()
        if exc_type in (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, TimeoutError):
            return
        if isinstance(exc_val, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError, TimeoutError, OSError)):
            return
        super().handle_error(request, client_address)


def start_server():
    """
    Initializes and starts the threaded HTTP server on an available port, opening the browser to the interface.
    Gracefully handles port conflicts by auto-incrementing and shuts down on keyboard interrupts.
    """
    # Change working directory to the assets directory to ensure correct path resolution
    os.chdir(ASSETS_DIR)

    port = PORT
    QuietThreadingHTTPServer.allow_reuse_address = True
    while True:
        try:
            server = QuietThreadingHTTPServer(("127.0.0.1", port), IVIDSHTTPRequestHandler)
            break
        except OSError:
            if port >= PORT + 40:
                raise
            port += 1

    url = f"http://localhost:{port}/"
    print("=" * 60)
    print("                  IVIDS PC UI TEST SERVER")
    print("=" * 60)
    print(f"Server is running at: http://localhost:{port}/")
    print(f"CORS Proxy available: http://localhost:{port}/proxy?url=<stream_url>")
    print(f"Opening browser to:   {url}")
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)

    # Open default web browser after starting the server
    try:
        if sys.platform == 'win32':
            # Use a separate shell subprocess on Windows to isolate native ShellExecute crashes (0x80000003) from Python
            import subprocess
            subprocess.Popen(f'start {url}', shell=True)
        else:
            webbrowser.open(url)
    except Exception as e:
        print(f"Warning: Could not open browser automatically: {e}", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()
        print("Server stopped. Goodbye!")


if __name__ == '__main__':
    start_server()
