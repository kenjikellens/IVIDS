import http.server
import os
import webbrowser
import sys
import urllib.request
import urllib.parse
import urllib.error
import re
import io
import gzip
import json
import mimetypes
import socket
import ipaddress
import threading
from http.server import ThreadingHTTPServer
import ssl
import time

# Unverified SSL context to allow video stream CDN endpoints with domain/wildcard mismatches
_UNVERIFIED_SSL_CTX = ssl._create_unverified_context()

# Memory cache for dead hostnames (DNS getaddrinfo failures) with 30-second TTL
_DEAD_HOSTS = {}

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


# Define preferred port and target assets directory
PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.abspath(os.path.join(BASE_DIR, 'app', 'src', 'main', 'assets', 'main'))
BROKEN_CHANNELS_PATH = os.path.join(ASSETS_DIR, 'logic', 'livetv', 'broken-channels.json')
ENV_FILE_PATH = os.path.join(BASE_DIR, '.env')


def _load_local_env():
    """
    Loads key=value pairs from the local gitignored .env file without modifying global logs.
    """
    env_map = {}
    if not os.path.isfile(ENV_FILE_PATH):
        return env_map
    try:
        with open(ENV_FILE_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                stripped = line.strip()
                if not stripped or stripped.startswith('#') or '=' not in stripped:
                    continue
                k, v = stripped.split('=', 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k:
                    env_map[k] = v
    except Exception:
        pass
    return env_map


def _get_debrid_backup_token():
    """
    Returns the Real-Debrid API token from environment or local .env backup file.
    """
    return (os.environ.get('REAL_DEBRID_API_KEY') or _load_local_env().get('REAL_DEBRID_API_KEY') or '').strip()


def resolve_url(base_url, relative_url):
    """
    Resolves a potentially relative URL against a base URL.
    Returns the absolute URL needed for proxying sub-resources in .m3u8 manifests.
    """
    if relative_url.startswith('http://') or relative_url.startswith('https://'):
        return relative_url
    return urllib.parse.urljoin(base_url, relative_url)


def rewrite_m3u8(content, base_url, proxy_prefix, extra_query=''):
    """
    Rewrites relative and absolute URLs inside .m3u8 manifest content so that
    sub-playlists and .ts segment requests also route through the local CORS proxy.
    """
    lines = content.split('\n')
    rewritten = []
    suffix = extra_query if extra_query else ''
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            # Check for URI= attributes inside EXT-X tags (e.g. encryption key URLs)
            if 'URI="' in stripped:
                def replace_uri(match):
                    """Replaces URI attribute values with proxied equivalents."""
                    uri = match.group(1)
                    absolute = resolve_url(base_url, uri)
                    return f'URI="{proxy_prefix}{urllib.parse.quote(absolute, safe="")}{suffix}"'
                stripped = re.sub(r'URI="([^"]*)"', replace_uri, stripped)
            rewritten.append(stripped)
        else:
            # This is a URL line (playlist or segment)
            absolute = resolve_url(base_url, stripped)
            rewritten.append(f'{proxy_prefix}{urllib.parse.quote(absolute, safe="")}{suffix}')
    return '\n'.join(rewritten)


# Thread-safe TTL cache for validated hostnames: {hostname_lower: (is_safe, expires_at)}
_SAFE_HOST_CACHE = {}
_SAFE_HOST_CACHE_LOCK = threading.Lock()
_CGNAT_NETWORK = ipaddress.ip_network('100.64.0.0/10')
_ZERO_NETWORK = ipaddress.ip_network('0.0.0.0/8')
MAX_BROKEN_CHANNEL_BODY_BYTES = 16384
MAX_BROKEN_CHANNEL_URL_LENGTH = 2048
MAX_BROKEN_CHANNELS = 5000


def _is_public_ip(ip_obj):
    """
    Checks whether an IPv4 or IPv6 address object is a globally routable public address.
    Rejects private, loopback, link-local (metadata), multicast, reserved, unspecified, and CGNAT ranges.
    """
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped is not None:
        return _is_public_ip(ip_obj.ipv4_mapped)
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
        if ip_obj in _CGNAT_NETWORK or ip_obj in _ZERO_NETWORK:
            return False
    return True


def _classify_hostname(hostname_lower):
    """
    Classifies whether a hostname resolves exclusively to public IPs ('ok'),
    fails DNS resolution ('dns_error'), or targets internal/loopback/forbidden hosts ('forbidden').
    """
    try:
        if (
            not hostname_lower
            or hostname_lower in ('localhost', '0.0.0.0', '127.0.0.1', '::1', 'metadata', 'metadata.google.internal')
            or hostname_lower.endswith('.localhost')
        ):
            return 'forbidden'

        now = time.time()
        with _SAFE_HOST_CACHE_LOCK:
            cached = _SAFE_HOST_CACHE.get(hostname_lower)
            if cached and cached[1] > now:
                return cached[0]

        stripped = hostname_lower.strip('[]')
        try:
            ip_obj = ipaddress.ip_address(stripped)
            status = 'ok' if _is_public_ip(ip_obj) else 'forbidden'
            with _SAFE_HOST_CACHE_LOCK:
                _SAFE_HOST_CACHE[hostname_lower] = (status, now + 60.0)
            return status
        except ValueError:
            pass

        try:
            addr_infos = socket.getaddrinfo(hostname_lower, None)
        except socket.gaierror:
            with _SAFE_HOST_CACHE_LOCK:
                _SAFE_HOST_CACHE[hostname_lower] = ('dns_error', now + 10.0)
            return 'dns_error'

        if not addr_infos:
            with _SAFE_HOST_CACHE_LOCK:
                _SAFE_HOST_CACHE[hostname_lower] = ('dns_error', now + 10.0)
            return 'dns_error'

        for info in addr_infos:
            ip_str = info[4][0]
            if '%' in ip_str:
                return 'forbidden'
            ip_obj = ipaddress.ip_address(ip_str)
            if not _is_public_ip(ip_obj):
                with _SAFE_HOST_CACHE_LOCK:
                    _SAFE_HOST_CACHE[hostname_lower] = ('forbidden', now + 60.0)
                return 'forbidden'

        with _SAFE_HOST_CACHE_LOCK:
            if len(_SAFE_HOST_CACHE) > 2048:
                _SAFE_HOST_CACHE.clear()
            _SAFE_HOST_CACHE[hostname_lower] = ('ok', now + 60.0)
        return 'ok'
    except Exception:
        return 'forbidden'


def _classify_proxy_url(url):
    """
    Validates target URL scheme/host for proxy safety, distinguishing DNS failures from SSRF blocks.
    """
    try:
        if not isinstance(url, str):
            return 'forbidden'
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme.lower() not in ('http', 'https'):
            return 'forbidden'
        hostname = parsed.hostname
        if not hostname:
            return 'forbidden'
        return _classify_hostname(hostname.lower())
    except Exception:
        return 'forbidden'


def _is_safe_hostname(hostname_lower):
    """
    Validates if a hostname resolves exclusively to public, non-loopback, non-private IP addresses.
    """
    return _classify_hostname(hostname_lower) == 'ok'


def is_safe_url(url):
    """
    Validates if the target URL has a safe http/https scheme and resolves to public IP addresses only.
    Fails closed on malformed URLs, non-HTTP schemes, or unresolved/internal hostnames.
    """
    return _classify_proxy_url(url) == 'ok'


class ForbiddenRedirectError(urllib.error.HTTPError):
    """Raised when an upstream HTTP redirect attempts to target a forbidden or unsafe SSRF URL."""
    pass


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """
    Custom HTTP redirect handler that validates every redirect Location URL with is_safe_url.
    Prevents SSRF bypasses via 301/302/307/308 redirects to loopback, private, or metadata targets.
    """
    max_redirections = 5

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        """Validates the resolved redirect destination before allowing urllib to follow it."""
        if not is_safe_url(newurl):
            raise ForbiddenRedirectError(newurl, 403, 'Forbidden redirect target', headers, None)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_PROXY_OPENER = urllib.request.build_opener(
    SafeRedirectHandler(),
    urllib.request.HTTPSHandler(context=_UNVERIFIED_SSL_CTX)
)


class StaticFileCache:
    """
    In-memory cache for gzip-compressed static assets.
    Tracks file modification times (mtime) to invalidate entries when files change on disk during development.
    """
    def __init__(self):
        self._cache = {}

    def get_compressed(self, path):
        """
        Retrieves gzip-compressed bytes and ETag for the given file path, refreshing from disk if modified.
        Returns a tuple of (compressed_bytes, etag) or (None, None) if reading fails.
        """
        try:
            mtime = os.path.getmtime(path)
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

            self._cache[path] = (mtime, compressed, etag)
            return compressed, etag
        except Exception:
            return None, None


STATIC_CACHE = StaticFileCache()


_cached_version = None
_cached_version_mtime = 0


def get_app_version():
    """
    Retrieves the application version string from package.json with mtime-based memory caching.
    Avoids reading and parsing package.json from disk on every version polling request.
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


_RD_USER_CACHE = {}

def _check_rd_account_premium(token):
    """
    Checks /rest/1.0/user on api.real-debrid.com with a 120s in-memory cache
    so expired/free Real-Debrid keys can be skipped before loading error MP4s.
    """
    if not token:
        return False
    now = time.time()
    cached = _RD_USER_CACHE.get(token)
    if cached and cached[1] > now:
        return cached[0]
    try:
        req = urllib.request.Request(
            'https://api.real-debrid.com/rest/1.0/user',
            headers={'Authorization': f'Bearer {token}', 'User-Agent': 'IVIDS/1.0'}
        )
        with _PROXY_OPENER.open(req, timeout=5) as resp:
            info = json.loads(resp.read().decode('utf-8', errors='replace'))
            is_prem = bool(info.get('type') == 'premium' or (info.get('premium') or 0) > 0)
            _RD_USER_CACHE[token] = (is_prem, now + 120.0)
            return is_prem
    except Exception:
        _RD_USER_CACHE[token] = (False, now + 30.0)
        return False

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

        return os.path.join(ASSETS_DIR, *parts)

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

    def _handle_get_broken_channels(self):
        """
        Returns the current broken-channels.json file contents as a JSON array.
        Affects no state; serves the file from disk.
        """
        try:
            with open(BROKEN_CHANNELS_PATH, 'r', encoding='utf-8') as f:
                data = f.read()
            body = data.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            body = b'[]'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_error(500, f'Failed to read broken channels: {str(e)}')

    def _handle_get_version(self):
        """
        Retrieves the version string using the cached get_app_version helper.
        Returns the version as a JSON payload without redundant disk I/O on every request.
        """
        try:
            version = get_app_version()
            body = json.dumps({'version': version}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_error(500, f'Failed to read version: {str(e)}')

    def _handle_resolve_stream(self):
        """
        Scrapes and extracts direct .m3u8 or .mp4 video stream URLs from movie and TV show embed sources.
        Returns a JSON object with status and proxied stream URL for clean playback without popups.
        """
        try:
            parsed = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed.query)

            content_id = query_params.get('id', [''])[0]
            media_type = query_params.get('type', ['movie'])[0]
            season = query_params.get('season', ['1'])[0]
            episode = query_params.get('episode', ['1'])[0]

            if not content_id:
                body = json.dumps({'status': 'error', 'message': 'Missing content ID'}).encode('utf-8')
                self._send_json_response(body, 400)
                return

            target_urls = []
            if media_type == 'tv':
                target_urls.append(f'https://vidlink.pro/tv/{content_id}/{season}/{episode}')
                target_urls.append(f'https://vidsrc.to/embed/tv/{content_id}/{season}/{episode}')
                target_urls.append(f'https://player.videasy.net/tv/{content_id}/{season}/{episode}')
            else:
                target_urls.append(f'https://vidlink.pro/movie/{content_id}')
                target_urls.append(f'https://vidsrc.to/embed/movie/{content_id}')
                target_urls.append(f'https://player.videasy.net/movie/{content_id}')

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9'
            }

            extracted_stream = None
            for target_url in target_urls:
                try:
                    req = urllib.request.Request(target_url, headers=headers)
                    with urllib.request.urlopen(req, timeout=4, context=_UNVERIFIED_SSL_CTX) as response:
                        html = response.read().decode('utf-8', errors='ignore')

                        m3u8_matches = re.findall(r'(https?://[^\s\'"<>]+?\.m3u8[^\s\'"<>]*?)(?:[\s\'"<>]|$)', html)
                        mp4_matches = re.findall(r'(https?://[^\s\'"<>]+?\.mp4[^\s\'"<>]*?)(?:[\s\'"<>]|$)', html)

                        matches = m3u8_matches + mp4_matches
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
                body = json.dumps({
                    'status': 'success',
                    'streamUrl': proxied_url,
                    'rawUrl': extracted_stream
                }).encode('utf-8')
                self._send_json_response(body, 200)
            else:
                body = json.dumps({
                    'status': 'error',
                    'message': 'No direct stream extracted; falling back to sandboxed iframe'
                }).encode('utf-8')
                self._send_json_response(body, 200)

        except Exception as e:
            body = json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8')
            self._send_json_response(body, 500)

    def _rd_api_request(self, path, token, method='GET', form_data=None):
        """
        Executes a strict HTTPS call to api.real-debrid.com/rest/1.0 using the provided Bearer token.
        """
        url = f'https://api.real-debrid.com/rest/1.0{path}'
        headers = {
            'Authorization': f'Bearer {token}',
            'User-Agent': 'IVIDS/1.0'
        }
        data_bytes = urllib.parse.urlencode(form_data).encode('utf-8') if form_data is not None else None
        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
        with _PROXY_OPENER.open(req, timeout=10) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
            return json.loads(raw) if raw else {}

    def _build_stremio_addon_stream_url(self, addon_base, media_type, stream_id, token):
        """
        Constructs a Stremio addon /stream/{type}/{id}.json URL, encoding Real-Debrid config
        when bare public addon origins (e.g. torrentio.strem.fun) are supplied without manifest config.
        """
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
                import base64
                cfg_obj = {'debridService': 'realdebrid', 'debridApiKey': token}
                b64 = base64.b64encode(json.dumps(cfg_obj, separators=(',', ':')).encode('utf-8')).decode('ascii')
                cleaned = f'{cleaned}/{b64}'
        return f'{cleaned}/stream/{urllib.parse.quote(media_type)}/{urllib.parse.quote(stream_id)}.json'

    def _handle_debrid_status(self):
        """
        Reports whether a local .env Real-Debrid backup token exists and has active Premium status.
        """
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        user_token = (qs.get('token', [''])[0] or '').strip()
        env_token = _get_debrid_backup_token()
        has_env = bool(env_token)
        active_token = user_token or env_token
        has_premium = _check_rd_account_premium(active_token) if active_token else False
        body = json.dumps({'envConfigured': has_env, 'hasPremium': has_premium}).encode('utf-8')
        self._send_json_response(body, 200)

    def _handle_debrid_streams(self):
        """
        Queries a Stremio addon manifest stream endpoint server-side using either the supplied token
        or the local .env Real-Debrid backup token (unless noToken=1 for free HTTP addons).
        """
        try:
            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)
            addon_base = (qs.get('addonBase', [''])[0] or '').strip()
            media_type = (qs.get('type', ['movie'])[0] or 'movie').strip()
            stream_id = (qs.get('id', [''])[0] or '').strip()
            no_token = (qs.get('noToken', ['0'])[0] or '0').strip() == '1'
            user_token = (qs.get('token', [''])[0] or '').strip()
            token = '' if no_token else (user_token or _get_debrid_backup_token())

            if not addon_base or not stream_id:
                self._send_json_response(json.dumps({'streams': [], 'error': 'Missing addonBase or id'}).encode('utf-8'), 400)
                return

            if media_type not in ('movie', 'series'):
                media_type = 'series' if media_type == 'tv' else 'movie'

            target_url = self._build_stremio_addon_stream_url(addon_base, media_type, stream_id, token)
            if _classify_proxy_url(target_url) != 'ok':
                self._send_json_response(json.dumps({'streams': [], 'error': 'Forbidden addon URL'}).encode('utf-8'), 403)
                return

            req = urllib.request.Request(target_url, headers={'User-Agent': 'IVIDS/1.0', 'Accept': 'application/json'})
            with _PROXY_OPENER.open(req, timeout=8) as resp:
                raw = resp.read(4 * 1024 * 1024).decode('utf-8', errors='replace')
                data = json.loads(raw)
                streams = data.get('streams', []) if isinstance(data, dict) else []
                self._send_json_response(json.dumps({'streams': streams}).encode('utf-8'), 200)
        except Exception as e:
            self._send_json_response(json.dumps({'streams': [], 'error': str(e)}).encode('utf-8'), 200)

    def _handle_debrid_resolve(self):
        """
        Resolves a direct Real-Debrid link or cached torrent infoHash to a playable direct HTTPS URL
        via api.real-debrid.com using the Settings token or local .env backup token.
        """
        try:
            raw_len = self.headers.get('Content-Length')
            content_length = int(raw_len) if raw_len else 0
            if content_length <= 0 or content_length > 65536:
                self._send_json_response(json.dumps({'status': 'error', 'message': 'Invalid body size'}).encode('utf-8'), 400)
                return

            payload = json.loads(self.rfile.read(content_length).decode('utf-8'))
            action = (payload.get('action') or 'unrestrict').strip()
            token = (payload.get('token') or '').strip() or _get_debrid_backup_token()
            if not token:
                self._send_json_response(json.dumps({'status': 'error', 'message': 'No Real-Debrid API key configured'}).encode('utf-8'), 400)
                return

            if action == 'unrestrict':
                link = (payload.get('link') or '').strip()
                if not link or not link.startswith(('http://', 'https://')):
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'Invalid link'}).encode('utf-8'), 400)
                    return
                res = self._rd_api_request('/unrestrict/link', token, method='POST', form_data={'link': link})
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
                added = self._rd_api_request('/torrents/addMagnet', token, method='POST', form_data={'magnet': magnet})
                torrent_id = added.get('id')
                if not torrent_id:
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'addMagnet failed'}).encode('utf-8'), 200)
                    return

                info = self._rd_api_request(f'/torrents/info/{torrent_id}', token)
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
                        best_file = max(pick_pool, key=lambda f: f.get('bytes', 0))
                        selected_id = best_file.get('id')

                if not selected_id:
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'No video file in torrent'}).encode('utf-8'), 200)
                    return

                self._rd_api_request(f'/torrents/selectFiles/{torrent_id}', token, method='POST', form_data={'files': str(selected_id)})
                info_after = self._rd_api_request(f'/torrents/info/{torrent_id}', token)
                links = info_after.get('links') or []
                if not links:
                    self._send_json_response(json.dumps({'status': 'error', 'message': 'Torrent not instantly cached on Real-Debrid'}).encode('utf-8'), 200)
                    return

                unrestricted = self._rd_api_request('/unrestrict/link', token, method='POST', form_data={'link': links[0]})
                download_url = unrestricted.get('download')
                if download_url:
                    self._send_json_response(json.dumps({'status': 'success', 'url': download_url, 'filename': unrestricted.get('filename', '')}).encode('utf-8'), 200)
                    return
                self._send_json_response(json.dumps({'status': 'error', 'message': 'Unrestrict failed'}).encode('utf-8'), 200)
                return

            self._send_json_response(json.dumps({'status': 'error', 'message': 'Unsupported action'}).encode('utf-8'), 400)
        except Exception as e:
            self._send_json_response(json.dumps({'status': 'error', 'message': str(e)}).encode('utf-8'), 200)

    def _send_json_response(self, body, status_code=200):
        """Helper to send JSON response with standard CORS headers."""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _handle_post_broken_channels(self):
        """
        Accepts a bounded JSON body with a valid http/https 'url' field and records it in broken-channels.json.
        Validates payload size, JSON structure, URL format, and list capacity before persisting to disk.
        """
        try:
            raw_len = self.headers.get('Content-Length')
            if raw_len is None:
                self.send_error(400, 'Missing Content-Length')
                return
            try:
                content_length = int(raw_len)
            except ValueError:
                self.send_error(400, 'Invalid Content-Length')
                return

            if content_length <= 0:
                self.send_error(400, 'Empty request body')
                return
            if content_length > MAX_BROKEN_CHANNEL_BODY_BYTES:
                self.send_error(413, 'Request body too large')
                return

            raw_body = self.rfile.read(content_length)
            try:
                payload = json.loads(raw_body.decode('utf-8'))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.send_error(400, 'Invalid JSON payload')
                return

            if not isinstance(payload, dict):
                self.send_error(400, 'JSON payload must be an object')
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

            # Read current list
            try:
                with open(BROKEN_CHANNELS_PATH, 'r', encoding='utf-8') as f:
                    broken_list = json.load(f)
                if not isinstance(broken_list, list):
                    broken_list = []
            except (FileNotFoundError, json.JSONDecodeError):
                broken_list = []

            # Only append if not already present and within max bounds
            if url not in broken_list:
                if len(broken_list) >= MAX_BROKEN_CHANNELS:
                    self.send_error(400, 'Broken channels list limit reached')
                    return
                broken_list.append(url)
                with open(BROKEN_CHANNELS_PATH, 'w', encoding='utf-8') as f:
                    json.dump(broken_list, f, indent=2)
                sys.stderr.write(f"[IVIDS] Added broken channel: {url[:80]}...\n")

            body = json.dumps({'ok': True, 'count': len(broken_list)}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.end_headers()
            self.wfile.write(body)

        except Exception as e:
            self.send_error(500, f'Failed to update broken channels: {str(e)}')

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
        now = time.time()
        if target_host and target_host in _DEAD_HOSTS:
            if now - _DEAD_HOSTS[target_host] < 30.0:
                self.send_error(502, f'Host unreachable (cached): {target_host}')
                return
            else:
                del _DEAD_HOSTS[target_host]

        url_status = _classify_proxy_url(target_url)
        if url_status == 'dns_error':
            if target_host:
                _DEAD_HOSTS[target_host] = time.time()
            self.send_error(502, f'Host lookup failed: {target_host}')
            return
        if url_status != 'ok':
            self.send_error(403, 'Forbidden target URL')
            return

        try:
            self._proxy_headers_sent = False
            req = urllib.request.Request(target_url)
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

            if not user_agent:
                user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

            req.add_header('User-Agent', user_agent)
            if referer:
                req.add_header('Referer', referer)
            if origin:
                req.add_header('Origin', origin)
            req.add_header('Accept', '*/*')

            chrome_ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            vlc_ua = 'VLC/3.0.20 LibVLC/3.0.20'
            parsed_t = urllib.parse.urlparse(target_url)
            target_origin = f"{parsed_t.scheme}://{parsed_t.netloc}" if parsed_t.scheme and parsed_t.netloc else None
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
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', '*')
                    self.send_header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, X-Final-Url')
                    if not is_m3u8 and '.m3u' in target_path_lower:
                        self.send_header('Cache-Control', 'public, max-age=7200')
                    else:
                        self.send_header('Cache-Control', 'no-store')
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
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', '*')
                    self.send_header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
                    if not is_m3u8 and '.m3u' in target_path_lower:
                        self.send_header('Cache-Control', 'public, max-age=7200')
                    else:
                        self.send_header('Cache-Control', 'no-store')
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
                _DEAD_HOSTS[target_host] = time.time()
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
