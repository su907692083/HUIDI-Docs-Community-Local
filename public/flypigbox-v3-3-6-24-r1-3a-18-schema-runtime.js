/* HUIDI V3.3.6.24-R1.3A.18 — embedded deterministic JSON Schema subset runtime. */
(()=>{
  'use strict';
  const VERSION='V3.3.6.24-R1.3A.18-SCHEMA.1';
  const clean=value=>String(value??'').trim();
  const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const typeMatches=(value,type)=>{
    if(Array.isArray(type))return type.some(item=>typeMatches(value,item));
    if(type==='object')return isObject(value);
    if(type==='array')return Array.isArray(value);
    if(type==='string')return typeof value==='string';
    if(type==='number')return typeof value==='number'&&Number.isFinite(value);
    if(type==='integer')return Number.isInteger(value);
    if(type==='boolean')return typeof value==='boolean';
    if(type==='null')return value===null;
    return true;
  };
  function add(errors,path,keyword,message,params={}){errors.push({instancePath:path||'',keyword,message,params});}
  function validateNode(schema,value,path,errors){
    if(!schema||typeof schema!=='object')return;
    if(schema.const!==undefined&&value!==schema.const)add(errors,path,'const',`必须等于 ${schema.const}`);
    if(Array.isArray(schema.enum)&&!schema.enum.includes(value))add(errors,path,'enum','不在允许范围内',{allowedValues:schema.enum});
    if(schema.type&&!typeMatches(value,schema.type)){add(errors,path,'type',`类型应为 ${Array.isArray(schema.type)?schema.type.join(' 或 '):schema.type}`);return;}
    if(typeof value==='string'){
      if(Number.isFinite(schema.minLength)&&value.length<schema.minLength)add(errors,path,'minLength',`至少需要 ${schema.minLength} 个字符`);
      if(Number.isFinite(schema.maxLength)&&value.length>schema.maxLength)add(errors,path,'maxLength',`不能超过 ${schema.maxLength} 个字符`);
      if(schema.pattern){try{if(!(new RegExp(schema.pattern)).test(value))add(errors,path,'pattern','格式不符合要求',{pattern:schema.pattern});}catch(_){} }
      if(schema.format==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))add(errors,path,'format','邮箱格式不正确',{format:'email'});
      if(schema.format==='date'&&value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))add(errors,path,'format','日期应为 YYYY-MM-DD',{format:'date'});
    }
    if(typeof value==='number'&&Number.isFinite(value)){
      if(Number.isFinite(schema.minimum)&&value<schema.minimum)add(errors,path,'minimum',`不能小于 ${schema.minimum}`);
      if(Number.isFinite(schema.exclusiveMinimum)&&value<=schema.exclusiveMinimum)add(errors,path,'exclusiveMinimum',`必须大于 ${schema.exclusiveMinimum}`);
      if(Number.isFinite(schema.maximum)&&value>schema.maximum)add(errors,path,'maximum',`不能大于 ${schema.maximum}`);
    }
    if(Array.isArray(value)){
      if(Number.isFinite(schema.minItems)&&value.length<schema.minItems)add(errors,path,'minItems',`至少需要 ${schema.minItems} 项`);
      if(Number.isFinite(schema.maxItems)&&value.length>schema.maxItems)add(errors,path,'maxItems',`不能超过 ${schema.maxItems} 项`);
      if(schema.items)value.forEach((item,index)=>validateNode(schema.items,item,`${path}/${index}`,errors));
    }
    if(isObject(value)){
      const required=Array.isArray(schema.required)?schema.required:[];
      required.forEach(key=>{
        const present=Object.prototype.hasOwnProperty.call(value,key)&&value[key]!==null&&value[key]!==undefined&&!(typeof value[key]==='string'&&clean(value[key])==='');
        if(!present)add(errors,path,'required',`缺少字段 ${key}`,{missingProperty:key});
      });
      const properties=isObject(schema.properties)?schema.properties:{};
      Object.keys(properties).forEach(key=>{if(Object.prototype.hasOwnProperty.call(value,key))validateNode(properties[key],value[key],`${path}/${key}`,errors);});
      if(schema.additionalProperties===false)Object.keys(value).filter(key=>!Object.prototype.hasOwnProperty.call(properties,key)).forEach(key=>add(errors,`${path}/${key}`,'additionalProperties','不允许出现该字段',{additionalProperty:key}));
      if(Array.isArray(schema.allOf))schema.allOf.forEach(part=>validateNode(part,value,path,errors));
      if(Array.isArray(schema.anyOf)){
        const passes=schema.anyOf.some(part=>{const local=[];validateNode(part,value,path,local);return local.length===0;});
        if(!passes)add(errors,path,'anyOf','至少需要满足一组规则');
      }
      if(schema.if){const test=[];validateNode(schema.if,value,path,test);validateNode(test.length===0?schema.then:schema.else,value,path,errors);}
    }
  }
  function compile(schema){
    const validate=data=>{const errors=[];validateNode(schema,data,'',errors);validate.errors=errors;return errors.length===0;};
    validate.errors=[];return validate;
  }
  function validate(schema,data){const fn=compile(schema);return{valid:fn(data),errors:fn.errors||[]};}
  window.FlypigBOXSchemaRuntime=Object.freeze({version:VERSION,compile,validate});
  document.dispatchEvent(new CustomEvent('HUIDI:schema-runtime-ready',{detail:{version:VERSION}}));
})();
