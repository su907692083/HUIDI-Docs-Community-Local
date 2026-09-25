from __future__ import annotations
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

class FullsiteSourceRepairs(unittest.TestCase):
    def test_frozen_database_read_gate_runs_and_waits_for_hydration(self):
        if not shutil.which('node'):
            self.skipTest('Node not installed')
        script = r"""
        const fs=require('fs'),vm=require('vm'),assert=require('assert');
        const source=fs.readFileSync(process.argv[1],'utf8');
        const start=source.indexOf('function installCloudDocumentReadGate(){');
        const end=source.indexOf('installCloudDocumentReadGate();',start);
        let reads=0,readyCallback;const native=Object.freeze({
          getDocument:async id=>{reads++;return {id}},
          putDocument:()=>{},otherOwner:true
        });
        const root={HUIDILocalDB:native,addEventListener:(name,fn)=>{readyCallback=fn}};
        const ctx={window:root,document:{documentElement:{dataset:{}}},Date,Promise,Object,
          ONLINE:{enabled:true},setTimeout:()=>0};
        vm.runInNewContext(source.slice(start,end)+'installCloudDocumentReadGate();',ctx);
        assert(Object.isFrozen(native));assert(Object.isFrozen(root.HUIDILocalDB));
        assert.strictEqual(root.HUIDILocalDB.putDocument,native.putDocument);
        assert(root.HUIDILocalDB.__huidiCommunityCloudReadGate);
        const pending=root.HUIDILocalDB.getDocument('owned-id');assert.strictEqual(reads,0);
        readyCallback();pending.then(value=>{assert.strictEqual(reads,1);assert.strictEqual(value.id,'owned-id')}).catch(e=>{throw e});
        """
        out=subprocess.run(['node','-e',script,str(ROOT/'public/community-local-mode.js')],capture_output=True,text=True)
        self.assertEqual(out.returncode,0,out.stdout+out.stderr)

    def test_map_coordinates_reject_missing_and_preserve_zero(self):
        if not shutil.which('node'):
            self.skipTest('Node not installed')
        script=r"""
        const fs=require('fs'),vm=require('vm'),assert=require('assert');
        const s=fs.readFileSync(process.argv[1],'utf8');
        const a=s.indexOf('function number('),b=s.indexOf('function mapCard(',a);
        const c={Number,String,Math};vm.runInNewContext(s.slice(a,b)+'this.osmUrl=osmUrl',c);
        for(const row of [{},{lat:null,lng:null},{lat:'',lng:''},{lat:91,lng:4},{lat:3,lng:181},{lat:'NaN',lng:2}])assert.strictEqual(c.osmUrl(row),'');
        assert(c.osmUrl({lat:0,lng:0}).includes('0.000000'));
        assert(c.osmUrl({lat:52.52,lng:13.405}).includes('52.520000'));
        """
        out=subprocess.run(['node','-e',script,str(ROOT/'public/huidi-community-online-functional-closure-v1.js')],capture_output=True,text=True)
        self.assertEqual(out.returncode,0,out.stdout+out.stderr)

    def test_tab_owner_dependencies_and_paged_first_reads(self):
        s=(ROOT/'public/huidi-community-online-full-v2.js').read_text()
        for key in ['registerPane','paneSerial','paneEpoch','loaders.delete(key)','aria-selected','data-fv2-pool-next','data-fv2-pool-prev']:
            self.assertIn(key,s)
        self.assertIn("mountService(pane,'mail','settings')",s)
        self.assertIn("loadModule('mailbox')",s)
        self.assertIn("loadModule('mailPaging')",s)
        self.assertIn("loadModule('mailThreads')",s)
        seq=(ROOT/'online/api/web/sequence-ui.js').read_text()
        self.assertNotIn("api('/api/mail/sequence-enrollments')",seq)
        self.assertIn('sequence-enrollments?paged=1&page=1&page_size=50',seq)
        self.assertIn("x.enabled&&x.connection_state==='connected'",seq)
        self.assertIn('HUIDISequencePagination?.adopt?.(enrollmentPage)',seq)
