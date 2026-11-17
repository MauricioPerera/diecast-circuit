import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEFAULT_CONFIGURATION, configurationKey, normalizeConfiguration } from './vehicles.js';

// All donors share the beltline, wheelbase and accessory sockets. The lower
// body and cabin each have their own longitudinal cross sections.
const bodies = {
  gt: {sections:[[-1.95,.70,.48],[-1.73,.89,.63],[-1.18,.96,.70],[-.32,.86,.66],[.48,.88,.65],[1.14,.94,.66],[1.58,.84,.58],[1.91,.72,.46]], head:.48, tail:.49, deck:.64, nose:.74},
  muscle:{sections:[[-2.08,.81,.60],[-1.84,.96,.72],[-1.18,1.00,.74],[-.40,.95,.68],[.40,.92,.69],[1.20,1.00,.74],[1.80,.94,.69],[2.13,.86,.60]],head:.59,tail:.58,deck:.71,nose:.90},
  rally:{sections:[[-1.79,.82,.68],[-1.58,.94,.75],[-1.18,1.01,.75],[-.38,.92,.69],[.46,.93,.68],[1.13,1.01,.71],[1.54,.92,.61],[1.78,.78,.52]],head:.53,tail:.63,deck:.72,nose:.79},
  prototype:{sections:[[-2.05,.83,.38],[-1.78,.99,.55],[-1.17,1.02,.67],[-.43,.93,.64],[.47,.92,.62],[1.14,1.03,.63],[1.59,.98,.48],[2.10,.84,.33]],head:.35,tail:.38,deck:.54,nose:.84},
};
const cabins = {
  gt:{sections:[[-1.10,.74,.075],[-.62,.67,.58],[-.34,.64,.64],[.29,.61,.62],[.80,.68,.08]],roof:[-.60,.29,.63,.62],trim:[-.66,.68],scoop:false},
  muscle:{sections:[[-1.62,.75,.07],[-1.14,.73,.37],[-.80,.69,.57],[-.26,.64,.61],[.43,.69,.07]],roof:[-.89,-.22,.615,.65],trim:[-.88,.63],scoop:false},
  rally:{sections:[[-1.52,.77,.13],[-1.25,.73,.72],[-.89,.68,.80],[.12,.65,.80],[.64,.67,.66],[.93,.73,.075]],roof:[-1.16,.17,.805,.66],trim:[-1.14,.63],scoop:true},
  prototype:{sections:[[-.96,.61,.055],[-.60,.58,.25],[-.26,.48,.48],[.12,.48,.50],[.53,.45,.35],[.88,.52,.07]],roof:[-.28,.12,.505,.47],trim:[-.59,.48],scoop:false},
};
const wheelSets={
  gt:{radius:.391,width:.285,spokes:5,metal:0xbac6cb,split:false,tread:false},
  muscle:{radius:.405,width:.325,spokes:5,metal:0xc5ac81,split:true,tread:false},
  rally:{radius:.423,width:.325,spokes:12,metal:0xe6e5dd,split:false,tread:true},
  prototype:{radius:.378,width:.31,spokes:7,metal:0x697b85,split:true,tread:false},
};
const exhaustSets={
  gt:{offsets:[-.36,.36],radius:.095,color:0x41caff},
  muscle:{offsets:[-.62,-.38,.38,.62],radius:.087,color:0x59bcff},
  rally:{offsets:[.53],radius:.136,color:0x53e4ff},
  prototype:{offsets:[-.155,.155],radius:.091,color:0x67a9ff},
};

function shell(sections){
  const position=[],uv=[],indices=[];
  sections.forEach(([z,w,top,bottom=.21],i)=>{
    const rise=top-bottom,bevel=Math.min(.10,rise*.34);
    for(const [j,[x,y]] of [[-w*.73,bottom],[-w,bottom+bevel],[-w,top-bevel],[-w*.78,top],[w*.78,top],[w,top-bevel],[w,bottom+bevel],[w*.73,bottom]].entries()){
      position.push(x,y,z);uv.push(j/7,i/(sections.length-1));
    }
  });
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<8;j++){
    const a=i*8+j,b=i*8+(j+1)%8,c=a+8,d=b+8;indices.push(a,c,b,b,c,d);
  }
  const end=(sections.length-1)*8;
  for(let j=1;j<7;j++)indices.push(0,j,j+1,end,end+j+1,end+j);
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(position,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
function batch(root){
  root.updateMatrixWorld(true);
  const inv=root.matrixWorld.clone().invert(),groups=new Map();
  for(const child of [...root.children]){
    if(!child.isMesh)continue;
    const list=groups.get(child.material)||[];
    list.push(child.geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,child.matrixWorld)));
    groups.set(child.material,list);root.remove(child);
  }
  for(const [material,geometries] of groups){
    const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
  }
}
function destroyMeshes(group,keepMaterials=false){
  const geometries=new Set(),materials=new Set();
  group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);if(!keepMaterials)materials.add(o.material);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>{for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();});
}

export function createCar(initial=DEFAULT_CONFIGURATION){
  const root=new T.Group(),assembly=new T.Group(),wheels=[],flames=new T.Group();
  root.add(assembly,flames);flames.visible=false;
  const paint=new T.MeshPhysicalMaterial({metalness:.68,roughness:.30,clearcoat:.9,clearcoatRoughness:.22});
  const accent=new T.MeshStandardMaterial({metalness:.22,roughness:.37});
  const glass=new T.MeshPhysicalMaterial({color:0x0d2530,metalness:.35,roughness:.15,clearcoat:1});
  const dark=new T.MeshStandardMaterial({color:0x182128,metalness:.42,roughness:.43});
  const rubber=new T.MeshStandardMaterial({color:0x101317,roughness:.91});
  const alloy=new T.MeshStandardMaterial({color:0xbec7cd,metalness:.9,roughness:.29});
  const rimColor=new T.MeshStandardMaterial({metalness:.79,roughness:.29});
  const brakeMetal=new T.MeshStandardMaterial({color:0x555b60,metalness:.75,roughness:.54});
  const red=new T.MeshStandardMaterial({color:0xc9241c,emissive:0xd52013,emissiveIntensity:.9,roughness:.28});
  const light=new T.MeshStandardMaterial({color:0xd4ebf7,emissive:0xa9dcff,emissiveIntensity:1.1,roughness:.20});
  const flameMat=new T.MeshBasicMaterial({transparent:true,opacity:.89,depthWrite:false});
  const flameCore=new T.MeshBasicMaterial({color:0xdffdff});
  const owned=[paint,accent,glass,dark,rubber,alloy,rimColor,brakeMetal,red,light,flameMat,flameCore];
  let configuration,signature='',livery=null,liveryPromise,disposed=false,wheelRadius=.391;
  const place=(group,geometry,material,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;
  };
  const box=(group,w,h,d,m,x,y,z)=>place(group,new T.BoxGeometry(w,h,d),m,x,y,z);
  const pipe=(group,r,width,m,x,y,z,axis='z',segments=18)=>{
    const mesh=place(group,new T.CylinderGeometry(r,r,width,segments),m,x,y,z);
    if(axis==='x')mesh.rotation.z=Math.PI/2;else if(axis==='z')mesh.rotation.x=Math.PI/2;
    return mesh;
  };
  function module(name,id){
    const group=new T.Group();group.name=name+':'+id;group.userData={slot:name,donor:id};assembly.add(group);return group;
  }
  function buildBody(id){
    const p=bodies[id],sections=p.sections,back=sections[0][0],front=sections.at(-1)[0],g=module('body',id);
    place(g,shell(sections),paint);
    box(g,1.58,.10,front-back-.18,dark,0,.205,(front+back)/2);
    box(g,p.nose*1.85,.075,id==='prototype'?.36:.18,dark,0,p.head-.17,front-.01);
    box(g,id==='prototype'?1.64:1.44,.12,.10,dark,0,p.tail-.14,back+.015);
    for(const s of [-1,1]){
      box(g,.045,.065,2.19,dark,s*.9,.23,0);
      box(g,.065,.039,1.24,accent,s*.906,.43,-.045);
      const lamp=box(g,id==='muscle'?.43:.41,id==='rally'?.105:.065,.075,light,s*p.nose*.64,p.head,front-.052);lamp.rotation.y=s*.07;
      box(g,id==='muscle'?.39:.44,.069,.064,red,s*.51,p.tail,back-.022);
      box(g,.46,.111,.038,dark,s*.50,p.tail-.12,back-.03);
      for(const z of [-1.16,1.14]){
        const flare=place(g,new T.TorusGeometry(.425,id==='rally'?.078:.04,6,22,Math.PI*1.27),id==='rally'?dark:paint,s*(id==='prototype'?.99:.96),.39,z);
        flare.rotation.set(-.43,Math.PI/2,0);
      }
      for(let i=0;i<3;i++)box(g,.032,.056,.09,dark,s*.91,.51,.36+i*.10);
    }
    if(id==='muscle'){
      box(g,.59,.11,.54,paint,0,.755,1.10);box(g,.43,.070,.043,dark,0,.765,1.39);
      for(const s of [-1,1])box(g,.122,.018,.52,accent,s*.25,.757,1.61);
    }else if(id==='rally'){
      box(g,1.47,.19,.13,dark,0,.37,front+.01);
      for(const s of [-1,1])pipe(g,.110,.08,light,s*.38,.48,front+.08);
    }else if(id==='prototype'){
      for(const s of [-1,1]){
        const wing=box(g,.092,.19,.62,accent,s*.92,.42,1.61);wing.rotation.y=s*.21;
        box(g,.63,.029,.55,dark,s*.54,.59,1.13).rotation.x=.11;
      }
    }else{
      for(const s of [-1,1])for(let i=0;i<4;i++)box(g,.065,.019,.29,dark,s*(.42+i*.079),.72,-1.25);
    }
    batch(g);return p;
  }
  function buildCabin(id){
    const p=cabins[id],g=module('cabin',id),base=.615;
    place(g,shell(p.sections.map(([z,w,h])=>[z,w,base+h,base-.025])),glass);
    const [z1,z2,y,w]=p.roof;
    box(g,w*2,.042,z2-z1,paint,0,base+y,(z1+z2)/2);
    if(id!=='prototype')for(const s of [-1,1]){
      box(g,.035,.044,z2-z1+.24,alloy,s*(w+.055),base+.105,(z1+z2)/2);
      box(g,.039,.45,.067,paint,s*(w+.034),base+.28,(z1+z2)*.5+.12).rotation.z=s*.12;
      box(g,.167,.115,.235,paint,s*.929,base+.172,.49);
      box(g,.060,.089,.24,dark,s*.837,base+.153,.49);
    }
    for(const s of [-1,1])box(g,id==='prototype'?.108:.084,.008,(z2-z1)*.94,accent,s*.20,base+y+.024,(z1+z2)/2);
    if(p.scoop){box(g,.45,.08,.38,paint,0,base+y+.052,-.43);box(g,.34,.034,.055,dark,0,base+y+.069,-.222);}
    batch(g);
  }
  function buildWheels(id){
    const p=wheelSets[id],group=module('wheels',id);wheelRadius=p.radius;rimColor.color.setHex(p.metal);
    for(const s of [-1,1])for(const z of [-1.16,1.14]){
      const wheel=new T.Group();wheel.name='Rueda '+(s<0?'izquierda':'derecha');wheel.position.set(s*.95,p.radius,z);group.add(wheel);wheels.push(wheel);
      const face=s*(p.width*.5+.012);
      pipe(wheel,p.radius,p.width,rubber,0,0,0,'x',28);
      const sidewall=place(wheel,new T.TorusGeometry(p.radius*.925,.015,6,28),rubber,s*p.width*.48,0,0);sidewall.rotation.y=Math.PI/2;
      pipe(wheel,p.radius*.725,p.width+.014,dark,0,0,0,'x',24);
      pipe(wheel,p.radius*.58,.022,brakeMetal,face-s*.018,0,0,'x',20);
      const ring=place(wheel,new T.TorusGeometry(p.radius*.71,.018,6,24),rimColor,face,0,0);ring.rotation.y=Math.PI/2;
      for(let k=0;k<p.spokes;k++){
        const a=k/p.spokes*2*Math.PI;
        const spoke=box(wheel,.030,id==='rally'?.026:.048,p.radius*.62,rimColor,face,-Math.sin(a)*p.radius*.36,Math.cos(a)*p.radius*.36);spoke.rotation.x=a+(p.split?.12:0);
      }
      pipe(wheel,p.radius*.20,.043,rimColor,face+s*.015,0,0,'x',12);
      if(p.tread)for(let k=0;k<18;k++){
        const a=k/18*2*Math.PI;
        const block=box(wheel,p.width*.89,.015,.057,rubber,0,Math.cos(a)*(p.radius-.004),Math.sin(a)*(p.radius-.004));block.rotation.x=a;
      }
      batch(wheel);
    }
  }
  function buildSpoiler(id,p){
    const g=module('spoiler',id),z=p.sections[0][0]+.31,y=p.deck;
    if(id==='muscle'){
      place(g,shell([[z-.23,.81,y+.17,y+.095],[z-.09,.83,y+.13,y+.055],[z+.07,.74,y+.05,y+.016]]),paint);
      box(g,1.58,.030,.052,accent,0,y+.165,z-.223);
    }else{
      const specs={gt:[1.61,.30,.29,.55],rally:[1.36,.48,.20,.53],prototype:[1.86,.44,.35,.62]};
      const [w,h,d,post]=specs[id];
      for(const s of [-1,1]){
        box(g,.054,h,.135,dark,s*post,y+h*.48,z+.02).rotation.x=.13;
        if(id!=='rally')box(g,.070,.17,d+.035,paint,s*(w*.5+.012),y+h,z);
      }
      const plane=box(g,w,.056,d,id==='rally'?paint:dark,0,y+h,z);plane.rotation.x=.11;
      box(g,w*.94,.03,.064,accent,0,y+h+.025,z-.11);
      if(id==='prototype')box(g,w*.88,.041,.17,paint,0,y+h+.10,z+.048).rotation.x=.09;
    }
    batch(g);
  }
  function buildExhaust(id,p){
    const g=module('exhaust',id),spec=exhaustSets[id],back=p.sections[0][0]-.08;
    flameMat.color.setHex(spec.color);
    for(const x of spec.offsets){
      const y=id==='prototype'?Math.max(.30,p.tail-.09):.28;
      pipe(g,spec.radius,.22,alloy,x,y,back);
      const mouth=place(g,new T.CircleGeometry(spec.radius*.74,16),dark,x,y,back-.114);mouth.rotation.y=Math.PI;
      const jet=new T.Group();jet.position.set(x,y,back-.116);flames.add(jet);
      for(const [material,r,length] of [[flameMat,spec.radius*1.05,1.28],[flameCore,spec.radius*.60,.73]]){
        const flame=place(jet,new T.ConeGeometry(r,length,10),material,0,0,-length*.5);flame.rotation.x=-Math.PI/2;flame.castShadow=false;
      }
    }
    batch(g);
  }
  function setConfiguration(input){
    if(disposed)return;
    configuration=normalizeConfiguration(input);root.name=configuration.name;root.userData.parts={...configuration.parts};
    paint.color.set(configuration.paint);accent.color.set(configuration.accent);
    const key=configurationKey(configuration);
    if(key!==signature){
      destroyMeshes(assembly,true);destroyMeshes(flames,true);assembly.clear();flames.clear();wheels.length=0;
      const {body,cabin,wheels:wheel,spoiler,exhaust}=configuration.parts,p=buildBody(body);
      buildCabin(cabin);buildWheels(wheel);buildSpoiler(spoiler,p);buildExhaust(exhaust,p);signature=key;
    }
    if(livery)livery.visible=configuration.parts.body==='gt'&&configuration.paint===DEFAULT_CONFIGURATION.paint;
  }
  async function loadLivery(){
    if(!liveryPromise)liveryPromise=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/racing-hood.glb`).then(gltf=>{
      if(disposed){destroyMeshes(gltf.scene);return null;}
      livery=gltf.scene;livery.position.set(0,.708,1.04);livery.name='Capó con calca 02 de TextureCraft';livery.rotation.x=-.079;root.add(livery);
      setConfiguration(configuration);return livery;
    });
    return liveryPromise;
  }
  setConfiguration(initial);
  return {root,wheels,flames,setConfiguration,loadLivery,
    update(speed,boost,time,dt=1/60){for(const wheel of wheels)wheel.rotation.x+=speed/wheelRadius*dt;flames.visible=boost;for(const jet of flames.children)jet.scale.z=.85+.24*Math.sin(time*59);},
    dispose(){if(disposed)return;disposed=true;destroyMeshes(assembly,true);destroyMeshes(flames,true);if(livery)destroyMeshes(livery);owned.forEach(m=>m.dispose());root.clear();wheels.length=0;}
  };
}
