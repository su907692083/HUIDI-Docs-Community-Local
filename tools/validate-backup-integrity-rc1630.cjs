const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=m=>{console.error('[BACKUP-INTEGRITY] FAIL:',m);process.exitCode=1};
const pass=m=>console.log('[BACKUP-INTEGRITY] PASS:',m);

const workspace=read('public/huidi-local-workspace-v120.js');
const db=read('public/huidi-local-db-rc165.js');
const bridge=read('public/huidi-local-workspace-db-rc165.js');

const exportStart=workspace.indexOf('async function exportBackup(){');
const importStart=workspace.indexOf('async function importBackup(file){');
const parseStart=workspace.indexOf('function parseCsvText',importStart);
const exportBlock=exportStart>=0&&importStart>exportStart?workspace.slice(exportStart,importStart):'';
const importBlock=importStart>=0&&parseStart>importStart?workspace.slice(importStart,parseStart):'';

const checks=[
  ['base export is asynchronous',exportStart>=0],
  ['base export uses IndexedDB full-document exporter',exportBlock.includes('HUIDILocalDB?.exportDocuments')&&exportBlock.includes('await window.HUIDILocalDB.exportDocuments()')],
  ['base export no longer serializes document index as complete documents',!exportBlock.includes('documents:read(K.docs)')],
  ['base export marks V3 backup format',exportBlock.includes("format:'HUIDI_LOCAL_BACKUP_V3'")],
  ['base export refuses incomplete legacy index',exportBlock.includes('完整单据数据库尚未就绪')],
  ['base restore validates backup before writing',workspace.includes('function validateBackupPayload(j){')&&importBlock.includes('validateBackupPayload(j)')],
  ['base restore asks before destructive replacement',importBlock.includes("confirm('将用这份备份替换当前本地数据。")],
  ['base restore uses IndexedDB replacement when available',importBlock.includes('HUIDILocalDB?.replaceDocuments')&&importBlock.includes('await window.HUIDILocalDB.replaceDocuments(d.documents)')],
  ['base restore snapshots data before replacement',importBlock.includes('beforeDocuments=window.HUIDILocalDB?.exportDocuments')&&importBlock.includes('before={customers:read(K.customers)')],
  ['base restore rolls back after failure',importBlock.includes('await window.HUIDILocalDB.replaceDocuments(beforeDocuments)')&&importBlock.includes('已尝试恢复原数据')],
  ['IndexedDB exports hydrated full documents',db.includes('async function exportDocuments(){await migrateLegacy();return await listDocuments();}')&&db.includes('return await Promise.all(sorted.map(hydrateDocument))')],
  ['IndexedDB merge importer remains available for compatibility',db.includes('async function importDocuments(rows){for(const row of (rows||[]))if(row?.id)await putDocument(row);return true;}')],
  ['IndexedDB replacement restore is transactional',db.includes('async function replaceDocuments(rows){')&&db.includes("await tx(DOC_STORE,'readwrite',store=>{store.clear();for(const row of prepared)store.put(row)})")&&db.includes('writeIndex(prepared)')],
  ['IndexedDB replacement restore rejects missing document ids',db.includes("throw new Error('备份单据缺少本地 ID')")],
  ['IndexedDB replacement restore is exposed',db.includes('importDocuments,replaceDocuments,exportDocuments,estimate')],
  ['workspace DB bridge export uses full document exporter',bridge.includes('const documents=await window.HUIDILocalDB.exportDocuments();')],
  ['workspace DB bridge validates supported backup formats',bridge.includes('function validateBackup(j){')&&bridge.includes("/^HUIDI_LOCAL_BACKUP_V[23]$/")],
  ['workspace DB bridge rejects index-only document backups',bridge.includes('单据只有索引或缺少完整内容')],
  ['workspace DB bridge asks before destructive restore',bridge.includes("confirm('将用这份备份替换当前本地数据。")],
  ['workspace DB bridge snapshots current data before restore',bridge.includes('beforeDocuments=await window.HUIDILocalDB.exportDocuments()')&&bridge.includes('Object.fromEntries(Object.entries(K).map')],
  ['workspace DB bridge restores documents by replacement',bridge.includes('await window.HUIDILocalDB.replaceDocuments(d.documents)')],
  ['workspace DB bridge rolls back local and document data on failure',bridge.includes('await window.HUIDILocalDB.replaceDocuments(beforeDocuments)')&&bridge.includes('已尝试恢复原数据')],
  ['workspace DB bridge marks IndexedDB storage',bridge.includes("storage:'indexeddb+localstorage-index'")],
  ['workspace DB bridge marks V3 backup format',bridge.includes("format:'HUIDI_LOCAL_BACKUP_V3'")]
];
for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[BACKUP-INTEGRITY] OK');
