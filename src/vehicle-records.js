import { DEFAULT_CONFIGURATION, configurationKey } from './vehicles.js';

const LEGACY_KEY='diecast-circuit.records.v1',KEY='diecast-circuit.records.v2';
const baseline=configurationKey(DEFAULT_CONFIGURATION);
const clean=source=>{
  const out=Object.create(null);
  if(source&&typeof source==='object'&&!Array.isArray(source))for(const [key,time]of Object.entries(source).slice(0,4000)){
    if(key.length<=160&&Number.isFinite(time)&&time>0)out[key]=time;
  }
  return out;
};

// Original GT records remain available; other combinations have their own table.
export function createVehicleRecordStore(providedStorage) {
  let storage=providedStorage,profiles=Object.create(null);
  try{storage??=globalThis.localStorage;}catch{}
  try{
    const text=storage?.getItem(KEY);
    if(text&&text.length<2_000_000){
      const data=JSON.parse(text);
      if(data.version===2&&data.profiles&&typeof data.profiles==='object')for(const [id,profile]of Object.entries(data.profiles).slice(0,2048))if(id.length<100)profiles[id]=clean(profile);
    }
  }catch{}
  profiles[baseline]??=Object.create(null);
  try{
    const legacy=clean(JSON.parse(storage?.getItem(LEGACY_KEY)||'{}'));
    for(const [key,time]of Object.entries(legacy))profiles[baseline][key]=Math.min(profiles[baseline][key]??Infinity,time);
  }catch{}
  function forConfiguration(configuration){return profiles[configurationKey(configuration)]??=Object.create(null);}
  function record(courseId,assistId,time,configuration){
    const table=forConfiguration(configuration),key=`${courseId}-${assistId}`,previous=table[key];
    const newBest=Number.isFinite(time)&&time>0&&(!previous||time<previous);
    if(newBest)table[key]=time;
    let saved=false;
    try{
      if(storage){storage.setItem(KEY,JSON.stringify({version:2,profiles}));if(configurationKey(configuration)===baseline)storage.setItem(LEGACY_KEY,JSON.stringify(table));saved=true;}
    }catch{}
    return {best:table[key],newBest,saved};
  }
  return {forConfiguration,record};
}
