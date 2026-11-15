import json,os,subprocess,time,socket
from pathlib import Path
import httpx
root=Path(__file__).resolve().parents[1]
os.chdir(root)
(root/'work').mkdir(exist_ok=True)
log=(root/'work/api-smoke.log').open('w')
env=os.environ|{'ENABLE_PAID_API':'false','OPENAI_API_KEY':'','FLAME_API_TOKEN':''}
with socket.socket() as probe:
    probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
p=subprocess.Popen([str(root/'.venv/bin/python'),'-m','uvicorn','flame.main:app','--host','127.0.0.1','--port',str(port)],env=env,stdout=log,stderr=subprocess.STDOUT)
try:
    with httpx.Client(base_url=f'http://127.0.0.1:{port}',timeout=15) as c:
        ready=False
        for _ in range(60):
            try:
                if c.get('/health').status_code==200:ready=True;break
            except httpx.ConnectError:pass
            time.sleep(.15)
        assert ready,'API did not start'
        stats=c.get('/api/statistics').json();assert stats['total_papers']>0 and stats['indexed_chunks']>0
        docs=c.get('/api/documents').json();assert len(docs)==stats['total_papers']
        result=c.post('/api/search',json={'query':'flame extinction','semantic':False}).json();assert result['results']
        citation=result['results'][0]
        detail=c.get('/api/documents/'+citation['document_id']).json()
        assert citation['text'] in detail['pages'][citation['page']-1]['text']
        source=c.get(citation['url'].split('#')[0]);assert source.status_code==200 and source.content.startswith(b'%PDF')
        answer=c.post('/api/chat',json={'query':'¿Qué evidencia hay sobre la extinción de llama?','semantic':False}).json()
        assert answer['mode']=='evidence_only' and answer['insufficient_evidence'] and answer['citations']
        findings=c.get('/api/findings').json()['items'];assert len(findings)==stats['source_checked_findings']+stats['verified_findings']
        estimate=c.post('/api/ingest',json={'dry_run':True}).json();assert estimate['documents']>=stats['total_papers']
        assert c.get('/api/documents/missing').status_code==404
        assert c.get('/api/docs').status_code==200
        assert c.get('/api/openapi.json').json()['info']['title']=='FLAME INTELLIGENCE'
        report={'status':'passed','transport':'actual local HTTP via uvicorn on loopback','checks':['health','real corpus statistics','document listing','keyword search','citation text/page integrity','original PDF response','Spanish evidence-only chat','source-checked findings','dry-run ingestion','missing-document error','proxied API documentation and schema'],'corpus':stats,'live_api_calls':0}
        (root/'docs/http_smoke_results.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'status':'passed','http_checks':len(report['checks']),'papers':len(docs),'chunks':stats['indexed_chunks'],'live_api_calls':0}))
finally:
    p.terminate()
    try:p.wait(timeout=5)
    except subprocess.TimeoutExpired:p.kill();p.wait()
    log.close()
