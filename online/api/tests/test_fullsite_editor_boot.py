import pathlib, shutil, subprocess, unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]
class EditorBootTests(unittest.TestCase):
 def test_optional_brand_url_is_safe_and_no_global_observer(self):
  source=(ROOT/'public/assets/brand/huidi-brand.js').read_text()
  self.assertNotIn('MutationObserver',source)
  start=source.index('function safeSiteHost(');end=source.index('\nconst replacements=',start)
  node=shutil.which('node')
  if not node:self.skipTest('Node not installed')
  script="const cfg={en:'HUIDI'},location={href:'https://example.test/community/editor.html'};"+source[start:end]+";for(const v of ['',null,'http://[','javascript:evil']){if(safeSiteHost(v)!=='HUIDI')throw Error('Unsafe brand URL')}if(safeSiteHost('https://brand.example/path')!=='brand.example')throw Error('Valid host lost')"
  out=subprocess.run([node,'-e',script],capture_output=True,text=True)
  self.assertEqual(out.returncode,0,out.stderr)
 def test_reply_stop_applies_at_native_render_not_only_async_observer(self):
  w=(ROOT/'public/huidi-community-online-development-workbench-v1.js').read_text()
  self.assertIn('revision!==renderRevision',w)
  self.assertIn('baseLoadPromise',w)
  self.assertIn("const coldStopped=['replied','converted','archived'].includes(lead.status)",w)
  self.assertIn('enhanceDevelopment?.(host,ctx)',w)
  r=(ROOT/'public/huidi-community-online-development-routing-v1.js').read_text()
  self.assertIn('suppliedContext||await api',r)
  self.assertIn("clean($('#hdwLead',host)?.value)!==leadId",r)
