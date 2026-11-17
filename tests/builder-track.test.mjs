import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultDraft, buildCustomTrack, normalizeDraft } from '../src/builder-track.js';
import { createRun, stepRun } from '../src/simulation.js';

function finish(track){
  const run=createRun(track,'full');
  for(let i=0;i<120*75&&['countdown','racing'].includes(run.mode);i++)stepRun(run,{throttle:true});
  return run;
}

test('The default custom circuit is closed, finite, upright at the seam and drivable',()=>{
  const built=buildCustomTrack(createDefaultDraft());
  assert.equal(built.validation.valid,true,built.validation.errors.join('; '));
  assert.equal(built.track.closed,true);
  assert.ok(built.track.frames[0].p.distanceTo(built.track.frames.at(-1).p)<.001);
  assert.ok(built.track.frames[0].up.dot(built.track.frames.at(-1).up)>.9999);
  assert.ok(built.track.frames.some(f=>f.up.y<-.95),'loop contains a real inversion');
  for(const f of built.track.frames){
    assert.ok(f.p.toArray().every(Number.isFinite));
    assert.ok(Math.abs(f.forward.dot(f.up))<1e-7);
    assert.ok(Math.abs(f.forward.dot(f.right))<1e-7);
    assert.ok(f.right.clone().cross(f.up).dot(f.forward)>.9999);
  }
  const result=finish(built.track);assert.equal(result.mode,'finished',result.message);assert.equal(result.progress,1);assert.ok(result.elapsed<30);
});

test('A loop has separated entry/exit and a smooth lateral recovery, without a crossing exemption',()=>{
  const draft=createDefaultDraft(),built=buildCustomTrack(draft),loop=built.segments[1];
  const entry=loop.points[0],exit=loop.points[200],end=loop.points.at(-1);
  assert.ok(Math.abs(exit[0]-entry[0])>=draft.width+2.9);
  assert.ok(Math.abs(end[0]-entry[0])<1e-6);
  assert.ok(Math.abs(end[2]-entry[2]-48)<1e-6);
  assert.equal(built.validation.valid,true);
});

test('Four user-placed pieces receive a tangent-continuous, playable automatic closure',()=>{
  const draft={...createDefaultDraft(),pieces:[{type:'straight',length:36},{type:'loop',radius:7},{type:'right',radius:18},{type:'right',radius:18}]};
  const built=buildCustomTrack(draft);assert.equal(built.validation.valid,true,built.validation.errors.join('; '));
  assert.ok(built.closure.length>100);assert.ok(built.closure.radius>=16);assert.equal(built.segments.at(-1).type,'closure');
  assert.equal(finish(built.track).mode,'finished');
  const mirrored=buildCustomTrack({...draft,pieces:[{type:'straight',length:36},{type:'left',radius:18},{type:'straight',length:36}]});
  assert.equal(mirrored.validation.valid,true,mirrored.validation.errors.join('; '));assert.equal(finish(mirrored.track).mode,'finished');
});

test('Open previews cannot be raced, while geometry edits change records identity',()=>{
  const draft=createDefaultDraft(),base=buildCustomTrack(draft),open=buildCustomTrack(draft,{close:false});
  assert.equal(open.validation.valid,false);assert.equal(open.track.closed,false);assert.match(open.validation.errors.join(' '),/Cierra/);
  const renamed=buildCustomTrack({...draft,name:'Otro nombre'});assert.equal(renamed.track.course.id,base.track.course.id);
  draft.pieces[1].radius=8;const edited=buildCustomTrack(draft);
  assert.equal(edited.validation.valid,true,edited.validation.errors.join('; '));assert.notEqual(edited.track.course.id,base.track.course.id);assert.notEqual(edited.track.length,base.track.length);
  assert.equal(finish(edited.track).mode,'finished');
});

test('A valid ramp remains upright and returns to floor before a turn',()=>{
  const draft=createDefaultDraft();draft.pieces[2]={type:'ramp',length:32,height:4};draft.pieces[5].length=116;
  const built=buildCustomTrack(draft);assert.equal(built.validation.valid,true,built.validation.errors.join('; '));
  const ramp=built.segments[2];assert.ok(Math.max(...ramp.points.map(p=>p[1]))>7.3);assert.equal(ramp.end[1],3.4);
  assert.equal(finish(built.track).mode,'finished');
});

test('Malformed drafts are normalized safely, and unsafe overlaps/warehouse escapes are rejected',()=>{
  const normalized=normalizeDraft({name:' x '.repeat(50),width:Infinity,pieces:[{type:'loop',radius:Infinity},{type:'missing'}]});
  assert.ok(normalized.name.length<=40);assert.equal(normalized.width,6.4);assert.equal(normalized.pieces[0].radius,7);assert.equal(normalized.pieces.length,1);
  assert.equal(buildCustomTrack({pieces:[{type:'straight',length:NaN}]}).validation.valid,false);
  const overlapping=createDefaultDraft();overlapping.pieces.push({type:'straight',length:24});
  const rejected=buildCustomTrack(overlapping);assert.equal(rejected.validation.valid,false);assert.match(rejected.validation.errors.join(' '),/cruz/);
  const tooLong={...createDefaultDraft(),pieces:Array.from({length:33},()=>({type:'straight',length:120}))};
  const overflow=buildCustomTrack(tooLong);assert.equal(overflow.validation.valid,false);assert.match(overflow.validation.errors.join(' '),/32 piezas|taller|1,100/);
  const noRunway=buildCustomTrack({...createDefaultDraft(),pieces:[{type:'straight',length:12},{type:'loop',radius:7},{type:'right',radius:18}]});
  assert.equal(noRunway.validation.valid,false);assert.match(noRunway.validation.errors.join(' '),/24 m/);
});
