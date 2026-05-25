#!/usr/bin/env python3
"""CodeLoot CMS — static site server with manual publish system."""
import cgi
import json
import sys
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'scripts'))
from site_generator import normalize_all  # noqa: E402
from html_importer import import_html_games  # noqa: E402
from image_utils import (  # noqa: E402
    ASSETS_IMG,
    extension_for_upload,
    output_filename,
    remove_old_slug_images,
)

DATA_FILE = ROOT / 'data' / 'games.json'


class CMSHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/cms-health':
            self._send_json({
                'cms': True,
                'root': str(ROOT),
                'writes': ['data/games.json', 'index.html', 'games/*.html', 'assets/img/*'],
            })
            return
        if self.path == '/api/games':
            self._send_json(self._read_games())
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/upload-image'):
            self._upload_image()
            return
        if self.path == '/api/import-games':
            self._import_games()
            return
        self.send_response(404)
        self.end_headers()

    def do_PUT(self):
        if self.path == '/api/games':
            self._save_games()
            return
        self.send_response(404)
        self.end_headers()

    def _read_games(self):
        if DATA_FILE.exists():
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'games': [], 'metadata': {'version': '1.0', 'last_updated': ''}}

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _save_games(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length).decode('utf-8')
            data = normalize_all(json.loads(raw))
            if not data.get('metadata'):
                data['metadata'] = {}
            data['metadata']['last_updated'] = datetime.utcnow().isoformat() + 'Z'

            DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

            self._send_json({
                'success': True,
                'files': ['data/games.json'],
            })
        except Exception as e:
            self._send_json({'success': False, 'error': str(e)}, status=500)

    def _import_games(self):
        try:
            data = import_html_games()
            self._send_json({
                'success': True,
                'imported': len(data.get('games', [])),
                'files': ['data/games.json'],
            })
        except Exception as e:
            self._send_json({'success': False, 'error': str(e)}, status=500)

    def _field_file(self, form, name):
        """Get an uploaded file from FieldStorage (never use bool() on FieldStorage)."""
        field = form[name]
        if isinstance(field, list):
            field = field[0]
        if getattr(field, 'filename', None) and getattr(field, 'file', None):
            return field
        return None

    def _upload_image(self):
        try:
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self._send_json({'success': False, 'error': 'Expected multipart form'}, status=400)
                return

            length = int(self.headers.get('Content-Length', 0))
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    'REQUEST_METHOD': 'POST',
                    'CONTENT_TYPE': content_type,
                    'CONTENT_LENGTH': str(length),
                },
            )

            slug = (form.getvalue('slug') or '').strip()
            if not slug:
                self._send_json({'success': False, 'error': 'Missing slug'}, status=400)
                return

            file_item = self._field_file(form, 'image')
            if file_item is None:
                self._send_json({'success': False, 'error': 'Missing image file'}, status=400)
                return

            upload_name = getattr(file_item, 'filename', '') or ''
            upload_type = getattr(file_item, 'type', '') or ''
            ext = extension_for_upload(upload_name, upload_type)
            out_name = output_filename(slug, ext)

            ASSETS_IMG.mkdir(parents=True, exist_ok=True)
            remove_old_slug_images(slug, out_name)
            out_path = ASSETS_IMG / out_name
            with open(out_path, 'wb') as f:
                f.write(file_item.file.read())

            self._send_json({
                'success': True,
                'image': out_name,
                'path': f'assets/img/{out_name}',
                'files': [f'assets/img/{out_name}'],
            })
        except Exception as e:
            self._send_json({'success': False, 'error': str(e)}, status=500)


if __name__ == '__main__':
    port = 3000
    server = HTTPServer(('localhost', port), CMSHandler)
    print(f'CodeLoot CMS server running on http://localhost:{port}')
    print(f'Admin dashboard: http://localhost:{port}/admin/index.html')
    print('Press Ctrl+C to stop')
    server.serve_forever()
