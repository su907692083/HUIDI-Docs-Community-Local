"""Real app routes and tenant storage; Feishu HTTP is isolated, never live."""
import base64
import itertools
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.daily_app import app
from app import feishu_documents as f
from app.main import SessionLocal
from app.service_connections import ServiceConnection
from app.tenant_storage import set_current_organization, reset_current_organization

IDS = itertools.count(980100)


class FeishuDocumentsTests(unittest.TestCase):
    def setUp(self):
        self.token = set_current_organization(next(IDS))
        self.env = patch.dict(os.environ, {"HUIDI_TEAM_ACCESS": "0", "HUIDI_SECRET_KEY": "feishu-test-encryption-key-only"})
        self.env.start()
        self.client = TestClient(app)
        with SessionLocal() as db:
            db.query(ServiceConnection).delete(); db.commit()

    def tearDown(self):
        self.client.close(); self.env.stop(); reset_current_organization(self.token)

    def config(self, **kwargs):
        return self.client.post('/api/feishu/config', json={"app_id": "cli_fixture", "app_secret": "fixture-secret-private", **kwargs})

    def test_missing_status_is_json_not_404(self):
        r = self.client.get('/api/feishu/status')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()['configured'])

    def test_save_encrypted_and_secret_never_returned(self):
        r = self.config()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn('fixture-secret-private', r.text)
        with SessionLocal() as db:
            row, cfg = f.load(db)
            self.assertEqual(cfg['app_secret'], 'fixture-secret-private')
            self.assertNotIn('fixture-secret-private', row.encrypted_token)
        self.assertFalse(r.json()['verified'])

    def test_blank_secret_retains_same_application(self):
        self.config()
        self.assertEqual(self.config(app_secret='', folder_token='fld_fixture').status_code, 200)
        with SessionLocal() as db:
            self.assertEqual(f.load(db)[1]['app_secret'], 'fixture-secret-private')

    def test_changed_application_requires_its_secret(self):
        self.config()
        self.assertEqual(self.config(app_id='cli_other', app_secret='').status_code, 400)

    def test_other_company_has_no_config(self):
        self.config()
        token = set_current_organization(next(IDS))
        try:
            with SessionLocal() as db: self.assertFalse(f.public(f.load(db)[1])['configured'])
        finally: reset_current_organization(token)

    def test_config_and_snapshot_require_manager(self):
        req = SimpleNamespace(state=SimpleNamespace(team_member={'role': 'sales'}))
        with SessionLocal() as db:
            with self.assertRaises(HTTPException) as cm: f.configure(f.Config(app_id='cli_fixture', app_secret='secret'), req, db)
            self.assertEqual(cm.exception.status_code, 403)
            with self.assertRaises(HTTPException) as cm: f.sync_snapshot(f.Snapshot(snapshot_b64='aA=='), req, db)
            self.assertEqual(cm.exception.status_code, 403)

    def test_domain_rejects_other_origins_and_credentials(self):
        for host in ['evil.example', 'feishu.cn.evil.example', 'https://user:pass@sample.feishu.cn', 'https://sample.feishu.cn/path', 'https://sample.feishu.cn:443']:
            with self.subTest(host=host): self.assertEqual(self.config(tenant_domain=host).status_code, 400)

    def test_bad_token_cannot_modify_api_path(self):
        self.assertEqual(self.config(folder_token='../evil').status_code, 400)

    def test_missing_configuration_does_not_call_external_service(self):
        with patch.object(f, 'request_json') as upstream:
            r = self.client.post('/api/feishu/source/inspect', json={'url':'https://sample.feishu.cn/base/basc_fixture'})
        self.assertEqual(r.status_code, 503);upstream.assert_not_called()

    def test_invalid_source_link_rejected_before_auth(self):
        self.config()
        with patch.object(f, 'request_json') as upstream:
            for u in ['http://localhost/base/tok','https://evil.example/base/token','https://sample.feishu.cn/wiki/node']:
                r=self.client.post('/api/feishu/source/inspect',json={'url':u})
                self.assertEqual(r.status_code,400,r.text)
        upstream.assert_not_called()

    def test_application_test_does_not_claim_table_permission(self):
        self.config()
        with patch.object(f, 'request_json', return_value={'code':0,'tenant_access_token':'private-tenant-token'}) as upstream:
            r=self.client.post('/api/feishu/test',json={})
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn('目标表格',r.json()['message']);self.assertNotIn('private-tenant-token',r.text)
        self.assertEqual(upstream.call_count,1)

    def inspect(self, responses, **kwargs):
        self.config()
        with patch.object(f,'request_json',side_effect=[{'code':0,'tenant_access_token':'fixture-access'},*responses]) as mock:
            response=self.client.post('/api/feishu/source/inspect',json={'url':'https://sample.feishu.cn/base/basc_fixture',**kwargs})
        return response,mock

    def test_multiple_tables_require_user_choice(self):
        r,m=self.inspect([{'data':{'items':[{'table_id':'tbl1','name':'客户'},{'table_id':'tbl2','name':'产品'}]}}])
        self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(r.json()['selection_required']);self.assertEqual(r.json()['rows'],[])
        self.assertEqual(m.call_count,2)

    def test_missing_requested_table_never_falls_back(self):
        r,m=self.inspect([{'data':{'items':[{'table_id':'tbl1','name':'客户'}]}}],table_id='tblMissing')
        self.assertEqual(r.status_code,400);self.assertEqual(m.call_count,2)

    def test_bitable_current_page_and_next_token(self):
        r,m=self.inspect([{'data':{'items':[{'table_id':'tbl1','name':'客户'}]}}, {'data':{'items':[{'fields':{'公司':'Fixture Buyer','电话':[{'text':'123'}]}}], 'has_more':True,'page_token':'next-fixture'}}],table_id='tbl1')
        self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(r.json()['has_more']);self.assertEqual(r.json()['page_token'],'next-fixture')
        self.assertEqual(r.json()['rows'][0]['电话'],'123')
        self.assertEqual(m.call_args.kwargs['params']['page_size'],50)

    def test_next_token_forwarded_not_whole_table_loop(self):
        r,m=self.inspect([{'data':{'items':[{'table_id':'tbl1','name':'客户'}]}}, {'data':{'items':[],'has_more':False}}],table_id='tbl1',page_token='next-fixture')
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(m.call_count,3)
        self.assertEqual(m.call_args.kwargs['params']['page_token'],'next-fixture')

    def test_missing_next_token_rejects_ambiguous_completion(self):
        r,m=self.inspect([{'data':{'items':[{'table_id':'tbl1'}]}}, {'data':{'items':[],'has_more':True}}])
        self.assertEqual(r.status_code,502)

    def test_sheet_headers_are_unique_and_current_page_bounded(self):
        r,m=self.inspect([{'data':{'sheets':[{'sheet_id':'sheet1','title':'商品','grid_properties':{'row_count':500}}]}}, {'data':{'valueRange':{'values':[['名称','名称','名称_2']]}}}, {'data':{'valueRange':{'values':[['A','B','C']]}}}],url='https://sample.feishu.cn/sheets/sht_fixture?sheet=sheet1')
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(len(set(r.json()['columns'])),3)
        self.assertIn('A2%3AAZ51',m.call_args.args[1])

    def test_folder_pagination_is_explicit(self):
        self.config(folder_token='fld_fixture')
        with patch.object(f,'request_json',side_effect=[{'tenant_access_token':'fixture-access'},{'data':{'files':[{'token':'sht1','type':'sheet','name':'产品'}],'has_more':True,'next_page_token':'folder_next'}}]) as m:
            r=self.client.post('/api/feishu/source/list',json={'page_token':'previous'})
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['page_token'],'folder_next')
        self.assertEqual(m.call_args.kwargs['params']['page_token'],'previous')

    def test_snapshot_allowlists_fields_and_does_not_export_secrets(self):
        self.config(document_id='doc_fixture',tenant_domain='sample.feishu.cn')
        snap={'format':'HUIDI_FEISHU_COLLAB_SNAPSHOT_V1','customers':[{'company':'Fixture Buyer','bank_account':'DO-NOT-EXPORT'}],'app_secret':'DO-NOT-EXPORT'}
        payload={'snapshot_b64':base64.b64encode(json.dumps(snap).encode()).decode()}
        with patch.object(f,'request_json',side_effect=[{'tenant_access_token':'fixture-access'},{'data':{}}]) as m:
            r=self.client.post('/api/feishu/sync',json=payload)
        self.assertEqual(r.status_code,200,r.text)
        body=json.dumps(m.call_args.kwargs['body']);self.assertNotIn('DO-NOT-EXPORT',body);self.assertIn('Fixture Buyer',body)

    def test_snapshot_failure_retains_created_document(self):
        self.config()
        snap={'format':'HUIDI_FEISHU_COLLAB_SNAPSHOT_V1'}
        with patch.object(f,'request_json',side_effect=[{'tenant_access_token':'fixture-access'},{'data':{'document':{'document_id':'doc_created'}}},HTTPException(502,'fixture failure')]):
            r=self.client.post('/api/feishu/sync',json={'snapshot_b64':base64.b64encode(json.dumps(snap).encode()).decode()})
        self.assertEqual(r.status_code,502)
        self.assertEqual(self.client.get('/api/feishu/status').json()['document_id'],'doc_created')
        self.assertEqual(self.client.get('/api/feishu/status').json()['last_sync_at'],'')

    def test_invalid_snapshot_has_no_external_side_effect(self):
        with patch.object(f,'request_json') as m:
            r=self.client.post('/api/feishu/sync',json={'snapshot_b64':'!!!!'})
        self.assertEqual(r.status_code,400);m.assert_not_called()

    def test_http_redirect_does_not_follow_or_echo_credential(self):
        real_client=httpx.Client
        def factory(*a,**kw):
            kw['transport']=httpx.MockTransport(lambda req:httpx.Response(302,headers={'Location':'https://evil.example'},text='secret-fixture'))
            return real_client(*a,**kw)
        with patch.object(f.httpx,'Client',factory):
            with self.assertRaises(HTTPException) as cm:f.request_json('GET','drive/v1/files','secret-fixture')
        self.assertNotIn('secret-fixture',str(cm.exception.detail))

    def test_http_body_limit_and_api_error_redaction(self):
        real_client=httpx.Client
        for response in [httpx.Response(200,text='x'*(f.MAX_RESPONSE+1)),httpx.Response(200,json={'code':99991672,'msg':'secret-fixture'})]:
            def factory(*a,**kw):
                kw['transport']=httpx.MockTransport(lambda req:response)
                return real_client(*a,**kw)
            with patch.object(f.httpx,'Client',factory):
                with self.assertRaises(HTTPException) as cm:f.request_json('GET','drive/v1/files','secret-fixture')
            self.assertNotIn('secret-fixture',str(cm.exception.detail))

    def test_malformed_ports_are_400_not_500(self):
        for url in ['https://qa.feishu.cn:bad', 'https://[notipv6']:
            self.assertEqual(self.config(tenant_domain=url).status_code,400)
        with patch.object(f,'request_json') as m:
            r=self.client.post('/api/feishu/source/inspect',json={'url':'https://qa.feishu.cn:bad/base/tok'})
            self.assertEqual(r.status_code,400)
        m.assert_not_called()

    def test_malformed_upstream_data_is_not_success(self):
        for data in [None, [], {'items':[None]}]:
            r,m=self.inspect([{'data':data}])
            self.assertEqual(r.status_code,502,r.text)

    def test_oversized_table_catalog_requires_narrower_source(self):
        r,m=self.inspect([{'data':{'items':[], 'has_more':True}}])
        self.assertEqual(r.status_code,422)

    def test_sheet_excess_columns_not_silently_dropped(self):
        r,m=self.inspect([{'data':{'sheets':[{'sheet_id':'s1','title':'Too wide','grid_properties':{'column_count':60}}]}}],url='https://qa.feishu.cn/sheets/abc')
        self.assertEqual(r.status_code,422)

    def test_malformed_record_fields(self):
        r,m=self.inspect([{'data':{'items':[{'table_id':'t1'}]}}, {'data':{'items':[{'fields':None}]}}])
        self.assertEqual(r.status_code,502)

    def test_scalar_preserves_long_text_without_silent_truncation(self):
        text='Long description '*1000
        self.assertEqual(f.scalar(text),text)
        self.assertEqual(f.scalar([{'text':str(i)} for i in range(80)]),' / '.join(str(i) for i in range(80)))

    def test_folder_missing_cursor_is_not_complete(self):
        self.config(folder_token='fld_fixture')
        with patch.object(f,'request_json',side_effect=[{'tenant_access_token':'access'},{'data':{'files':[], 'has_more':True}}]):
            r=self.client.post('/api/feishu/source/list',json={})
        self.assertEqual(r.status_code,502)

    def test_document_write_timeout_warns_against_blind_retry(self):
        real_client=httpx.Client
        def handler(req):raise httpx.ReadTimeout('fixture')
        def factory(*a,**kw):
            kw['transport']=httpx.MockTransport(handler);return real_client(*a,**kw)
        with patch.object(f.httpx,'Client',factory):
            with self.assertRaises(HTTPException) as cm:f.request_json('POST','docx/v1/documents','fixture')
        self.assertEqual(cm.exception.status_code,504)
        self.assertIn('勿重复',cm.exception.detail)
