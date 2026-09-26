const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const fail=m=>{console.error('[RELEASE-DOCS] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[RELEASE-DOCS] PASS:',m);

const pkg=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('RELEASE-MANIFEST.json'));
const readme=read('README.md');

const match=String(pkg.version||'').match(/^(\d+\.\d+\.\d+)-rc(\d+(?:\.\d+)*)$/i);
if(!match){
  fail('package version must use x.y.z-rcN format');
  process.exit(process.exitCode||1);
}
const base=match[1];
const rc='RC'+match[2];
const tag='v'+base+'-rc'+match[2];
const display='V'+base+' '+rc;
const fileVersion='V'+base+'-'+rc;
const releaseNotes='RELEASE-NOTES-'+base+'-'+rc+'.zh-CN.md';
const features='FEATURES-'+rc+'.zh-CN.md';
const verify='RELEASE-PACKAGE-VERIFY-'+rc+'.txt';
const sums='SHA256SUMS-'+rc+'.txt';

const checks=[
  ['manifest version matches package',String(manifest.version||'').toUpperCase()===(base+'-'+rc).toUpperCase()],
  ['manifest release matches package',String(manifest.release||'').toUpperCase()===rc.toUpperCase()],
  ['manifest display name matches package',String(manifest.display_name||'').includes(display)],
  ['README displays current release',readme.includes('当前已发布候选版：**'+display+'**')],
  ['README Windows asset matches current release',readme.includes('/releases/download/'+tag+'/HUIDI-Docs-Community-Local-'+fileVersion+'-WINDOWS.zip')],
  ['README links current release notes',readme.includes('./'+releaseNotes)],
  ['README links current feature file',readme.includes('./'+features)],
  ['release notes file exists',exists(releaseNotes)],
  ['features file exists',exists(features)],
  ['package verification file exists',exists(verify)],
  ['SHA256 file exists',exists(sums)]
];
for(const [name,ok] of checks)ok?pass(name):fail(name);

if(exists(verify)){
  const v=read(verify);
  if(v.includes('HUIDI Docs Community Local '+display.slice(1)))pass('package verification title matches');
  else fail('package verification title mismatch');
}
if(exists(sums)){
  const v=read(sums);
  for(const kind of ['WINDOWS','SOURCE']){
    const name='HUIDI-Docs-Community-Local-'+fileVersion+'-'+kind+'.zip';
    v.includes(name)?pass('SHA256 references '+kind+' package'):fail('SHA256 missing '+kind+' package');
  }
}

if(process.exitCode)process.exit(process.exitCode);
console.log('[RELEASE-DOCS] OK');
