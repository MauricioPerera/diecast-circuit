import test from 'node:test';
import assert from 'node:assert/strict';
import { courses } from '../src/courses.js';
import { createTrackData } from '../src/track.js';
import { createRun, stepRun, STEP } from '../src/simulation.js';
import { hazardControls } from './drive-hazards.mjs';
import { surfaceAt } from '../src/track-surface.js';

const tracks=courses.map(createTrackData);
const input={throttle:true,brake:false,nitro:false,steerLeft:false,steerRight:false};
function drive(track,controls=input,assist='full') {
  const run=createRun(track,assist);let ticks=0;
  while((run.mode==='countdown'||run.mode==='racing')&&ticks++<120*80)stepRun(run,typeof controls==='function'?controls(run):controls);
  return run;
}
test('All five courses form closed, finite, orthonormal frames through their loops',()=>{
  let previousLength=0;
  for(const track of tracks){
    assert.ok(track.length>previousLength);previousLength=track.length;
    assert.ok(track.frames[0].p.distanceTo(track.frames.at(-1).p)<.001);
    assert.ok(track.frames[0].up.dot(track.frames.at(-1).up)>.999);
    assert.ok(track.frames.some(f=>f.up.y<-.99),'track has an actual inversion');
    for(const f of track.frames){
      assert.ok(f.p.toArray().every(Number.isFinite));
      assert.ok(Math.abs(f.up.dot(f.forward))<.0001);
      assert.ok(Math.abs(f.right.dot(f.forward))<.0001);
      assert.ok(f.right.clone().cross(f.up).dot(f.forward)>.9999);
    }
  }
});
const steering = run => ({ ...input, ...hazardControls({ ...run, sections: run.track.sections }) });
test('Even with full assists, every course needs active steering; aligned drivers can finish',()=>{
  for(const track of tracks){
    assert.match(drive(track).message,/salto|recepción/,track.course.name);
    const run=drive(track,steering);
    assert.equal(run.mode,'finished',`${track.course.name}: ${run.message}`);
    assert.equal(run.progress,1);assert.equal(run.collisions,0);assert.ok(run.elapsed<35);
  }
});
test('A jump creates a real gap, and low speed or a late steering correction causes a fall',()=>{
  const track=tracks[0], jump=track.sections[0];
  assert.equal(surfaceAt(track,jump.start-.01).rails,true);
  assert.equal(surfaceAt(track,jump.launch-.01).rails,false);
  assert.equal(surfaceAt(track,(jump.launch+jump.land)/2).gap,true);
  assert.equal(surfaceAt(track,jump.land).center,jump.landingOffset);
  const run=createRun(track,'full');run.mode='racing';run.distance=jump.launch-.05;run.speed=12;run.offset=jump.landingOffset;
  stepRun(run,{});assert.equal(run.event,'jump');assert.ok(run.flight);
  for(let i=0;i<120&&run.mode==='racing';i++)stepRun(run,{throttle:true,nitro:true});
  assert.equal(run.mode,'crashed');assert.match(run.message,/quedó corto/);
  assert.match(drive(track,current=>({...input,steerRight:current.distance>=jump.land})).message,/fuera de la recepción/);
});
test('An open curve has no rail rebound even with full assistance',()=>{
  const track=tracks[4], section=track.sections[1];
  const run=createRun(track,'full');run.mode='racing';run.distance=section.start+5;run.speed=30;run.offset=-1.8;
  for(let i=0;i<120&&run.mode==='racing';i++)stepRun(run,input);
  assert.equal(run.mode,'crashed');assert.match(run.message,/borde abierto/);assert.equal(run.collisions,0);
});
test('Nitro consumes a finite reserve and produces a faster timed lap',()=>{
  const regular=drive(tracks[1],steering);const boosted=drive(tracks[1],run=>({...steering(run),nitro:true}));
  assert.equal(boosted.mode,'finished');assert.ok(boosted.elapsed<regular.elapsed-1);assert.ok(boosted.nitro<.2);
  const run=createRun(tracks[0]);run.mode='racing';run.speed=18;
  for(let i=0;i<120;i++)stepRun(run,{...input,nitro:true});
  assert.ok(run.nitro<.81&&run.nitro>.79);
  const before=run.nitro;stepRun(run,input);assert.ok(run.nitro>before);
});
test('Brakes slow the car; holding steering off the track fails and a fresh run resets it',()=>{
  const run=createRun(tracks[0],'manual');run.mode='racing';run.speed=22;
  for(let i=0;i<60;i++)stepRun(run,{...input,throttle:false,brake:true});assert.ok(run.speed<8);
  const failed=drive(tracks[1],{...input,steerRight:true},'manual');assert.equal(failed.mode,'crashed');assert.match(failed.message,/pista/);
  const retry=createRun(tracks[1],'manual');assert.equal(retry.mode,'countdown');assert.equal(retry.elapsed,0);assert.equal(retry.speed,0);assert.equal(retry.nitro,1);assert.equal(retry.offset,0);
});
test('Loop stalls are a real fail condition and the fixed update is deterministic',()=>{
  const track=tracks[1];const inverted=track.frames.findIndex(f=>f.up.y<-.9);
  const run=createRun(track,'manual');run.mode='racing';run.distance=inverted/(track.frames.length-1)*track.length;run.speed=0;
  for(let i=0;i<100&&run.mode==='racing';i++)stepRun(run,{...input,throttle:false,brake:true});
  assert.equal(run.mode,'crashed');assert.match(run.message,/loop/);
  const a=drive(tracks[0]),b=drive(tracks[0]);assert.equal(a.elapsed,b.elapsed);assert.equal(a.distance,b.distance);assert.equal(STEP,1/120);
});
