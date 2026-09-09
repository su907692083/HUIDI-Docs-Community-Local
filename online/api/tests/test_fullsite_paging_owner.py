from __future__ import annotations
import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]

class FullsitePagingOwnerTests(unittest.TestCase):
    def node(self,script):
        binary=shutil.which('node')
        if not binary:self.skipTest('Node unavailable')
        out=subprocess.run([binary,'-e',script],capture_output=True,text=True,check=False)
        self.assertEqual(out.returncode,0,out.stdout+out.stderr)
    def test_filter_before_page_slice_and_invalid_page_clamp(self):
        source=(ROOT/'public/huidi-workspace-closure-v1.js').read_text()
        fn=source.split('function pageOf(',1)[1].split('\nfunction ',1)[0]
        self.node("const assert=require('assert'); const ensureListSearch=()=>{},lower=v=>String(v||'').trim().toLowerCase(), $=()=>null,matches=()=>true,DEFAULT_SIZE=50;const state={products:{page:1,size:50}};const window={HUIDIWorkspaceSummary:{filterRows:(v,rs)=>rs.filter(x=>x.id>=100)}};"+'function pageOf('+fn+";const rows=Array.from({length:105},(_,id)=>({id}));let out=pageOf('products',rows);assert.equal(out.total,5);assert.equal(out.rows[0].id,100);assert.equal(out.pages,1);state.products.page=99;out=pageOf('products',rows);assert.equal(out.page,1);state.products.page=-30;state.products.size=Infinity;out=pageOf('products',rows);assert.equal(out.page,1);assert(out.size<=200);")
    def test_every_native_core_list_delegates_without_view_identity_change(self):
        base=(ROOT/'public/huidi-local-workspace-v120.js').read_text()
        owner=(ROOT/'public/huidi-workspace-closure-v1.js').read_text()
        for view in ('customers','products','deals','documents','mail','brands','templates','recycle'):
            self.assertIn("return window.HUIDIWorkspaceClosure.renderOwned('"+view+"')",base)
        rendering=owner.split('function renderOwned(view){',1)[1].split('function renderView(',1)[0]
        self.assertNotIn('dataset.huidiView=',rendering)
        self.assertIn('data-action="doc-next"',owner)
        self.assertIn('data-trash-confirm',base)
    def test_light_document_index_does_not_drop_record_501(self):
        source=(ROOT/'public/huidi-local-db-rc165.js').read_text()
        fn=source.split('function writeIndex(',1)[1].split('\nfunction ',1)[0]
        self.node("const assert=require('assert'),indexRow=x=>x,INDEX_KEY='test';let saved;const localStorage={setItem:(k,v)=>saved=JSON.parse(v)},window={dispatchEvent:()=>{}},CustomEvent=function(){};"+'function writeIndex('+fn+";writeIndex(Array.from({length:601},(_,i)=>({id:'doc-'+i})));assert.equal(saved.length,601);assert.equal(saved[600].id,'doc-600');")

if __name__=='__main__':unittest.main()
