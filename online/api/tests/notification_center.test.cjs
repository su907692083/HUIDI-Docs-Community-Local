const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const storage = new Map();
const localStorage = {
  getItem: k => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k)
};
const today = new Date();
const y = today.getFullYear(), m = String(today.getMonth()+1).padStart(2,'0'), d = String(today.getDate()).padStart(2,'0');
const todayText = `${y}-${m}-${d}`;
const noopDoc = {
  readyState: 'loading',
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return {style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},addEventListener(){}}; },
  head: {appendChild(){}}, body: {appendChild(){},classList:{add(){},remove(){}}}
};
const busListeners=[];
const core = {
  repositories: {
    deals: {list:()=>[{id:'deal_1',title:'Acme · Hinge Inquiry',stage:'quotation',next_action:'发送新版价格',next_action_at:todayText,customer_id:'customer_1',product_ids:[]}]},
    customers: {list:()=>[{id:'customer_1',company:'Acme GmbH',followup_date:todayText}]},
    products: {list:()=>[]},
    mail: {list:()=>[{id:'mail_1',online_source_lead_id:'88',customer_name:'Acme GmbH',to:'buyer@acme.test',subject:'Hinge offer',draft_approved:false}]}
  },
  bus: {on(fn){busListeners.push(fn);return()=>{};}}
};
const sandbox = {console,window:{HUIDILocalCore:core,addEventListener(){}},document:noopDoc,localStorage,setTimeout:fn=>fn(),setInterval:()=>0,clearInterval(){},CustomEvent:function(){},URLSearchParams,TextEncoder,TextDecoder,CSS:{escape:String},alert(){},location:{hash:''}};
sandbox.window.window=sandbox.window;sandbox.window.document=noopDoc;sandbox.window.localStorage=localStorage;
vm.createContext(sandbox);
const file = path.resolve(__dirname,'../../../public/huidi-notification-center-v1.js');
vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
const api=sandbox.window.HUIDINotifications;
assert(api,'notification API should be exported');
api.scan();
let rows=api.list();
assert(rows.some(x=>x.type==='deal.followup'),'due deal follow-up should be created');
assert(rows.some(x=>x.type==='mail.draft'),'online mail draft should be created');
const before=rows.length;
api.scan();
assert.strictEqual(api.list().length,before,'rescanning must dedupe deterministic reminders');
const ch=api.addChannel({name:'业务群',type:'feishu',address:'https://example.invalid/hook'});
assert(ch.id && api.channels().some(x=>x.id===ch.id),'channel config should persist locally');
assert.strictEqual(api.settings().deal_followup,true,'business follow-up rule should default on');
console.log('HUIDI Notification Center regression PASS');
