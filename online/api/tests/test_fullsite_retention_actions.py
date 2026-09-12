from pathlib import Path
import json
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[3]

class FullsiteRetentionAndActions(unittest.TestCase):
    def node(self, code):
        if not shutil.which('node'):
            self.skipTest('node unavailable')
        out = subprocess.run(['node','-e',code],text=True,capture_output=True)
        self.assertEqual(out.returncode,0,out.stdout+out.stderr)

    def test_native_core_keeps_records_beyond_historical_limits(self):
        src=(ROOT/'public/huidi-local-core-rc167.js').read_text()
        self.node("""const store=new Map();global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};global.window={HUIDI_LOCAL_ONLY:{localOnly:true},dispatchEvent:()=>{}};global.CustomEvent=function(){};"""+src+""";
const r=window.HUIDILocalCore.repositories;
for(const k of ['customers','products','deals','brands','templates','mail']){
  const rows=Array.from({length:3001},(_,i)=>({id:'retention-'+i,name:'Retention '+i}));
  r[k].replaceAll(rows,{silent:true});if(r[k].list().length!==3001)throw Error(k+' silently truncated');
  r[k].upsert({id:'last',name:'last'},{silent:true});if(r[k].list().length!==3002)throw Error(k+' insertion truncated');
}
""")

    def test_secondary_actions_are_rendered_not_discarded(self):
        src=(ROOT/'public/huidi-workspace-closure-v1.js').read_text()
        function=src[src.index('function actionBox('):src.index('function productImg(')]
        self.node(function+"""const html=actionBox('primary',['edit'],'delete','catalog');for(const v of ['edit','delete','catalog','<details'])if(!html.includes(v))throw Error(v+' missing');""")
        self.assertIn('raw(core.keys[name],[])',src)
        self.assertIn('data-context-find-product',src)

if __name__=='__main__':
    unittest.main()
