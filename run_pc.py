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
from http.server import ThreadingHTTPServer

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
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'app', 'src', 'main', 'assets', 'main'))
BROKEN_CHANNELS_PATH = os.path.join(ASSETS_DIR, 'logic', 'livetv', 'broken-channels.json')


def resolve_url(base_url, relative_url):
    """
    Resolves a potentially relative URL against a base URL.
    Returns the absolute URL needed for proxying sub-resources in .m3u8 manifests.
    """
    if relative_url.startswith('http://') or relative_url.startswith('https://'):
        return relative_url
    return urllib.parse.urljoin(base_url, relative_url)


def rewrite_m3u8(content, base_url, proxy_prefix):
    """
    Rewrites relative and absolute URLs inside .m3u8 manifest content so that
    sub-playlists and .ts segment requests also route through the local CORS proxy.
    """
    lines = content.split('\n')
    rewritten = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            # Check for URI= attributes inside EXT-X tags (e.g. encryption key URLs)
            if 'URI="' in stripped:
                def replace_uri(match):
                    """Replaces URI attribute values with proxied equivalents."""
                    uri = match.group(1)
                    absolute = resolve_url(base_url, uri)
                    return f'URI="{proxy_prefix}{urllib.parse.quote(absolute, safe="")}"'
                stripped = re.sub(r'URI="([^"]*)"', replace_uri, stripped)
            rewritten.append(stripped)
        else:
            # This is a URL line (playlist or segment)
            absolute = resolve_url(base_url, stripped)
            rewritten.append(f'{proxy_prefix}{urllib.parse.quote(absolute, safe="")}')
    return '\n'.join(rewritten)


def is_safe_url(url):
    """
    Validates if the target URL has a safe http/https scheme and resolves to a public, non-loopback IP address.
    Returns True if the URL is safe and resolves to a public IP, False otherwise.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
        
        hostname_lower = hostname.lower()
        if hostname_lower in ('localhost', '0.0.0.0', '127.0.0.1', '::1'):
            return False
        
        ip = socket.gethostbyname(hostname)
        ip_obj = ipaddress.ip_address(ip)
        
        if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_unspecified:
            return False
            
        return True
    except Exception:
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
        Handles HTTP POST requests. Routes /api/broken-channels to the broken channel persistence handler.
        """
        parsed_path = urllib.parse.urlparse(self.path).path
        if parsed_path == '/api/broken-channels':
            self._handle_post_broken_channels()
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
        Retrieves the version string from the workspace package.json file securely.
        Ensures the file is within the project root and returns the version as a JSON payload.
        """
        try:
            project_root = os.path.abspath(os.path.dirname(__file__))
            package_json_path = os.path.abspath(os.path.join(project_root, 'package.json'))
            
            # Prevent path traversal outside the project directory
            if os.path.commonpath([project_root, package_json_path]) != project_root:
                self.send_error(403, 'Forbidden path')
                return

            with open(package_json_path, 'r', encoding='utf-8') as f:
                pkg = json.load(f)
            version = pkg.get('version', '0.4.1')
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
                    with urllib.request.urlopen(req, timeout=5) as response:
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
        Accepts a JSON body with a 'url' field, appends it to the broken-channels.json file.
        Prevents duplicate entries. Affects the broken-channels.json project file on disk.
        """
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode('utf-8'))
            url = payload.get('url')

            if not url:
                self.send_error(400, 'Missing url field')
                return

            # Read current list
            try:
                with open(BROKEN_CHANNELS_PATH, 'r', encoding='utf-8') as f:
                    broken_list = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                broken_list = []

            # Only append if not already present
            if url not in broken_list:
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
        Serves static files with gzip compression for text-based content types.
        Falls back to standard serving for binary files or if the client doesn't accept gzip.
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

        # Read, compress, and serve the file
        try:
            with open(path, 'rb') as f:
                raw_body = f.read()

            buf = io.BytesIO()
            with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=6) as gz:
                gz.write(raw_body)
            compressed = buf.getvalue()

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
            self.send_header('Vary', 'Accept-Encoding')
            self.end_headers()
            self.wfile.write(compressed)
        except FileNotFoundError:
            self.send_error(404, 'File not found')
        except Exception as e:
            self.send_error(500, f'Compression error: {str(e)}')

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

        if not is_safe_url(target_url):
            self.send_error(403, 'Forbidden target URL')
            return

        try:
            req = urllib.request.Request(target_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            req.add_header('Accept', '*/*')

            with urllib.request.urlopen(req, timeout=15) as response:
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
                
                # Check URL path and headers first
                parsed_target = urllib.parse.urlparse(target_url)
                target_path_lower = parsed_target.path.lower()
                
                is_m3u8 = target_path_lower.endswith('.m3u8') or 'mpegurl' in content_type.lower()
                
                # Read the first chunk (up to 65536 bytes) to detect magic bytes of gzip or start streaming
                first_chunk = response.read(65536)
                
                is_gzip = False
                if first_chunk:
                    is_gzip = (
                        target_path_lower.endswith('.gz') or 
                        response.headers.get('Content-Encoding') == 'gzip' or 
                        first_chunk.startswith(b'\x1f\x8b')
                    )

                if is_m3u8 or is_gzip:
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
                        text = rewrite_m3u8(text, target_url, proxy_prefix)
                        body = text.encode('utf-8')
                        content_type = 'application/vnd.apple.mpegurl'

                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(body)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', '*')
                    if '.m3u' in target_url.lower():
                        self.send_header('Cache-Control', 'public, max-age=7200')
                    else:
                        self.send_header('Cache-Control', 'no-store')
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    # Stream directly to client
                    self.send_response(200)
                    self.send_header('Content-Type', content_type)
                    upstream_len = response.headers.get('Content-Length')
                    if upstream_len:
                        self.send_header('Content-Length', upstream_len)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', '*')
                    if '.m3u' in target_url.lower():
                        self.send_header('Cache-Control', 'public, max-age=7200')
                    else:
                        self.send_header('Cache-Control', 'no-store')
                    self.end_headers()

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
                sys.stderr.write(f"[IVIDS] Failed to send HTTPError response to client: {str(se)}\n")
        except urllib.error.URLError as e:
            try:
                self.send_error(502, f'Proxy connection failed: {e.reason}')
            except Exception as se:
                sys.stderr.write(f"[IVIDS] Failed to send URLError response to client: {str(se)}\n")
        except (ConnectionError, OSError) as e:
            # Client connection aborted, reset, or closed gracefully
            sys.stderr.write(f"[IVIDS] Client connection closed or aborted during proxying: {str(e)}\n")
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


def start_server():
    """
    Initializes and starts the threaded HTTP server on an available port, opening the browser to the interface.
    Gracefully handles port conflicts by auto-incrementing and shuts down on keyboard interrupts.
    """
    # Change working directory to the assets directory to ensure correct path resolution
    os.chdir(ASSETS_DIR)

    port = PORT
    # Enable address reuse on the class level to prevent "address already in use" errors on restart
    ThreadingHTTPServer.allow_reuse_address = True
    while True:
        try:
            server = ThreadingHTTPServer(("", port), IVIDSHTTPRequestHandler)
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
