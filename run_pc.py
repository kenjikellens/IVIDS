import http.server
import os
import webbrowser
import sys
import urllib.request
import urllib.parse
import urllib.error
import re
from http.server import ThreadingHTTPServer

# Define port and target assets directory
PORT = 8000
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'app', 'src', 'main', 'assets', 'main'))


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


class IVIDSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Custom request handler that serves static files from the assets directory,
    redirects root to the GUI, and provides a /proxy endpoint for CORS bypass.
    """

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
        Handles HTTP GET requests. Routes /proxy requests to the reverse proxy handler,
        redirects root path (/) to /gui/index.html, and serves static files otherwise.
        """
        if self.path == '/' or self.path == '':
            self.send_response(301)
            self.send_header('Location', '/gui/index.html')
            self.end_headers()
        elif self.path.startswith('/proxy'):
            self._handle_proxy()
        else:
            super().do_GET()

    def _handle_proxy(self):
        """
        Reverse proxy handler that fetches a remote URL server-side and returns it
        with CORS headers injected. Rewrites .m3u8 manifests so nested resources
        also route through the proxy.
        """
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)
        target_url = query.get('url', [None])[0]

        if not target_url:
            self.send_error(400, 'Missing url parameter')
            return

        try:
            req = urllib.request.Request(target_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            req.add_header('Accept', '*/*')
            req.add_header('Referer', target_url)

            with urllib.request.urlopen(req, timeout=15) as response:
                content_type = response.headers.get('Content-Type', 'application/octet-stream')
                body = response.read()

                # Rewrite .m3u8 manifests so sub-resources also proxy
                is_m3u8 = target_url.endswith('.m3u8') or 'mpegurl' in content_type.lower()
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
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(body)

        except urllib.error.HTTPError as e:
            self.send_error(e.code, f'Upstream error: {e.reason}')
        except urllib.error.URLError as e:
            self.send_error(502, f'Proxy connection failed: {e.reason}')
        except Exception as e:
            self.send_error(500, f'Proxy error: {str(e)}')

    def end_headers(self):
        """
        Injects headers instructing the browser to disable resource caching.
        This ensures changes to JS/CSS files are immediately visible on refresh.
        """
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        """
        Suppresses verbose .ts segment logs to keep the console readable.
        Only logs non-segment proxy requests and static file requests.
        """
        message = format % args
        if '.ts' in message and '/proxy' in message:
            return  # Suppress noisy segment logs
        sys.stderr.write(f"[IVIDS] {message}\n")


def start_server():
    """
    Initializes and starts the threaded HTTP server, opens the browser to the web interface,
    and handles graceful shutdown on keyboard interrupts.
    """
    # Change working directory to the assets directory to ensure correct path resolution
    os.chdir(ASSETS_DIR)

    server = ThreadingHTTPServer(("", PORT), IVIDSHTTPRequestHandler)
    server.allow_reuse_address = True

    url = f"http://localhost:{PORT}/gui/index.html"
    print("=" * 60)
    print("                  IVIDS PC UI TEST SERVER")
    print("=" * 60)
    print(f"Server is running at: http://localhost:{PORT}/")
    print(f"CORS Proxy available: http://localhost:{PORT}/proxy?url=<stream_url>")
    print(f"Opening browser to:   {url}")
    print("Press Ctrl+C to stop the server.")
    print("=" * 60)

    # Open default web browser after starting the server
    try:
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
