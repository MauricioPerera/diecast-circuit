import * as T from 'three';
import { courses, assists } from './courses.js';
import { createTrackData, buildTrack } from './track.js';
import { createCar } from './car.js';
import { makeMaterials, createWorld, createGantry } from './world.js';
import { createRun, stepRun, STEP } from './simulation.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTrackBuilder } from './builder.js';
import { createGarage } from './garage.js';
import { DEFAULT_CONFIGURATION, normalizeConfiguration, configurationKey, getVehicleStats } from './vehicles.js';
import { createVehicleRecordStore } from './vehicle-records.js';
import { createRoomClient, roomCodePattern } from './online-client.js';
import { createOnlineCars } from './online-cars.js';
import { createOnlineUI } from './online-ui.js';
import './style.css';

const mount=document.querySelector('#game');
const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.5:1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
mount.append(renderer.domElement);
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(55,1,.08,500);
const world=createWorld(renderer,scene);
const materials=makeMaterials();
let vehicleConfiguration=normalizeConfiguration(DEFAULT_CONFIGURATION),vehicleStats=getVehicleStats(vehicleConfiguration);
const car=createCar(vehicleConfiguration);scene.add(car.root);
const diagnosticsEnabled=import.meta.env.DEV||new URLSearchParams(location.search).has('qa');
const audio=createAudio();
let cad;
let selected=courses[1], assistId='full', mode='menu', run, track, trackGroup, gantry, result;
let cameraMode=0, muted=false, elapsed=0, last=performance.now(), accumulator=0, frameCount=0, freeze=false;
let lastCountdown=4, frameDelta=0, quake=0, assetErrors=[];
let lastMenuCourse=selected,editorView='perspective',garageView='perspective',editorRect=null;
const editorSurface=document.createElement('div');
editorSurface.id='builder-camera-control';
Object.assign(editorSurface.style,{position:'fixed',display:'none',zIndex:'2',touchAction:'none',cursor:'grab'});
editorSurface.setAttribute('aria-label','Vista previa 3D. Arrastra para girar la pista.');
document.body.append(editorSurface);
const editorOrbit=new OrbitControls(camera,editorSurface);
editorOrbit.enabled=false;editorOrbit.enableDamping=true;editorOrbit.dampingFactor=.12;
editorOrbit.minDistance=8;editorOrbit.maxDistance=400;editorOrbit.maxPolarAngle=Math.PI/2-.02;
const selectedPiece=new T.Group();scene.add(selectedPiece);
const showroom=new T.Group();showroom.visible=false;scene.add(showroom);
const plinth=new T.Mesh(new T.CylinderGeometry(3.1,3.2,.2,64),new T.MeshStandardMaterial({color:0x18242c,metalness:.6,roughness:.42}));plinth.position.y=-.1;plinth.receiveShadow=true;showroom.add(plinth);
const rim=new T.Mesh(new T.TorusGeometry(3.11,.028,8,64),new T.MeshBasicMaterial({color:0xf78a2d}));rim.rotation.x=Math.PI/2;rim.position.y=.015;showroom.add(rim);
const showroomShadow=(()=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,31);
  gradient.addColorStop(0,'rgba(0,0,0,.8)');gradient.addColorStop(.48,'rgba(0,0,0,.55)');gradient.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadow=new T.Mesh(new T.PlaneGeometry(3.65,5.7),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.006;return shadow;
})();
showroom.add(showroomShadow);
const recordStore=createVehicleRecordStore();let records=recordStore.forConfiguration(vehicleConfiguration);
const keys=new Set(),touch=new Set();
const input={throttle:false,brake:false,steerLeft:false,steerRight:false,nitro:false};
const view={mode,courseId:selected.id,assistId,records,speed:0,elapsed:0,nitro:1,progress:0,countdown:3,message:'',muted,result:null};
const onlineCars = createOnlineCars(scene);
let onlineRace = null;
let lastOnlineRaceId;
let soloSelection;
let roomState;
let nickname = '';
try { nickname = localStorage.getItem('diecast-circuit.nickname')?.slice(0,20) || ''; } catch {}

function clearInput(){keys.clear();touch.clear();for(const k of Object.keys(input))input[k]=false;}
function studioMode(){return mode==='builder'||mode==='garage';}
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;
  if(mode==='menu'&&w>760)camera.setViewOffset(w,h,-w*.21,0,w,h);else camera.clearViewOffset();
  if(studioMode())resizeBuilderViewport();
  camera.updateProjectionMatrix();
}
function disposeGeometry(group){
  if(!group)return;
  const shared=new Set(Object.values(materials));
  group.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.isInstancedMesh)o.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material]){if(!shared.has(material)){material.map?.dispose();material.dispose();}}}});scene.remove(group);
}
function loadCourse(course){
  loadTrack(createTrackData(course));
}
function loadTrack(next){
  selected=next.course;disposeGeometry(trackGroup);disposeGeometry(gantry);
  track=next;trackGroup=buildTrack(track,materials);scene.add(trackGroup);
  gantry=createGantry(track,materials,cad);scene.add(gantry);
  run=createRun(track,assistId,vehicleStats);view.courseId=selected.id;result=null;
  placeCar(track.sample(15),0);if(!studioMode())updateCamera(1,true);drawMinimap();
}
function start(roomStart = null){
  if(studioMode() || mode==='online' && !roomStart || onlineRace && !roomStart)return;
  world.setWorkshop(false);
  showroom.visible=false;
  audio.unlock();clearInput();run=createRun(track,assistId,vehicleStats);mode='countdown';result=null;view.result=null;lastCountdown=4;quake=0;accumulator=0;
  if (roomStart) {
    run.countdown = Math.max(0, (roomStart.startAt - roomClient.now()) / 1000);
  }
  car.root.visible=true;placeCar(track.sample(run.distance), run.offset);resize();updateCamera(1,true);syncUI();
}
function pause(){if(!onlineRace&&(mode==='racing'||mode==='countdown')){mode='paused';clearInput();audio.update(0,false,false);syncUI();}}
function resume(){if(mode==='paused'){mode=run.mode;clearInput();audio.unlock();syncUI();}}
function menu(){if(onlineRace){leaveOnline();return;}if(selected.id.startsWith('custom-')){openBuilder();return;}showMenu();}
function showMenu(){mode='menu';world.setWorkshop(false);showroom.visible=false;if(trackGroup)trackGroup.visible=true;if(gantry)gantry.visible=true;editorOrbit.enabled=false;editorSurface.style.display='none';selectedPiece.visible=false;clearInput();audio.update(0,false,false);run=createRun(track,assistId,vehicleStats);car.root.visible=true;placeCar(track.sample(15),0);resize();updateCamera(1,true);syncUI();}
function openBuilder(){
  if(courses.includes(selected))lastMenuCourse=selected;
  mode='builder';editorView='perspective';clearInput();audio.update(0,false,false);car.root.visible=false;
  showroom.visible=false;editorSurface.id='builder-camera-control';editorSurface.setAttribute('aria-label','Vista previa 3D. Arrastra para girar la pista.');
  world.setWorkshop(true);
  editorSurface.style.display='block';editorOrbit.enabled=true;camera.clearViewOffset();
  builder.open();resize();fitBuilderCamera();syncUI();
}
const ui=createUI({courses,assists,
  onCourse(id){if(mode==='menu'){loadCourse(courses.find(c=>c.id===id)||selected);syncUI();}},
  onAssist(id){if(mode==='menu'&&assists.some(a=>a.id===id)){assistId=id;view.assistId=id;run.assistId=id;syncUI();}},
  onStart:()=>start(),onPause:pause,onResume:resume,onRetry:()=>start(),onMenu:menu,onBuild:openBuilder,onGarage:openGarage,onOnline:openOnline,onLeaveOnline:leaveOnline,
  onMute(){muted=!muted;view.muted=muted;audio.unlock();audio.mute(muted);syncUI();},
  onCamera(){cameraMode=1-cameraMode;},
  onTouch(action,pressed){if(pressed){touch.add(action);audio.unlock();}else touch.delete(action);},
});
const builder=createTrackBuilder({
  onPreview(next,{fit}){
    if(next)loadTrack(next);
    else {disposeGeometry(trackGroup);disposeGeometry(gantry);trackGroup=gantry=null;}
    car.root.visible=false;
    requestAnimationFrame(()=>{if(mode==='builder'){resize();fitBuilderCamera({preserveDirection:!fit});}});
  },
  onSelect(segment){highlightPiece(segment);},
  onPlay(next){editorOrbit.enabled=false;editorSurface.style.display='none';selectedPiece.visible=false;mode='menu';loadTrack(next);start();},
  onExit(){mode='menu';loadCourse(lastMenuCourse);showMenu();},
  onView(value){editorView=value;fitBuilderCamera();},
});
const garage=createGarage({
  onPreview(configuration,{fit=true}={}){
    car.setConfiguration(configuration);car.root.visible=true;car.root.position.set(0,0,0);car.root.quaternion.identity();
    if(fit)requestAnimationFrame(()=>{if(mode==='garage'){resize();fitGarageCamera();}});
  },
  onExit(configuration){activateVehicle(configuration);showMenu();},
  onView(value){garageView=value;fitGarageCamera();},
});
const roomClient = createRoomClient(handleRoomState, message => {
  if (onlineRace?.raceId === message.raceId) onlineCars.ingest(message);
});
roomState = roomClient.state;
const onlineUI = createOnlineUI({
  courses, assists,
  onCreate: name => connectOnline(name),
  onJoin: (code, name) => connectOnline(name, code),
  onSettings: settings => roomClient.send({ type: 'settings', ...settings }),
  onReady: ready => roomClient.send({ type: 'ready', ready }),
  onStart: () => roomClient.send({ type: 'start' }),
  onRematch: () => roomClient.send({ type: 'rematch' }),
  onLeave: leaveOnline,
});

function updateOnlineUI() {
  const code = new URLSearchParams(location.search).get('sala')?.toUpperCase();
  onlineUI.update({ ...roomState, active: mode === 'online', nickname, prefillCode: roomCodePattern.test(code ?? '') ? code : '' });
}

function openOnline() {
  if (mode !== 'menu') return;
  soloSelection = { course: selected, assistId };
  mode = 'online';
  clearInput();
  resize();
  updateCamera(1, true);
  syncUI();
  updateOnlineUI();
  onlineUI.focus?.();
}

function connectOnline(name, code = '') {
  nickname = name.trim();
  if (nickname && nickname.length <= 20) {
    try { localStorage.setItem('diecast-circuit.nickname', nickname); } catch {}
  }
  audio.unlock();
  roomClient.connect({ code: code.trim().toUpperCase(), name: nickname, vehicle: vehicleConfiguration });
}

function showOnlineRoom() {
  mode = 'online';
  clearInput();
  audio.update(0, false, false);
  onlineCars.clear();
  onlineRace = null;
  resize();
  syncUI();
  updateOnlineUI();
}

function leaveOnline() {
  mode = 'menu';
  onlineRace = null;
  lastOnlineRaceId = undefined;
  onlineCars.clear();
  roomClient.leave();
  if (soloSelection) {
    assistId = soloSelection.assistId;
    loadCourse(soloSelection.course);
    soloSelection = undefined;
  }
  showMenu();
  updateOnlineUI();
  document.querySelector('.menu-online-entry')?.focus({ preventScroll: true });
}

function handleRoomState(next) {
  const oldRoom = roomState?.room;
  roomState = next;
  const room = next.room;
  if (!room && onlineRace) showOnlineRoom();
  if (room?.phase === 'race') {
    const player = room.players.find(item => item.id === next.selfId);
    if (player?.status === 'racing' && lastOnlineRaceId !== room.raceId) {
      const course = courses.find(item => item.id === room.courseId);
      if (!course) return;
      onlineRace = { raceId: room.raceId, startAt: room.startAt, sentAt: -Infinity };
      lastOnlineRaceId = room.raceId;
      assistId = room.assistId;
      loadCourse(course);
      onlineCars.sync(room.players, next.selfId, track);
      start(room);
    } else if (onlineRace) {
      if (player?.status !== 'racing') showOnlineRoom();
      else if (!onlineRace.completion) onlineCars.sync(room.players, next.selfId, track);
    }
  } else if (onlineRace) {
    showOnlineRoom();
  }
  // Seed the room with the host's existing menu choices once on creation.
  if (!oldRoom && room?.phase === 'lobby' && room.hostId === next.selfId && soloSelection) {
    roomClient.send({ type: 'settings', courseId: soloSelection.course.id, assistId: soloSelection.assistId });
  }
  updateOnlineUI();
}

function sendPosition() {
  if (!onlineRace) return;
  roomClient.send({ type: 'tick', raceId: onlineRace.raceId, distance: run.distance, offset: run.offset, speed: run.speed, boost: run.boost });
}

function sendOnlineResult() {
  if (onlineRace.completion === 'finish') sendPosition();
  roomClient.send({ type: onlineRace.completion, raceId: onlineRace.raceId });
  onlineRace.sentAt = performance.now();
}

function reportOnlineResult(type) {
  onlineRace.completion = type;
  sendOnlineResult();
  mode = 'online';
  onlineCars.clear();
  updateOnlineUI();
}
activateVehicle(garage.getConfiguration());
function activateVehicle(configuration){
  vehicleConfiguration=normalizeConfiguration(configuration);vehicleStats=getVehicleStats(vehicleConfiguration);
  records=recordStore.forConfiguration(vehicleConfiguration);car.setConfiguration(vehicleConfiguration);
}
function openGarage(){
  mode='garage';garageView='perspective';clearInput();audio.update(0,false,false);world.setWorkshop(true);showroom.visible=true;selectedPiece.visible=false;
  if(trackGroup)trackGroup.visible=false;if(gantry)gantry.visible=false;
  car.root.position.set(0,0,0);car.root.quaternion.identity();car.root.visible=true;
  editorSurface.id='garage-camera-control';editorSurface.setAttribute('aria-label','Vista previa 3D. Arrastra para girar el coche.');editorSurface.style.display='block';editorOrbit.enabled=true;camera.clearViewOffset();
  garage.open();resize();fitGarageCamera();syncUI();
}
function resizeBuilderViewport(){
  const prefix=mode==='garage'?'garage':'builder';
  const panel=document.querySelector(`.${prefix}-panel`)?.getBoundingClientRect();
  const header=document.querySelector(`.${prefix}-header`)?.getBoundingClientRect();
  const footer=document.querySelector(`.${prefix}-footer`)?.getBoundingClientRect();
  const top=header?.bottom||64;
  const stacked=panel&&panel.width>innerWidth*.8&&panel.top>top+8;
  const x=stacked?0:panel?.right||360;
  const bottom=stacked?panel.top:footer?.top||innerHeight-100;
  editorRect={x:Math.round(x),y:Math.round(top),width:Math.max(1,Math.round(innerWidth-x)),height:Math.max(1,Math.round(bottom-top))};
  Object.assign(editorSurface.style,{left:`${editorRect.x}px`,top:`${editorRect.y}px`,width:`${editorRect.width}px`,height:`${editorRect.height}px`});
  camera.aspect=editorRect.width/editorRect.height;
}
function fitGarageCamera({preserveDirection=false}={}){
  if(mode!=='garage')return;
  resizeBuilderViewport();camera.clearViewOffset();camera.fov=38;camera.up.set(0,1,0);camera.far=650;
  const center=new T.Vector3(0,.65,0),radius=2.6;
  const v=T.MathUtils.degToRad(camera.fov),h=2*Math.atan(Math.tan(v/2)*camera.aspect);
  const distance=Math.max(6.5,radius/Math.sin(Math.min(v,h)/2)*1.10);
  const angles={front:[0,.15,1],side:[1,.16,0],rear:[0,.2,-1],perspective:[.85,.55,1]};
  const direction=preserveDirection?camera.position.clone().sub(editorOrbit.target).normalize():new T.Vector3(...(angles[garageView]||angles.perspective)).normalize();
  editorOrbit.minDistance=3.8;editorOrbit.maxDistance=30;
  camera.position.copy(center).addScaledVector(direction,distance);editorOrbit.target.copy(center);editorOrbit.update();camera.updateProjectionMatrix();
}
function fitBuilderCamera({preserveDirection=false}={}){
  if(mode!=='builder')return;
  resizeBuilderViewport();camera.clearViewOffset();camera.fov=48;camera.up.set(0,1,0);
  const box=trackGroup&&track?new T.Box3().setFromPoints(track.frames.map(f=>f.p)):new T.Box3(new T.Vector3(-10,0,-10),new T.Vector3(10,5,10));
  box.expandByScalar(5);const center=box.getCenter(new T.Vector3()),radius=box.getBoundingSphere(new T.Sphere()).radius;
  const v=T.MathUtils.degToRad(camera.fov),h=2*Math.atan(Math.tan(v/2)*camera.aspect);
  const distance=Math.max(35,radius/Math.sin(Math.min(v,h)/2)*1.08);
  editorOrbit.minDistance=8;
  editorOrbit.maxDistance=Math.max(400,distance*1.5);camera.far=Math.max(650,distance*3);
  const direction=preserveDirection?camera.position.clone().sub(editorOrbit.target).normalize():editorView==='top'?new T.Vector3(0,1,.0001):new T.Vector3(.85,1.2,1).normalize();
  camera.position.copy(center).addScaledVector(direction,distance);editorOrbit.target.copy(center);editorOrbit.update();camera.updateProjectionMatrix();
}
function highlightPiece(segment){
  for(const child of [...selectedPiece.children]){child.geometry?.dispose();child.material?.dispose();selectedPiece.remove(child);}
  selectedPiece.visible=mode==='builder';if(!segment)return;
  const raw=segment.points||[segment.start,segment.end];
  const points=raw.filter(Boolean).map(p=>new T.Vector3(...(Array.isArray(p)?p:p.toArray())).add(new T.Vector3(0,.07,0)));
  if(points.length>1){const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x78e7ff,depthTest:false}));line.renderOrder=4;selectedPiece.add(line);}
  if(points.length){const dot=new T.Mesh(new T.SphereGeometry(.55,12,8),new T.MeshBasicMaterial({color:0x78e7ff}));dot.position.copy(points.at(-1));selectedPiece.add(dot);}
}
function readInput(){
  input.throttle=keys.has('KeyW')||keys.has('ArrowUp')||touch.has('throttle');
  input.brake=keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake');
  input.steerLeft=keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('steerLeft');
  input.steerRight=keys.has('KeyD')||keys.has('ArrowRight')||touch.has('steerRight');
  input.nitro=keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('Space')||touch.has('nitro');
}
addEventListener('keydown',e=>{
  if(studioMode() || mode==='online')return;
  if ((e.code==='Enter'||e.code==='Space') && e.target.closest?.('button,a,input,select,textarea') && !e.target.closest('[data-touch]')) return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter'].includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='Escape'){if(mode==='paused')resume();else pause();}
  if(e.code==='KeyR'&&mode!=='menu'&&!onlineRace)start();
  if(e.code==='KeyC')cameraMode=1-cameraMode;
  if(e.code==='Enter'){if(mode==='menu'||mode==='finished'||mode==='crashed')start();else if(mode==='paused')resume();}
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{clearInput();pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();}});
addEventListener('resize',()=>{resize();if(mode==='builder')fitBuilderCamera({preserveDirection:true});else if(mode==='garage')fitGarageCamera({preserveDirection:true});});

const cameraPosition=new T.Vector3(),cameraTarget=new T.Vector3(),targetUp=new T.Vector3(0,1,0);
function placeCar(f,offset){
  car.root.position.copy(f.p).addScaledVector(f.right,offset).addScaledVector(f.up,.02);
  car.root.quaternion.copy(f.q);
  if(mode==='racing')car.root.rotateY(run.lateral*.025);
}
function updateCamera(dt,snap=false){
  const menuView=mode==='menu'||mode==='online';
  const f=track.sample(menuView?15:run.distance);
  if(menuView){
    cameraPosition.copy(f.p).addScaledVector(f.right,14).addScaledVector(f.up,8.2).addScaledVector(f.forward,-14.5);
    cameraTarget.copy(f.p).addScaledVector(f.up,3.3).addScaledVector(f.forward,6.3);
    targetUp.set(0,1,0);
  }else{
    const far=cameraMode===1;
    // Follow an earlier point ON the track. A tangent offset would put the
    // camera outside the loop's solid ribbon at the apex and hide the car.
    const trailing=track.sample(run.distance-(far?12.5:8.2));
    const bend=Math.max(0,1-f.forward.dot(trailing.forward));
    const look=track.sample(run.distance+(far?11:7)*(1-Math.min(.97,bend*2)));
    cameraPosition.copy(trailing.p).addScaledVector(trailing.right,run.offset*.85).addScaledVector(trailing.up,far?5.6:3.6);
    cameraTarget.copy(look.p).addScaledVector(f.right,run.offset*.4).addScaledVector(f.up,.6);
    targetUp.copy(f.up).add(trailing.up).normalize();
  }
  const blend=snap?1:1-Math.exp(-dt*9);
  camera.position.lerp(cameraPosition,blend);camera.up.lerp(targetUp,snap?1:1-Math.exp(-dt*7)).normalize();
  if(quake>.001){camera.position.addScaledVector(f.right,Math.sin(elapsed*113)*quake);quake*=Math.exp(-dt*9);}
  camera.lookAt(cameraTarget);
  const portrait=innerWidth/innerHeight<.8;
  const loopBend=menuView?0:Math.max(0,1-track.sample(run.distance).forward.dot(track.sample(run.distance-8.2).forward));
  const targetFov=menuView?48:(portrait?66+Math.min(16,loopBend*20):cameraMode?59:57)+(run.boost?7:0)+Math.min(run.speed/20,2);
  camera.fov=T.MathUtils.lerp(camera.fov,targetFov,blend);camera.updateProjectionMatrix();
}
function finish(){
  result={time:run.elapsed,...recordStore.record(selected.id,assistId,run.elapsed,vehicleConfiguration)};view.result=result;
}
function syncUI(){
  document.querySelector('#game-ui').hidden=studioMode()||mode==='online';
  Object.assign(view,{mode,course:selected,vehicle:vehicleConfiguration,vehicleKey:configurationKey(vehicleConfiguration),assistId,courseId:selected.id,records,speed:run?.speed*3.6||0,elapsed:run?.elapsed||0,nitro:run?.nitro??1,progress:run?.progress||0,countdown:Math.max(1,Math.ceil(run?.countdown||0)),message:run?.message||'',muted,result});
  const room = onlineRace && roomState.room;
  if (room && mode === 'racing') view.elapsed = Math.max(0, (roomClient.now() - room.startAt) / 1000);
  view.online = room ? { code: room.code, total: room.players.length, position: onlineCars.racePosition(run.distance, room.players, roomState.selfId) } : null;
  ui.update(view);
}
function drawMinimap(){
  const canvas=document.querySelector('#minimap');if(!canvas||!track)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  const points=track.frames;
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const f of points){minX=Math.min(minX,f.p.x);maxX=Math.max(maxX,f.p.x);minZ=Math.min(minZ,f.p.z);maxZ=Math.max(maxZ,f.p.z);}
  const scale=Math.min((w-22)/(maxX-minX),(h-20)/(maxZ-minZ));
  const xy=p=>[(p.x-(minX+maxX)/2)*scale+w/2,(p.z-(minZ+maxZ)/2)*scale+h/2];
  ctx.beginPath();points.forEach((f,i)=>{const p=xy(f.p);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.strokeStyle='#78838b';ctx.lineWidth=3;ctx.stroke();
  const start=xy(points[0].p);ctx.fillStyle='#ff8b31';ctx.fillRect(start[0]-4,start[1]-4,8,8);
  if (onlineRace) onlineCars.drawMap(ctx, xy);
  const p=xy(track.sample(mode==='menu'?15:run.distance).p);ctx.beginPath();ctx.arc(...p,4.5,0,Math.PI*2);ctx.fillStyle='#e5fcff';ctx.fill();
}

loadCourse(selected);resize();syncUI();
if (roomCodePattern.test(new URLSearchParams(location.search).get('sala')?.toUpperCase() ?? '')) openOnline();
const assetsReady=Promise.allSettled([
  fetch(`${import.meta.env.BASE_URL}assets/cad-track.json`).then(r=>{if(!r.ok)throw Error('CAD dimensions unavailable');return r.json();}).then(data=>{cad=data;disposeGeometry(gantry);gantry=createGantry(track,materials,cad);gantry.visible=mode!=='garage';scene.add(gantry);}),
  car.loadLivery(),
]).then(results=>{assetErrors=results.filter(r=>r.status==='rejected').map(r=>String(r.reason));if(assetErrors.length)console.error('Asset loading:',assetErrors);});

function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-last)/1000,.06);last=now;elapsed+=dt;frameDelta=frameDelta*.96+dt*.04;
  readInput();
  if (onlineRace && mode === 'countdown') {
    run.countdown = Math.max(0, (onlineRace.startAt - roomClient.now()) / 1000);
    const count = Math.ceil(run.countdown);
    if (count !== lastCountdown) {
      lastCountdown = count;
      if (count > 0) audio.event('tick');
    }
  }
  if(!freeze&&(mode==='racing'||mode==='countdown')){
    accumulator+=dt;
    while(accumulator>=STEP){
      accumulator-=STEP;
      if (onlineRace && run.mode === 'countdown' && run.countdown > 0) continue;
      stepRun(run,input,STEP);
      if(!onlineRace && run.mode==='countdown'){
        const count=Math.ceil(run.countdown);if(count!==lastCountdown){lastCountdown=count;audio.event('tick');}
      }
      if(run.event){audio.event(run.event);if(run.event==='scrape')quake=.13;}
      mode=run.mode;
      if(mode==='finished'){if(onlineRace)reportOnlineResult('finish');else finish();clearInput();break;}
      if(mode==='crashed'){if(onlineRace)reportOnlineResult('dnf');else result={reason:run.message};clearInput();quake=.3;break;}
    }
    placeCar(track.sample(run.distance),run.offset);
  }
  if (onlineRace) {
    if (onlineRace.completion && now-onlineRace.sentAt >= 500) sendOnlineResult();
    else if (mode==='racing' && now-onlineRace.sentAt >= 125) {
      sendPosition();
      onlineRace.sentAt = now;
    }
    onlineCars.update(dt, run.distance, run.offset);
  }
  if(mode==='crashed'&&!freeze){run.crashAge+=dt;car.root.position.y-=Math.min(9,run.crashAge*6)*dt;car.root.rotateZ(dt*2);}
  car.update(mode==='racing'&&!freeze?run.speed:0,run.boost&&mode==='racing',elapsed,dt);
  audio.update(run.speed,run.boost,mode==='racing');
  if(studioMode())editorOrbit.update();else updateCamera(dt);
  if(frameCount%3===0){syncUI();drawMinimap();}
  if(studioMode()&&editorRect){
    renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setClearColor(scene.background);renderer.clear();
    const r=editorRect,y=innerHeight-r.y-r.height;
    renderer.setViewport(r.x,y,r.width,r.height);renderer.setScissor(r.x,y,r.width,r.height);renderer.setScissorTest(true);
    renderer.render(scene,camera);renderer.setScissorTest(false);
  }else{renderer.setViewport(0,0,innerWidth,innerHeight);renderer.render(scene,camera);}
  frameCount++;
  if(diagnosticsEnabled){
    window.__THREE_GAME_DIAGNOSTICS__={
      frame:frameCount,mode,course:selected.id,assist:assistId,score:run.progress,complete:mode==='finished',failed:mode==='crashed',
      distance:run.distance,speed:run.speed,nitro:run.nitro,offset:run.offset,elapsed:run.elapsed,
      player:{x:car.root.position.x,y:car.root.position.y,z:car.root.position.z},
      renderer:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},
      physics:{engine:'custom track-relative',timestep:STEP,bodies:1,colliders:2,sensors:1},frameMs:frameDelta*1000,assetErrors,
      ...(mode==='builder'?{builder:{...builder.snapshot(),viewport:editorRect,camera:camera.position.toArray()}}:{}),
      vehicle:{key:configurationKey(vehicleConfiguration),configuration:vehicleConfiguration,stats:vehicleStats,runStats:run.vehicle,parts:car.root.userData.parts,
        wheelRotation:car.wheels?.[0]?.rotation.x,boostVisible:car.flames?.visible??false},
      ...(mode==='garage'?{garage:{...garage.snapshot(),viewport:editorRect,camera:camera.position.toArray()}}:{}),
      online: { code: roomState.room?.code, phase: roomState.room?.phase, selfId: roomState.selfId, players: roomState.room?.players, startAt: onlineRace?.startAt, opponents: onlineCars.visibleCount },
    };
  }
}
requestAnimationFrame(frame);

if(diagnosticsEnabled){
  window.__THREE_GAME_TEST_HOOKS__={
    seed(){return true;},setReducedMotion(){quake=0;},setPausedForScreenshot(value){freeze=!!value;},
    async setState(name){
      await assetsReady;
      if(name==='menu'){menu();}
      else if(name==='builder'){openBuilder();}
      else if(name==='garage'){openGarage();}
      else if(name==='active-play'||name==='loop'){
        start();run.mode=mode='racing';run.countdown=0;run.speed=24;
        run.distance=name==='loop'?track.frames.findIndex(f=>f.up.y<-.98)/(track.frames.length-1)*track.length:20;
        run.progress=(run.distance-4)/(track.length-2);run.elapsed=2;placeCar(track.sample(run.distance),0);updateCamera(1,true);
      }else if(name==='crashed'){start();mode=run.mode='crashed';run.message='Te saliste de la pista. Corrige la dirección antes del borde.';}
      else if(name==='finished'){start();run.elapsed=35.123;mode=run.mode='finished';result={time:35.123,best:34.8,newBest:false};}
      else throw Error(`Unknown state ${name}`);
      syncUI();resize();return {state:name};
    },
    course(id){menu();loadCourse(courses.find(c=>c.id===id)||selected);syncUI();},
    inspectTrack(){return {length:track.length,frames:track.frames.map(f=>({p:f.p.toArray(),up:f.up.toArray(),t:f.forward.toArray()}))};},
  };
}
