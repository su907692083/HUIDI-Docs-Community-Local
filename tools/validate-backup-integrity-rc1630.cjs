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
  ['base import uses IndexedDB document importer',importBlock.includes('HUIDILocalDB?.importDocuments')&&importBlock.includes('await window.HUIDILocalDB.importDocuments(d.documents)')],
  ['IndexedDB exports hydrated full documents',db.includes('async function exportDocuments(){await migrateLegacy();return await listDocuments();}')&&db.includes('return await Promise.all(sorted.map(hydrateDocument))')],
  ['IndexedDB import persists full documents',db.includes('async function importDocuments(rows){for(const row of (rows||[]))if(row?.id)await putDocument(row);return true;}')],
  ['workspace DB bridge export uses full document exporter',bridge.includes('const documents=await window.HUIDILocalDB.exportDocuments();')],
  ['workspace DB bridge import uses full document importer',bridge.includes('await window.HUIDILocalDB.importDocuments(d.documents)')],
  ['workspace DB bridge marks IndexedDB storage',bridge.includes("storage:'indexeddb+localstorage-index'")],
  ['workspace DB bridge marks V3 backup format',bridge.includes("format:'HUIDI_LOCAL_BACKUP_V3'")]
];
for(const [name,ok] of checks)ok?pass(name):fail(name);
if(process.exitCode)process.exit(process.exitCode);
console.log('[BACKUP-INTEGRITY] OK');
