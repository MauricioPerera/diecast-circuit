import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3,Vector3 } from 'three';
import { createCar } from '../src/car.js';
import { DONORS,SLOTS,DEFAULT_CONFIGURATION,stockConfiguration,normalizeConfiguration,configurationKey } from '../src/vehicles.js';

test('Four donor cars assemble five finite modules on the same wheelbase',()=>{
  const silhouettes=[];
  for(const donor of DONORS){
    const car=createCar(stockConfiguration(donor.id));
    for(const slot of SLOTS)assert.ok(car.root.getObjectByName(`${slot.id}:${donor.id}`));
    const bounds=new Box3().setFromObject(car.root.getObjectByName(`body:${donor.id}`));
    silhouettes.push(bounds.getSize(new Vector3()).toArray().map(n=>n.toFixed(3)).join(':'));
    assert.equal(car.wheels.length,4);
    for(const wheel of car.wheels){const box=new Box3().setFromObject(wheel);assert.ok(Math.abs(box.min.y)<.013);}
    // Envelope includes the prototype's front splitter and the exhaust tips.
    const size=new Box3().setFromObject(car.root.children[0]).getSize(new Vector3());assert.ok(size.x<2.5&&size.y<1.6&&size.z<4.6);
    let triangles=0;car.root.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
    assert.ok(triangles<40000);car.dispose();
  }
  assert.equal(new Set(silhouettes).size,4);
});
test('Swapping a donor rebuilds actual modules, preserves the transform and disposes old geometry',()=>{
  const car=createCar(),root=car.root;root.position.set(2,3,4);root.rotation.y=.7;
  const original=root.getObjectByName('body:gt');let disposed=0;
  original.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>disposed++);});
  const parts={body:'muscle',cabin:'prototype',wheels:'rally',spoiler:'gt',exhaust:'prototype'};
  car.setConfiguration({name:'Mix',parts});
  assert.equal(car.root,root);assert.deepEqual(root.position.toArray(),[2,3,4]);assert.equal(root.rotation.y,.7);assert.ok(disposed>0);
  assert.deepEqual(root.userData.parts,parts);
  for(const [slot,id]of Object.entries(parts))assert.ok(root.getObjectByName(`${slot}:${id}`));
  const rebuilt=root.getObjectByName('body:muscle');
  car.setConfiguration({name:'Repintado',parts,paint:'#000000'});assert.equal(root.getObjectByName('body:muscle'),rebuilt);
  car.update(18,true,1,.02);assert.ok(car.wheels.every(w=>w.rotation.x>0));assert.equal(car.flames.visible,true);
  car.update(0,false,1,.02);assert.equal(car.flames.visible,false);car.dispose();assert.equal(root.children.length,0);
});
test('Configuration rejects unknown donors and invalid color values',()=>{
  const clean=normalizeConfiguration({name:' '.repeat(4)+'A'.repeat(80),parts:{body:'missing',wheels:'rally'},paint:'blue',accent:'#ABCDEF'});
  assert.equal(clean.name.length,40);assert.equal(clean.parts.body,'gt');assert.equal(clean.parts.wheels,'rally');assert.equal(clean.paint,DEFAULT_CONFIGURATION.paint);assert.equal(clean.accent,'#abcdef');
  assert.notEqual(configurationKey(clean),configurationKey(DEFAULT_CONFIGURATION));
  assert.equal(configurationKey({...clean,paint:'#fff000',name:'Paint'}),configurationKey(clean));
});
