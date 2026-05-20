import http.server
import socketserver
import os
import webbrowser
import sys

# Define port and target assets directory
PORT = 8000
ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'app', 'src', 'main', 'assets', 'main'))

class IVIDSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    Custom request handler that inherits from SimpleHTTPRequestHandler.
    It automatically redirects requests for the root path (/) to /gui/index.html.
    """
    
    def do_GET(self):
        """
        Handles HTTP GET requests. Redirects root path (/) to (/gui/index.html)
        to facilitate starting the UI. Other requests are served normally.
        """
        if self.path == '/' or self.path == '':
            self.send_response(301)
            self.send_header('Location', '/gui/index.html')
            self.end_headers()
        else:
            super().do_GET()

def start_server():
    """
    Initializes and starts the TCP server, opens the browser to the web interface,
    and handles graceful shutdown on keyboard interrupts.
    """
    # Change working directory to the assets directory to ensure correct path resolution
    os.chdir(ASSETS_DIR)
    
    # Configure socket server with support for reusing address
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), IVIDSHTTPRequestHandler) as httpd:
        url = f"http://localhost:{PORT}/gui/index.html"
        print("=" * 60)
        print("                  IVIDS PC UI TEST SERVER")
        print("=" * 60)
        print(f"Server is running at: http://localhost:{PORT}/")
        print(f"Opening browser to:   {url}")
        print("Press Ctrl+C to stop the server.")
        print("=" * 60)
        
        # Open default web browser after starting the server
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"Warning: Could not open browser automatically: {e}", file=sys.stderr)
            
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()
            print("Server stopped. Goodbye!")

if __name__ == '__main__':
    start_server()
