const assert=require('assert');
const core=require('../web/product-brain-core.js');

const imported=core.normalize({
  schema:'huidi.product.brain/v1',
  source:'HUIDI Community Local',
  product:{
    product_id:'p-100',
    name:'Stainless Steel Hinge',
    sku:'HD-120',
    category:'Furniture Hardware',
    spec:'304 stainless steel · 120x40 mm',
    price:2.85,
    currency:'USD',
    unit:'PCS',
    moq:'500',
    lead_time:'25-30 days',
    certifications:['RoHS'],
    differentiators:['Short lead time','Stable packing'],
    customer_cases:['Supplied verified EU distributor project'],
    company_facts:['10+ years hardware export experience'],
    target_keywords:['stainless steel hinge'],
    allowed_claims:['Sample available after confirmation'],
    restricted_claims:['Do not promise exclusivity without approval'],
    hs_code:'830210',
    carton_size:'42x31x26 cm',
    cbm:'0.034'
  }
});

assert.strictEqual(imported.local_product_id,'p-100');
assert.strictEqual(imported.name,'Stainless Steel Hinge');
assert.deepStrictEqual(imported.differentiators,['Short lead time','Stable packing']);
assert.ok(core.completion(imported)>=75,'complete product brain should score as substantially complete');

const facts=core.facts(imported);
assert.ok(facts.includes('304 stainless steel'));
assert.ok(facts.includes('MOQ: 500'));
assert.ok(facts.includes('RoHS'));
assert.ok(facts.includes('Do not claim: Do not promise exclusivity without approval'));
assert.ok(!facts.includes('random web search'), 'runtime search data must not appear unless explicitly stored as a product fact');

const brief=core.campaignBrief(imported,{country:'Germany',buyerType:'importer distributor'});
assert.strictEqual(brief.schema,'huidi.campaign.brief/v1');
assert.strictEqual(brief.product_brain_id,imported.id);
assert.strictEqual(brief.target_country,'Germany');
assert.strictEqual(brief.search_keyword,'stainless steel hinge');
assert.ok(brief.selling_angles.includes('Short lead time'));
assert.ok(brief.restricted_claims.includes('Do not promise exclusivity without approval'));

const changed=core.normalize({...imported,brain_id:imported.id,price_range:'USD 2.70-2.95 / PCS'});
const rows=core.upsert([imported],changed);
assert.strictEqual(rows.length,1,'same Local product should update the existing Product Brain');
assert.strictEqual(rows[0].price_range,'USD 2.70-2.95 / PCS');

console.log('Product Brain core regression PASS');
