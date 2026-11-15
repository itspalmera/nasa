"""Raw source extraction is never an automatically approved training dataset."""
import io
import json
from unittest.mock import patch
import pytest
import pymupdf
from scripts.papers_to_json import download_public_pdf, export_papers


def test_local_conversion_preserves_page_text_and_deduplicates_without_training(tmp_path):
    papers=tmp_path/'papers';papers.mkdir()
    with pymupdf.open() as doc:
        doc.new_page().insert_text((30,30),'Synthetic software fixture: flow 5 cm/s; not experimental evidence.')
        doc.new_page()
        doc.save(papers/'first.pdf')
    (papers/'duplicate.pdf').write_bytes((papers/'first.pdf').read_bytes())
    output=tmp_path/'data'/'raw.json'
    summary=export_papers(papers,output,include_tables=True)
    report=json.loads(output.read_text())
    assert summary['documents']==1 and summary['duplicate_files']==1
    assert summary['pages']==2 and summary['ocr_pages']==1
    assert summary['training_observations_added']==0
    assert report['training_observations']==[] and report['is_training_dataset'] is False
    assert report['documents'][0]['pages'][0]['pdf_page']==1
    assert 'Synthetic software fixture' in report['documents'][0]['pages'][0]['text']
    assert report['documents'][0]['reviewed'] is False


def test_download_refuses_non_pdf_and_logs_failures_without_losing_local_extraction(tmp_path):
    class Response(io.BytesIO):
        def geturl(self):return 'https://example.org/article.pdf'
    with patch('scripts.papers_to_json.urlopen',return_value=Response(b'<html>Login required</html>')):
        with pytest.raises(ValueError,match='did not return a PDF'):
            download_public_pdf('https://example.org/article.pdf',tmp_path/'downloads')
    for url in ['file:///etc/passwd','http://example.org/test.pdf','https://user:password@example.org/file.pdf']:
        with pytest.raises(ValueError):download_public_pdf(url,tmp_path/'downloads')
    with patch('scripts.papers_to_json.download_public_pdf',side_effect=OSError('Remote download blocked')):
        output=tmp_path/'raw.json'
        summary=export_papers(tmp_path,output,urls=['https://example.org/test.pdf'])
        assert summary['failures']==1
        assert json.loads(output.read_text())['failures'][0]['stage']=='download'
