"""Offline retrieval and traceability evaluation on actual local documents."""
import json
from .config import settings, ROOT
from .store import Store
from .models import SearchRequest, ChatRequest
from .retrieval import search
from .assistant import chat

def evaluate():
    cfg=settings().model_copy(update={'enable_paid_api':False})
    store=Store(cfg)
    dataset=json.loads((ROOT/'evaluation/questions.json').read_text())
    cases=[];retrieved_count=valid_count=hits=answerable=ood_detected=ood_count=0
    docs={d['source_file']:d for d in store.documents()}
    for case in dataset:
        if not case.get('unanswerable'):
            document=docs.get(case['source_file'])
            if not document:raise ValueError('Evaluation source missing: '+case['source_file'])
            full=store.document(document['id'])
            page=next((p for p in full['pages'] if p['page']==case['page']),None)
            if not page or case['quote'] not in page['text']:raise ValueError('Evaluation quote missing: '+case['id'])
        found=search(store,SearchRequest(query=case['question'],limit=5,semantic=False))
        valid=[]
        for c in found.results:
            full=store.document(c.document_id)
            page=next((p for p in full['pages'] if p['page']==c.page),None) if full else None
            valid.append(bool(page and c.text in page['text']))
        retrieved_count+=len(valid);valid_count+=sum(valid)
        hit=None
        if case.get('unanswerable'):
            ood_count+=1
            response=chat(store,ChatRequest(query=case['question'],semantic=False))
            detected=response.insufficient_evidence and not response.citations
            ood_detected+=int(detected)
        else:
            answerable+=1
            hit=any(c.source_file==case['source_file'] and c.page==case['page'] for c in found.results)
            hits+=int(hit)
        cases.append({'id':case['id'],'hit_at_5':hit,'results': [{'file':c.source_file,'page':c.page} for c in found.results], 'all_citations_traceable':all(valid)})
    result={'mode':'offline_keyword_only','answerable_cases':answerable,'recall_at_5':hits/answerable if answerable else None,
            'retrieved_citations':retrieved_count,'citation_traceability':valid_count/retrieved_count if retrieved_count else None,
            'out_of_domain_cases':ood_count,'insufficient_evidence_detection':ood_detected/ood_count if ood_count else None,
            'answer_groundedness':None,'answer_groundedness_note':'Not evaluated: no live GPT-4o credentials. Traceability does not establish entailment.',
            'limitations':['Small hand-authored retrieval dataset; not a general scientific benchmark.','One out-of-domain case is not a reliable abstention benchmark.','Offline evidence mode intentionally does not produce scientific answers.'], 'cases':cases}
    path=ROOT/'docs/evaluation_results.json';path.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='cases'},indent=2))
    return result

if __name__=='__main__':evaluate()
