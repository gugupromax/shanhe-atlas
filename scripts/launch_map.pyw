"""One-click loopback-only static host, using the Python already on this PC."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import hashlib,json,os,posixpath,secrets,subprocess,sys,threading,urllib.request,urllib.error,urllib.parse,webbrowser
import socket

class LocalHTTPServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR can bind a port already owned by another project.
    allow_reuse_address=False
    allow_reuse_port=False

    def server_bind(self):
        if os.name=='nt':
            self.socket.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
        super().server_bind()

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'.runtime'
RECORD=RUNTIME/'server.json'
PROJECT=hashlib.sha256(str(ROOT).casefold().encode('utf-8')).hexdigest()[:24]

def request_json(url,token=None):
    headers={'X-Jiangshan-Token':token} if token else {}
    req=urllib.request.Request(url,headers=headers,method='POST' if token else 'GET')
    with urllib.request.urlopen(req,timeout=1) as response:return json.loads(response.read())

def existing():
    try:
        record=json.loads(RECORD.read_text(encoding='utf-8'))
        parsed=urllib.parse.urlsplit(record['url'])
        if parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or parsed.username or parsed.password or parsed.port not in range(8772,8792):return None
        if request_json(record['url']+'/__jiangshan_health__').get('project')==PROJECT:return record
    except (OSError,ValueError,KeyError,urllib.error.URLError):pass
    return None

def spawn_hidden():
    args=[arg for arg in sys.argv[1:] if arg!='--spawn-hidden']
    options={'stdin':subprocess.DEVNULL,'stdout':subprocess.DEVNULL,'stderr':subprocess.DEVNULL,'cwd':str(ROOT)}
    if os.name=='nt':options['creationflags']=subprocess.CREATE_NO_WINDOW
    else:options['start_new_session']=True
    subprocess.Popen([sys.executable,str(Path(__file__).resolve()),*args],**options)

def main():
    if '--spawn-hidden' in sys.argv:
        spawn_hidden();return
    RUNTIME.mkdir(exist_ok=True)
    record=existing()
    if '--stop' in sys.argv:
        if record:request_json(record['url']+'/__jiangshan_stop__',record['token'])
        return
    if record:
        if '--no-browser' not in sys.argv:webbrowser.open(record['url']+'/index.html')
        print(json.dumps({'url':record['url'],'reused':True}),flush=True);return
    token=secrets.token_urlsafe(24)
    class Handler(SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
        def end_headers(self):
            self.send_header('Cache-Control','no-cache')
            super().end_headers()
        def do_GET(self):
            request_path=posixpath.normpath(urllib.parse.unquote(urllib.parse.urlsplit(self.path).path))
            if request_path=='/__jiangshan_health__':
                data=json.dumps({'project':PROJECT}).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
            if any(part in {'.runtime','.git','.agents','.codex'} for part in request_path.split('/')):self.send_error(404);return
            super().do_GET()
        def do_POST(self):
            if self.path!='/__jiangshan_stop__' or self.headers.get('X-Jiangshan-Token')!=token:self.send_error(403);return
            data=b'{"stopping":true}';self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
            threading.Thread(target=self.server.shutdown,daemon=True).start()
    server=None
    for port in range(8772,8792):
        try:server=LocalHTTPServer(('127.0.0.1',port),partial(Handler,directory=str(ROOT)));break
        except OSError:continue
    if not server:raise OSError('本机8772—8791端口均被占用，请关闭其他本地地图服务后重试。')
    url=f'http://127.0.0.1:{server.server_port}'
    RECORD.write_text(json.dumps({'url':url,'token':token,'project':PROJECT,'pid':os.getpid()}),encoding='utf-8')
    print(json.dumps({'url':url,'reused':False}),flush=True)
    if '--no-browser' not in sys.argv:webbrowser.open(url+'/index.html')
    try:server.serve_forever(poll_interval=.5)
    finally:
        server.server_close()
        try:
            if json.loads(RECORD.read_text(encoding='utf-8')).get('token')==token:RECORD.unlink()
        except (OSError,ValueError):pass

if __name__=='__main__':
    try:main()
    except Exception as error:
        RUNTIME.mkdir(exist_ok=True);(RUNTIME/'启动错误.txt').write_text(str(error),encoding='utf-8')
        if os.name=='nt' and '--no-browser' not in sys.argv:
            import ctypes
            ctypes.windll.user32.MessageBoxW(0,str(error),'山河地图启动失败',0x10)
        raise
