from __future__ import annotations
import asyncio
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from unittest.mock import patch
from starlette.requests import Request
from starlette.responses import Response

ROOT=Path(__file__).resolve().parents[3]

class HumanOperationContractTests(unittest.TestCase):
    def test_critical_panels_remain_hidden_and_assets_are_revisioned(self):
        from app import community_surface as cs
        with patch.object(cs,'COMMUNITY_SURFACE_ENABLED',True):
            html=cs._workspace_html()
            self.assertIn('data-huidi-critical-tabs',html)
            self.assertIn('.fv2-pane[hidden]{display:none!important}',html)
            self.assertIn('name="huidi-asset-revision"',html)
            self.assertIn('/community/huidi-quick-choices-v1.js?v='+cs.FUSION_ASSET_VERSION,html)
            self.assertRegex(cs.FUSION_ASSET_VERSION,r'-[0-9a-f]{16}$')
        with patch.object(cs,'COMMUNITY_SURFACE_ENABLED',False):
            self.assertNotIn('huidi-quick-choices-v1.js',cs._workspace_html())
    def test_bare_asset_urls_are_not_immutable(self):
        from app.frontend_runtime_guard import frontend_runtime_guard, ASSET_VERSION
        async def run(query):
            req=Request({'type':'http','path':'/assets/daily-services.js','query_string':query.encode(),'headers':[], 'method':'GET'})
            async def next_response(_):return Response('/* asset */',media_type='application/javascript')
            return (await frontend_runtime_guard(req,next_response)).headers['cache-control']
        self.assertNotIn('immutable',asyncio.run(run('')))
        self.assertNotIn('immutable',asyncio.run(run('v=old-build')))
        self.assertIn('immutable',asyncio.run(run('v='+ASSET_VERSION)))
    @unittest.skipUnless(shutil.which('node'),'Node is required for choice-data behavior')
    def test_choice_data_covers_bilingual_search_without_saving(self):
        script=ROOT/'public/huidi-quick-choices-v1.js'
        node=r'''
const fs=require('fs'),vm=require('vm');
const window={HUIDI_COMMUNITY_ONLINE:{enabled:true},addEventListener(){}};
const document={addEventListener(){}};
vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),{window,document,Intl,Map,Set,HTMLInputElement:class {}});
const q=window.HUIDIQuickChoices;
console.log(JSON.stringify({country:q.optionsFor('country').length,de:q.filtered('country','德国').map(x=>x.value),code:q.filtered('country-code','DE')[0].value,usd:q.filtered('currency','美元')[0].value,custom:q.filtered('country','unlisted business region').length}));
'''
        result=json.loads(subprocess.check_output(['node','-e',node,str(script)],text=True))
        self.assertEqual(result,{'country':249,'de':['Germany'],'code':'DE','usd':'USD','custom':0})
        text=script.read_text()
        for unsafe in ['MutationObserver','setInterval','fetch(','localStorage','unit_price','dispatchEvent(new Event(\'submit']:
            self.assertNotIn(unsafe,text)
    def test_human_acceptance_uses_pointer_keyboard_and_failure_screenshots(self):
        test=(ROOT/'tools/workspace_human_operation_audit.py').read_text()
        for marker in ["country.press('ArrowDown')","country.press('Enter')","country.press('Tab')","modal_country.press('Escape')","route.abort()",'data-hf-config-return','HUMAN-OPERATION-REPORT.json']:
            self.assertIn(marker,test)
        for unsafe in ['bypass_csp','ignore_https_errors','disable-web-security','URLBlocklist']:
            self.assertNotIn(unsafe,test)
    def test_tabs_have_native_visibility_state_not_placeholder_content(self):
        script=(ROOT/'public/huidi-community-online-full-v2.js').read_text()
        self.assertIn('pane.hidden=true',script)
        self.assertIn('p.hidden=p!==pane',script)
        self.assertNotIn('首次打开时读取真实数据',script)
        self.assertIn('aria-controls',script)
    def test_source_configuration_is_not_claimed_as_verified_connection(self):
        script=(ROOT/'public/huidi-community-online-functional-closure-v1.js').read_text()
        self.assertIn("return on?'已配置':'待配置'",script)
        self.assertIn('邮箱仍需授权',script)
        self.assertIn("x?.enabled&&x?.connection_state==='connected'",script)
