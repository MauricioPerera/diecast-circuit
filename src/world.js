import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function makeMaterials() {
  const load=new T.TextureLoader();
  const base=load.load(`${import.meta.env.BASE_URL}assets/track-base.png`);base.colorSpace=T.SRGBColorSpace;
  const rough=load.load(`${import.meta.env.BASE_URL}assets/track-roughness.png`);
  const normal=load.load(`${import.meta.env.BASE_URL}assets/track-normal.png`);
  for(const t of [base,rough,normal]) {t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;}
  return {
    road:new T.MeshPhysicalMaterial({color:0xffffff,map:base,roughnessMap:rough,normalMap:normal,normalScale:new T.Vector2(.3,.3),roughness:.95,metalness:0,clearcoat:.42,clearcoatRoughness:.37,side:T.DoubleSide}),
    rail:new T.MeshStandardMaterial({color:0xf78932,roughness:.33,metalness:.06}),
    lane:new T.MeshStandardMaterial({color:0xffbb68,roughness:.5}),
    center:new T.MeshStandardMaterial({color:0xe26216,roughness:.6}),
    support:new T.MeshStandardMaterial({color:0x283039,roughness:.52,metalness:.7}),
    warning:new T.MeshBasicMaterial({color:0xffce7d,side:T.DoubleSide}),
    glow:new T.MeshStandardMaterial({color:0x5de2ff,emissive:0x00b9ee,emissiveIntensity:2,roughness:.3}),
  };
}

export function createWorld(renderer,scene) {
  scene.background=new T.Color(0x202d39);
  scene.fog=new T.Fog(0x293747,145,330);
  const pmrem=new T.PMREMGenerator(renderer), room=new RoomEnvironment();
  const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.85;room.dispose();pmrem.dispose();
  const hemi=new T.HemisphereLight(0xb5dcff,0x555051,1.05);scene.add(hemi);
  const sun=new T.DirectionalLight(0xffd3a5,2.0);sun.position.set(-45,75,-18);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:100,bottom:-100,near:.1,far:220});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun);
  const fill=new T.DirectionalLight(0xb1dfff,.85);fill.position.set(45,22,35);scene.add(fill);
  const group=new T.Group();scene.add(group);
  const concrete=new T.MeshStandardMaterial({color:0x343b42,roughness:.92,metalness:.1});
  const metal=new T.MeshStandardMaterial({color:0x282e35,roughness:.6,metalness:.6});
  const cabinets=new T.MeshStandardMaterial({color:0x7f2823,roughness:.4,metalness:.55});
  const wood=new T.MeshStandardMaterial({color:0x78604b,roughness:.8});
  const light=new T.MeshBasicMaterial({color:0xd6e7f2,toneMapped:false});
  const warm=new T.MeshBasicMaterial({color:0xffd19d,toneMapped:false});
  const floor=new T.Mesh(new T.PlaneGeometry(330,450),concrete);floor.rotation.x=-Math.PI/2;floor.position.y=-.1;floor.receiveShadow=true;group.add(floor);
  const grid=new T.GridHelper(330,66,0x58606a,0x454c54);grid.position.y=-.08;grid.material.transparent=true;grid.material.opacity=.45;group.add(grid);
  const boxes=[];
  const box=(w,h,d,mat,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);boxes.push(m);return m;};
  for(const x of [-80,80]) {
    box(1.5,62,330,metal,x,31,0);
    for(let z=-145;z<=145;z+=24) {
      box(1.6,60,1.7,metal,x,30,z);
      for(let row=0;row<3;row++) for(let col=0;col<4;col++) box(.07,5,4.1,row===2?light:warm,x+(x<0?.8:-.8),16+row*6,z-8+col*4.8);
      box(164,1.1,1.4,metal,0,58,z);
      box(38,.13,1,light,-28,57,z+4);
      box(38,.13,1,light,28,57,z+4);
    }
  }
  for(let z=-120;z<=120;z+=28) {
    box(10,3.6,3,cabinets,-64,1.8,z);
    box(11,.4,3.5,wood,-64,3.8,z);
    for(let row=0;row<4;row++) box(9.5,.055,.08,metal,-64,.7+row*.7,z+1.53);
    for(let row=0;row<4;row++) box(1.4,.09,.10,light,-64,.9+row*.7,z+1.6);
    box(8,1,5,wood,64,3.6,z+6);
    for(const dx of [-3,3])box(.35,3.3,3,metal,64+dx,1.6,z+6);
    for(let i=0;i<3;i++)box(2.1,1.8,2.1,metal,61+i*2.4,4.9,z+6);
  }
  box(160,60,2,metal,0,30,166);box(160,60,2,metal,0,30,-166);
  const grouped=new Map();for(const obj of boxes){obj.updateMatrix();const gs=grouped.get(obj.material)||[];gs.push(obj.geometry.clone().applyMatrix4(obj.matrix));grouped.set(obj.material,gs);}
  for(const [mat,gs] of grouped){group.add(new T.Mesh(mergeGeometries(gs),mat));gs.forEach(g=>g.dispose());}
  // A clear drafting floor keeps roof beams out of the workshop's plan view.
  const drafting=new T.Group();drafting.visible=false;scene.add(drafting);
  const draftingFloor=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshStandardMaterial({color:0x243441,roughness:.97}));
  draftingFloor.rotation.x=-Math.PI/2;draftingFloor.position.y=-.1;draftingFloor.receiveShadow=true;drafting.add(draftingFloor);
  const draftingGrid=new T.GridHelper(400,80,0x6b8b9e,0x3d5768);draftingGrid.position.y=-.075;drafting.add(draftingGrid);
  const racingFog=scene.fog;
  return {sun,setWorkshop(enabled){group.visible=!enabled;drafting.visible=enabled;scene.fog=enabled?null:racingFog;},dispose(){env.dispose();}};
}

export function createGantry(data,materials,cad) {
  const group=new T.Group();
  const opening=cad?.gantry?.openingWidth??cad?.openingWidth??8.2;
  const height=cad?.gantry?.height??cad?.height??4.6;
  const postWidth=cad?.gantry?.postWidth??.4;
  const beamHeight=cad?.gantry?.beamHeight??.4;
  const depth=cad?.gantry?.depth??.48;
  const f=data.sample(2);
  const shape=new T.Group();shape.position.copy(f.p);shape.quaternion.copy(f.q);group.add(shape);
  const metal=materials.support;
  for(const side of [-1,1]){
    const post=new T.Mesh(new T.BoxGeometry(postWidth,height+beamHeight,depth),metal);post.position.set(side*(opening+postWidth)/2,(height+beamHeight)/2,0);shape.add(post);
    const stripe=new T.Mesh(new T.BoxGeometry(.08,height*.6,.45),materials.glow);stripe.position.set(side*opening/2,height*.55,.03);shape.add(stripe);
  }
  const banner=new T.Mesh(new T.BoxGeometry(opening,beamHeight,depth),metal);banner.position.y=height+beamHeight/2;shape.add(banner);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#171d24';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#ff8728';ctx.font='italic 900 63px Arial';ctx.textAlign='center';ctx.fillText('DIECAST / CIRCUIT',512,86);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const sign=new T.Mesh(new T.PlaneGeometry(opening*.92,beamHeight*.92),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));sign.position.set(0,height+beamHeight/2,-depth/2-.01);sign.rotation.y=Math.PI;shape.add(sign);
  const check=document.createElement('canvas');check.width=256;check.height=64;const cx=check.getContext('2d');
  for(let y=0;y<2;y++)for(let x=0;x<16;x++){cx.fillStyle=(x+y)%2?'#141a21':'#f1ede3';cx.fillRect(x*16,y*32,16,32);}
  const texture=new T.CanvasTexture(check);texture.colorSpace=T.SRGBColorSpace;
  const line=new T.Mesh(new T.PlaneGeometry(Math.min(data.course.width,cad?.finishStripe?.width??data.course.width),cad?.finishStripe?.depth??.9),new T.MeshStandardMaterial({map:texture,roughness:.8}));line.rotation.x=-Math.PI/2;line.position.y=.025;shape.add(line);
  return group;
}
