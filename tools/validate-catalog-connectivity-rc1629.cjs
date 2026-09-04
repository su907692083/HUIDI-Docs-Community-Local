const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/catalog-studio/index.html'),'utf8');
const closure=fs.readFileSync(path.join(root,'public/flypigbox-r1-3a-18-30-catalog-closure.js'),'utf8');
const workspace=fs.readFileSync(path.join(root,'public/huidi-local-workspace-v120.js'),'utf8');
const failures=[];const ok=m=>console.log('[OK]',m),fail=m=>failures.push(m);
function must(re,label,src=html){if(re.test(src))ok(label);else fail(label)}
function mustNot(re,label,src=html){if(!re.test(src))ok(label);else fail(label)}

must(/function isLocalImageSource\(value\)/,'local image source detector exists');
must(/data:image\\\/\[\^;\]\+;base64/,'data:image source accepted');
must(/blob:/,'blob image source accepted');
must(/if\(isLocalImageSource\(sourceImage\)\)[\s\S]{0,420}product\.image=sourceImage;[\s\S]{0,260}product\.imageStatus="ready"/,'workspace local image promoted directly into catalog preview');
must(/function productLibraryFields\(row\)/,'product master-data field bridge exists');
for(const label of ['Customs Description','Country of Origin','Package Type','Carton Size','Qty / Carton','N.W. (kg)','G.W. (kg)','CBM','Shipping Marks']){
  must(new RegExp(`add\\(\\"${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\"`),`catalog sync includes ${label}`);
}
must(/K=\{customers:'huidi_local_customers_v1',products:'huidi_local_products_v1'/,'workspace canonical product key retained',workspace);
must(/image_url:x\.image_url\|\|x\.image\|\|''/,'workspace product local image retained',workspace);
must(/function status\(\)\{qsa\('\.fp30-catalog-status'\)\.forEach\(node=>node\.remove\(\)\)\}/,'legacy duplicated catalog workflow block removed',closure);
mustNot(/bar\.innerHTML=.*目录制作流程/,'legacy catalog workflow block is no longer injected',closure);

// Execute the real one-line image parsing helpers from Catalog Studio against representative sources.
try{
  const extractLine=html.split(/\r?\n/).find(x=>x.startsWith('function extractUrls(v)'));
  const localLine=html.split(/\r?\n/).find(x=>x.startsWith('function isLocalImageSource(value)'));
  if(!extractLine||!localLine) throw new Error('helper source missing');
  const clean=v=>String(v??'').trim();
  const unique=a=>[...new Set(a)];
  const helpers=new Function('clean','unique',`${extractLine}\n${localLine}\nreturn {extractUrls,isLocalImageSource};`)(clean,unique);
  const data='data:image/webp;base64,UklGRgAAAABXRUJQVlA4';
  const http='https://example.com/product.jpg';
  if(helpers.extractUrls(data)[0]!==data)throw new Error('data image lost');
  if(!helpers.isLocalImageSource(data))throw new Error('data image not local');
  if(helpers.extractUrls(http)[0]!==http)throw new Error('http image regression');
  ok('runtime helper test: data image + http image');
}catch(e){fail('runtime helper test: '+e.message)}

if(failures.length){console.error('\nRC16.29 CATALOG CONNECTIVITY VALIDATION FAILED');failures.forEach(x=>console.error('-',x));process.exit(1)}
console.log('\nRC16.29 CATALOG CONNECTIVITY VALIDATION PASSED');
