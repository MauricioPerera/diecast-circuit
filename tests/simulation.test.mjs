import test from 'node:test';
import assert from 'node:assert/strict';
import { courses } from '../src/courses.js';
import { createTrackData } from '../src/track.js';
import { createRun, stepRun, STEP } from '../src/simulation.js';

const tracks=courses.map(createTrackData);
const input={throttle:true,brake:false,nitro:false,steerLeft:false,steerRight:false};
function drive(track,controls=input,assist='full') {
  const run=createRun(track,assist);let ticks=0;
  while((run.mode==='countdown'||run.mode==='racing')&&ticks++<120*80)stepRun(run,controls);
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
test('A beginner can finish every course with full assists and throttle',()=>{
  for(const track of tracks){const run=drive(track);assert.equal(run.mode,'finished',track.course.name);assert.equal(run.progress,1);assert.equal(run.collisions,0);assert.ok(run.elapsed<35);}
});
test('Nitro consumes a finite reserve and produces a faster timed lap',()=>{
  const regular=drive(tracks[1]);const boosted=drive(tracks[1],{...input,nitro:true});
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
