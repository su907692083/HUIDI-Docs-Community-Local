const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const fail = (message) => {
  console.error('[RELEASE-HYGIENE] FAIL:', message);
  process.exitCode = 1;
};
const pass = (message) => console.log('[RELEASE-HYGIENE] PASS:', message);

const gitignorePath = path.join(root, '.gitignore');
const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';

for (const required of ['config/feishu.local.json', 'config/translation.local.json', '.huidi-relay/']) {
  if (!gitignore.split(/\r?\n/).map((line) => line.trim()).includes(required)) {
    fail(`.gitignore missing required rule: ${required}`);
  } else {
    pass(`.gitignore protects ${required}`);
  }
}

const forbidden = [
  '.huidi-relay',
  path.join('.github', 'workflows', 'huidi-secure-ios-build-relay.yml'),
  path.join('config', 'feishu.local.json'),
  path.join('config', 'translation.local.json'),
  'online',
  'Dockerfile.online',
  'docker-compose.online.yml',
  'Dockerfile.nas-shadow',
];

for (const rel of forbidden) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) {
    fail(`forbidden release path exists: ${rel}`);
  } else {
    pass(`forbidden release path absent: ${rel}`);
  }
}

const allowedEnvExamples = new Set(['.env.example', '.env.sample']);
const forbiddenExtensions = new Set(['.pem', '.p12', '.pfx', '.key', '.mobileprovision']);
const textExtensions = new Set(['.js','.cjs','.mjs','.json','.md','.html','.css','.txt','.yml','.yaml','.cmd','.ps1','.toml']);
const secretPatterns = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key material'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/, 'GitHub fine-grained token'],
  [/\bghp_[A-Za-z0-9]{20,}\b/, 'GitHub personal token'],
  [/\bsb_secret_[A-Za-z0-9_-]{12,}\b/, 'Supabase secret key'],
  [/\bsk-proj-[A-Za-z0-9_-]{12,}\b/, 'OpenAI project secret'],
  [/\bxoxb-[A-Za-z0-9-]{16,}\b/, 'Slack bot token']
];

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.name==='.git'||entry.name==='node_modules')return[];
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return walk(full);
    return[full];
  });
}
const releaseFiles=walk(root);
for(const full of releaseFiles){
  const rel=path.relative(root,full).replace(/\\/g,'/');
  const base=path.basename(full);
  const ext=path.extname(base).toLowerCase();
  if(base==='.env'&&!allowedEnvExamples.has(base))fail(`forbidden environment file: ${rel}`);
  if(forbiddenExtensions.has(ext))fail(`forbidden credential/certificate file: ${rel}`);
  if(!textExtensions.has(ext)&&base!=='.gitignore')continue;
  const stat=fs.statSync(full);
  if(stat.size>1024*1024)continue;
  const body=fs.readFileSync(full,'utf8');
  for(const [rx,label] of secretPatterns){
    if(rx.test(body))fail(`possible ${label} found in ${rel}`);
  }
}
if(!process.exitCode)pass('secret/certificate scan clean');

const crossProjectMarkers=[
  ['HUIDI'+'DouyinSpeed','iOS speed project marker'],
  ['HUIDI Secure iOS '+'Build Relay','iOS relay workflow marker']
];
for(const [needle,label] of crossProjectMarkers){
  const hits=releaseFiles.filter(full=>{
    const rel=path.relative(root,full).replace(/\\/g,'/');
    const ext=path.extname(full).toLowerCase();
    if(!textExtensions.has(ext)&&path.basename(full)!=='.gitignore')return false;
    if(fs.statSync(full).size>1024*1024)return false;
    return fs.readFileSync(full,'utf8').includes(needle);
  }).map(full=>path.relative(root,full).replace(/\\/g,'/'));
  hits.length?fail(`${label} found in Community release: ${hits.join(', ')}`):pass(`${label} absent`);
}


const packagePath = path.join(root, 'package.json');
if (!fs.existsSync(packagePath)) {
  fail('package.json missing');
} else {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (!String(pkg.name || '').includes('huidi-docs-community-local')) {
    fail('unexpected package identity');
  } else {
    pass(`package identity: ${pkg.name}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log('[RELEASE-HYGIENE] OK');
