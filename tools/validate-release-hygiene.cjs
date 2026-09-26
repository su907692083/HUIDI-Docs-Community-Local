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

for (const required of ['config/feishu.local.json', '.huidi-relay/']) {
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
];

for (const rel of forbidden) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) {
    fail(`forbidden release path exists: ${rel}`);
  } else {
    pass(`forbidden release path absent: ${rel}`);
  }
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
