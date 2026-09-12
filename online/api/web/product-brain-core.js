(()=>{'use strict';
const root=typeof window!=='undefined'?window:globalThis;
const SCHEMA='huidi.product.brain/v1';
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v.map(clean).filter(Boolean):clean(v).split(/\r?\n|[；;]/).map(clean).filter(Boolean);
const uniq=v=>[...new Set(v.map(clean).filter(Boolean))];
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const uid=()=>`pb_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
function decodeBase64Url(value){const s=clean(value).replace(/-/g,'+').replace(/_/g,'/');const padded=s+'='.repeat((4-s.length%4)%4);const binary=atob(padded);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}
function normalize(input={}){const raw=input?.schema===SCHEMA?(input.product||{}):(input.product||input||{});const brain={
 id:clean(raw.brain_id||raw.id)||uid(),local_product_id:clean(raw.local_product_id||raw.product_id||raw.id),source:clean(input?.source||raw.source)||'manual',
 name:clean(raw.name||raw.title),sku:clean(raw.sku||raw.model),category:clean(raw.category),series:clean(raw.series),spec:clean(raw.spec||raw.specification),
 price:raw.price??'',price_range:clean(raw.price_range),currency:clean(raw.currency)||'USD',unit:clean(raw.unit||raw.pricing_unit)||'PCS',moq:clean(raw.moq),lead_time:clean(raw.lead_time||raw.delivery_time),
 certifications:arr(raw.certifications||raw.certification),differentiators:arr(raw.differentiators||raw.selling_points),customer_cases:arr(raw.customer_cases||raw.cases),company_facts:arr(raw.company_facts),
 target_keywords:arr(raw.target_keywords||raw.keywords),allowed_claims:arr(raw.allowed_claims),restricted_claims:arr(raw.restricted_claims||raw.forbidden_claims),
 hs_code:clean(raw.hs_code),customs_description:clean(raw.customs_description),country_of_origin:clean(raw.country_of_origin),supplier_name:clean(raw.supplier_name),
 package_type:clean(raw.package_type),carton_size:clean(raw.carton_size),qty_per_carton:clean(raw.qty_per_carton),net_weight:clean(raw.net_weight),gross_weight:clean(raw.gross_weight),cbm:clean(raw.cbm),dimensions:clean(raw.dimensions),shipping_marks:clean(raw.shipping_marks),
 source_url:clean(raw.source_url),video_url:clean(raw.video_url),notes:clean(raw.notes),updated_at:new Date().toISOString(),created_at:clean(raw.created_at)||new Date().toISOString()
};
return brain}
function completion(b){const checks=[b.name,b.spec,b.moq,b.lead_time,b.certifications?.length,b.differentiators?.length,b.customer_cases?.length,b.company_facts?.length];return Math.round(checks.filter(Boolean).length/checks.length*100)}
function facts(b){if(!b)return'';const rows=[];const price=clean(b.price_range)||(num(b.price)!==null?`${b.currency||'USD'} ${b.price} / ${b.unit||'PCS'}`:'');
if(b.name)rows.push(`Product: ${b.name}${b.sku?` (${b.sku})`:''}`);if(b.category||b.series)rows.push(`Category/Series: ${[b.category,b.series].filter(Boolean).join(' / ')}`);if(b.spec)rows.push(`Specification: ${b.spec}`);if(price)rows.push(`Price reference: ${price}`);if(b.moq)rows.push(`MOQ: ${b.moq}`);if(b.lead_time)rows.push(`Lead time: ${b.lead_time}`);if(b.certifications?.length)rows.push(`Certifications: ${b.certifications.join(', ')}`);if(b.differentiators?.length)rows.push(`Differentiators: ${b.differentiators.join('; ')}`);if(b.customer_cases?.length)rows.push(`Reference cases: ${b.customer_cases.join('; ')}`);if(b.company_facts?.length)rows.push(`Company facts: ${b.company_facts.join('; ')}`);if(b.allowed_claims?.length)rows.push(`Allowed claims: ${b.allowed_claims.join('; ')}`);if(b.restricted_claims?.length)rows.push(`Do not claim: ${b.restricted_claims.join('; ')}`);return rows.join('\n').slice(0,3000)}
function searchKeyword(b){return clean(b?.target_keywords?.[0])||clean(b?.name)||clean(b?.category)}
function upsert(list,brain){const rows=Array.isArray(list)?[...list]:[];const keyLocal=clean(brain.local_product_id),keySku=clean(brain.sku).toLowerCase(),keyName=clean(brain.name).toLowerCase();let i=rows.findIndex(x=>keyLocal&&clean(x.local_product_id)===keyLocal);if(i<0)i=rows.findIndex(x=>keySku&&clean(x.sku).toLowerCase()===keySku);if(i<0)i=rows.findIndex(x=>keyName&&clean(x.name).toLowerCase()===keyName);if(i>=0){rows[i]={...rows[i],...brain,id:rows[i].id||brain.id,created_at:rows[i].created_at||brain.created_at,updated_at:new Date().toISOString()}}else rows.unshift(brain);return rows}
function campaignBrief(b,{country='',buyerType=''}={}){return{schema:'huidi.campaign.brief/v1',product_brain_id:b?.id||'',product_name:b?.name||'',target_country:clean(country),buyer_type:clean(buyerType),search_keyword:searchKeyword(b),selling_angles:uniq([...(b?.differentiators||[]),...(b?.allowed_claims||[])]).slice(0,8),fact_source:facts(b),restricted_claims:b?.restricted_claims||[],generated_at:new Date().toISOString()}}
const api=Object.freeze({schema:SCHEMA,normalize,completion,facts,searchKeyword,upsert,campaignBrief,decodeBase64Url});root.HUIDIProductBrainCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();