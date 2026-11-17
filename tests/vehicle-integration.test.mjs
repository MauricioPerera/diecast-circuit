import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIGURATION, DONORS, stockConfiguration, normalizeConfiguration, configurationKey, getVehicleStats } from '../src/vehicles.js';
import { createVehicleRecordStore } from '../src/vehicle-records.js';
import { courses } from '../src/courses.js';
import { createTrackData } from '../src/track.js';
import { createRun,stepRun } from '../src/simulation.js';

const makeStorage=(values={})=>{const data=new Map(Object.entries(values));return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
function lap(track,configuration,nitro=false){const run=createRun(track,'full',configuration?getVehicleStats(configuration):undefined);for(let i=0;i<120*70&&['countdown','racing'].includes(run.mode);i++)stepRun(run,{throttle:true,nitro});return run;}

test('Default GT dynamics preserve the original timed laps; all donor cars can complete every course',()=>{
  const tracks=courses.map(createTrackData);
  for(const track of tracks){
    const original=lap(track),gt=lap(track,DEFAULT_CONFIGURATION);
    assert.equal(gt.elapsed,original.elapsed);assert.equal(gt.distance,original.distance);
    for(const donor of DONORS)assert.equal(lap(track,stockConfiguration(donor.id)).mode,'finished',`${donor.id}/${track.course.id}`);
  }
});
test('A mixed car drives a complete lap and its parts produce a measurable change',()=>{
  const hybrid=normalizeConfiguration({name:'Mezcla',parts:{body:'muscle',cabin:'prototype',wheels:'rally',spoiler:'gt',exhaust:'prototype'}});
  const track=createTrackData(courses[1]),base=lap(track,DEFAULT_CONFIGURATION,true),mixed=lap(track,hybrid,true);
  assert.equal(mixed.mode,'finished');assert.ok(Math.abs(mixed.elapsed-base.elapsed)>.02);
  const baseRun=createRun(track,'full',getVehicleStats(DEFAULT_CONFIGURATION)),hybridRun=createRun(track,'full',getVehicleStats(hybrid));
  baseRun.mode=hybridRun.mode='racing';baseRun.speed=hybridRun.speed=20;
  for(let i=0;i<120;i++){stepRun(baseRun,{throttle:true,nitro:true});stepRun(hybridRun,{throttle:true,nitro:true});}
  assert.ok(baseRun.speed!==hybridRun.speed||baseRun.nitro!==hybridRun.nitro);
});
test('Legacy records migrate to GT and are separated by parts while paint and names remain cosmetic',()=>{
  const storage=makeStorage({'diecast-circuit.records.v1':JSON.stringify({'garage-full':18.2,'district-full':21,bad:-1})});
  const gt=DEFAULT_CONFIGURATION,muscle=stockConfiguration('muscle'),store=createVehicleRecordStore(storage);
  assert.equal(store.forConfiguration(gt)['garage-full'],18.2);assert.equal(store.forConfiguration(muscle)['garage-full'],undefined);
  store.record('garage','full',16.3,muscle);assert.equal(store.forConfiguration(gt)['garage-full'],18.2);
  const cosmetic={...muscle,name:'Rojo especial',paint:'#ee2211',accent:'#ffffff'};assert.equal(configurationKey(cosmetic),configurationKey(muscle));
  assert.equal(store.forConfiguration(cosmetic)['garage-full'],16.3);
  store.record('garage','full',17.5,gt);
  const reloaded=createVehicleRecordStore(storage);assert.equal(reloaded.forConfiguration(gt)['garage-full'],17.5);assert.equal(reloaded.forConfiguration(muscle)['garage-full'],16.3);
  assert.equal(JSON.parse(storage.getItem('diecast-circuit.records.v1'))['garage-full'],17.5);
  assert.equal(reloaded.forConfiguration(gt).bad,undefined);
});
test('Malformed or blocked storage does not stop racing or erase in-memory records',()=>{
  const bad=createVehicleRecordStore(makeStorage({'diecast-circuit.records.v2':'{broken'}));assert.equal(Object.keys(bad.forConfiguration(DEFAULT_CONFIGURATION)).length,0);
  const unavailable=createVehicleRecordStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  const record=unavailable.record('garage','full',19,DEFAULT_CONFIGURATION);assert.equal(record.saved,false);assert.equal(record.best,19);assert.equal(unavailable.forConfiguration(DEFAULT_CONFIGURATION)['garage-full'],19);
});
