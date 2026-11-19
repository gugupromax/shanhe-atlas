from pathlib import Path
import json,subprocess,sys,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[1]
if '--offline' in sys.argv:
    import contextlib,io,runpy
    from unittest.mock import Mock,patch
    launch=runpy.run_path(str(ROOT/'scripts/launch_map.pyw'))
    scope=launch['main'].__globals__
    project=scope['PROJECT']
    record={'url':'http://127.0.0.1:8772','token':'fixture','project':project}
    with patch.dict(scope,RECORD=Mock(read_text=Mock(return_value=json.dumps(record))),request_json=Mock(return_value={'project':project})):
        assert launch['existing']()==record
    for url in ('https://127.0.0.1:8772','http://example.com:8772','http://127.0.0.1:9999','http://name@127.0.0.1:8772'):
        invalid={**record,'url':url}
        request=Mock(return_value={'project':project})
        with patch.dict(scope,RECORD=Mock(read_text=Mock(return_value=json.dumps(invalid))),request_json=request):
            assert launch['existing']() is None
            request.assert_not_called()
    with patch.object(sys,'argv',['launch_map.pyw','--spawn-hidden','--no-browser']),patch.object(scope['subprocess'],'Popen') as popen:
        launch['spawn_hidden']()
        args,options=popen.call_args
        assert args[0]==[sys.executable,str(ROOT/'scripts/launch_map.pyw'),'--no-browser']
        assert options['stdin']==options['stdout']==options['stderr']==subprocess.DEVNULL
        if scope['os'].name=='nt':assert options['creationflags'] & subprocess.CREATE_NO_WINDOW
        else:assert options['start_new_session'] is True
    with patch.dict(scope,RUNTIME=Mock(),existing=Mock(return_value=record)),patch.object(sys,'argv',['launch_map.pyw']),patch.object(scope['webbrowser'],'open') as browser,contextlib.redirect_stdout(io.StringIO()):
        launch['main']();browser.assert_called_once_with(record['url']+'/index.html')
    request=Mock()
    with patch.dict(scope,RUNTIME=Mock(),existing=Mock(return_value=record),request_json=request),patch.object(sys,'argv',['launch_map.pyw','--stop']):
        launch['main']();request.assert_called_once_with(record['url']+'/__jiangshan_stop__',record['token'])
    server_class=launch['LocalHTTPServer']
    assert server_class.allow_reuse_address is False and server_class.allow_reuse_port is False
    # Two fresh browser views can open a burst of loopback TCP connections before
    # the Python accept loop runs. Verify the listening socket can queue them.
    with server_class(('127.0.0.1',0),scope['SimpleHTTPRequestHandler']) as pending, contextlib.ExitStack() as clients:
        for _ in range(12):
            clients.enter_context(scope['socket'].create_connection(pending.server_address,timeout=3))
    print('PASS: loopback listener queued 12 connections before request handlers started.')
    # Bind ephemeral ports only: exercise both a legacy reusable listener and
    # the fixed exclusive listener without touching any running project server.
    for first_class in (launch['ThreadingHTTPServer'],server_class):
        first=first_class(('127.0.0.1',0),launch['SimpleHTTPRequestHandler'])
        try:
            if first_class is server_class and scope['os'].name=='nt':
                sock=scope['socket']
                assert first.socket.getsockopt(sock.SOL_SOCKET,sock.SO_EXCLUSIVEADDRUSE)==1
            try:duplicate=server_class(first.server_address,launch['SimpleHTTPRequestHandler'])
            except OSError:pass
            else:
                duplicate.server_close()
                raise AssertionError('A second project bound an occupied loopback port')
            with server_class(('127.0.0.1',0),launch['SimpleHTTPRequestHandler']) as alternate:
                assert alternate.server_address[1]!=first.server_address[1]
        finally:first.server_close()
    print('PASS: occupied legacy/exclusive loopback ports reject a second bind; another free port still works.')
    print('PASS: offline launcher URL guards, hidden spawn flags, root entry, reuse and authenticated stop; no service or browser started.')
    raise SystemExit(0)
record=json.loads((ROOT/'.runtime/server.json').read_text(encoding='utf-8'))
url=record['url']
assert url.startswith('http://127.0.0.1:')
with urllib.request.urlopen(url+'/__jiangshan_health__',timeout=2) as r:assert json.loads(r.read())['project']==record['project']
with urllib.request.urlopen(url+'/index.html',timeout=2) as r:assert 'integration.js' in r.read().decode('utf-8')
for route in ['/.runtime/server.json','/a/../.runtime/server.json','/%2eruntime/server.json']:
    try:urllib.request.urlopen(url+route,timeout=2)
    except urllib.error.HTTPError as e:assert e.code==404
    else:raise AssertionError('Private runtime served: '+route)
try:urllib.request.urlopen(urllib.request.Request(url+'/__jiangshan_stop__',method='POST'),timeout=2)
except urllib.error.HTTPError as e:assert e.code==403
else:raise AssertionError('Unauthenticated shutdown accepted')
result=subprocess.run([sys.executable,str(ROOT/'scripts/launch_map.pyw'),'--no-browser'],capture_output=True,text=True,check=True)
assert json.loads(result.stdout)['reused'] is True
print('PASS: loopback launcher health, static entry, reuse, private-runtime denial and shutdown-token guard.')
