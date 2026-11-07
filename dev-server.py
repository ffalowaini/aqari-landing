#!/usr/bin/env python3
"""Local dev server for the site, with clean URLs like GitHub Pages.

GitHub Pages serves /login from login.html, and the site's links rely on
that. Python's built-in http.server doesn't, so this adds the same fallback.

Usage:  python3 dev-server.py [port]   (default 8080)
"""
import http.server
import os
import sys


class CleanUrlHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        local = super().translate_path(path)
        if not os.path.exists(local) and os.path.exists(local + ".html"):
            return local + ".html"
        return local


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Serving on http://localhost:{port}")
    http.server.ThreadingHTTPServer(("", port), CleanUrlHandler).serve_forever()
