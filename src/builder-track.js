import * as T from 'three';
import { createTrackFromPoints } from './track.js';

const TAU=Math.PI*2, FLOOR=3.4, LIMIT=32;
const parameter=(key,label,min,max,step,value,unit='m')=>({key,label,min,max,step,default:value,unit});
export const PIECES=[
  {id:'straight',label:'Recta',description:'Gana velocidad antes del siguiente desafío.',parameter:parameter('length','Longitud',12,120,2,24)},
  {id:'short',label:'Recta corta',description:'Ajusta la separación entre piezas.',parameter:parameter('length','Longitud',8,24,2,12)},
  {id:'right',label:'Curva derecha',description:'Giro de 90° con entrada y salida suaves.',parameter:parameter('radius','Radio',16,28,1,18)},
  {id:'left',label:'Curva izquierda',description:'Giro de 90° hacia el lado contrario.',parameter:parameter('radius','Radio',16,28,1,18)},
  {id:'ramp',label:'Rampa',description:'Sube y vuelve al nivel de la pista.',parameters:[parameter('length','Longitud',32,64,2,40),parameter('height','Altura',3,9,1,6)]},
  {id:'loop',label:'Loop',description:'Una inversión completa. Deja una recta de salida.',parameter:parameter('radius','Radio',5.8,9,0.2,7)},
];
const definitions=new Map(PIECES.map(p=>[p.id,p]));
const mod=value=>((value%TAU)+TAU)%TAU;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function createDefaultDraft(){return {version:1,name:'Mi primer circuito',width:6.4,closed:true,pieces:[
  {type:'straight',length:36},{type:'loop',radius:7},{type:'straight',length:24},
  {type:'right',radius:18},{type:'right',radius:18},{type:'straight',length:108},
  {type:'right',radius:18},{type:'right',radius:18},
]};}

export function normalizeDraft(input){
  const source=input&&typeof input==='object'?input:{};
  return {version:1,name:typeof source.name==='string'?source.name.trim().slice(0,40)||'Mi circuito':'Mi circuito',width:clamp(Number.isFinite(source.width)?source.width:6.4,5,8),closed:source.closed===true,
    pieces:Array.isArray(source.pieces)?source.pieces.slice(0,LIMIT).filter(piece=>piece&&definitions.has(piece.type)).map(piece=>{
      const def=definitions.get(piece.type),next={type:piece.type};
      for(const p of def.parameters||[def.parameter].filter(Boolean))next[p.key]=clamp(Number.isFinite(piece[p.key])?piece[p.key]:p.default,p.min,p.max);
      return next;
    }):[],
  };
}

function hashGeometry(draft){
  const text=JSON.stringify([draft.width,draft.pieces]);let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return `custom-${(hash>>>0).toString(16).padStart(8,'0')}`;
}

function makePath(){
  const path={points:[],upHints:[],owners:[],lengths:[],segments:[],x:0,z:0,heading:0,s:0};
  path.add=(x,y,z,owner,hint=new T.Vector3(0,1,0))=>{
    const p=new T.Vector3(x,y,z),last=path.points.at(-1);
    if(last&&p.distanceToSquared(last)<1e-12)return;
    if(last)path.s+=p.distanceTo(last);
    path.points.push(p);path.upHints.push(hint);path.owners.push(owner);path.lengths.push(path.s);
  };
  path.straight=(length,owner,handler)=>{
    const sx=path.x,sz=path.z,h=path.heading,n=Math.max(2,Math.ceil(length/.7));
    for(let i=0;i<=n;i++){const u=i/n;path.add(sx+Math.sin(h)*length*u,FLOOR+(handler?handler(u):0),sz+Math.cos(h)*length*u,owner);}
    path.x=sx+Math.sin(h)*length;path.z=sz+Math.cos(h)*length;
  };
  path.turn=(angle,radius,owner)=>{
    const x=path.x,z=path.z,h=path.heading,sign=Math.sign(angle),n=Math.max(2,Math.ceil(Math.abs(angle)*radius/.7));
    for(let i=0;i<=n;i++){
      const a=angle*i/n;
      const forward=radius*Math.sin(a)*sign,right=radius*(1-Math.cos(a))*sign;
      path.add(x+Math.sin(h)*forward+Math.cos(h)*right,FLOOR,z+Math.cos(h)*forward-Math.sin(h)*right,owner);
    }
    path.x=x+Math.sin(h)*radius*Math.sin(angle)*sign+Math.cos(h)*radius*(1-Math.cos(angle))*sign;
    path.z=z+Math.cos(h)*radius*Math.sin(angle)*sign-Math.sin(h)*radius*(1-Math.cos(angle))*sign;
    path.heading=h+angle;
  };
  return path;
}

function appendPiece(path,piece,index,width){
  const start=path.points.length?path.points.at(-1).clone():new T.Vector3(path.x,FLOOR,path.z),first=path.points.length;
  if(piece.type==='straight'||piece.type==='short')path.straight(piece.length,index);
  else if(piece.type==='right'||piece.type==='left')path.turn((piece.type==='right'?1:-1)*Math.PI/2,piece.radius,index);
  else if(piece.type==='ramp')path.straight(piece.length,index,u=>piece.height*Math.sin(Math.PI*u)**2);
  else if(piece.type==='loop'){
    const x=path.x,z=path.z,h=path.heading,pitch=width+3;
    const ease=t=>t*t*(3-2*t);
    for(let i=0;i<=200;i++){
      const u=i/200,a=TAU*u,forward=piece.radius*Math.sin(a)+8*ease(u),right=pitch*ease(u);
      const hint=new T.Vector3(-Math.sin(h)*Math.sin(a),Math.cos(a),-Math.cos(h)*Math.sin(a));
      path.add(x+Math.sin(h)*forward+Math.cos(h)*right,FLOOR+piece.radius*(1-Math.cos(a)),z+Math.cos(h)*forward-Math.sin(h)*right,index,hint);
    }
    // Recover sideways over a long, tangent-continuous S-curve. The pitch
    // separates entry/exit instead of making the orange ribbon cross itself.
    for(let i=1;i<=64;i++){
      const u=i/64,forward=8+40*u,right=pitch*(1-ease(u));
      path.add(x+Math.sin(h)*forward+Math.cos(h)*right,FLOOR,z+Math.cos(h)*forward-Math.sin(h)*right,index);
    }
    path.x=x+Math.sin(h)*48;path.z=z+Math.cos(h)*48;
  }
  path.segments.push({index,label:definitions.get(piece.type).label,type:piece.type,start:start.toArray(),end:path.points.at(-1).toArray(),points:[start,...path.points.slice(first)].map(p=>p.toArray())});
}

// CSC Dubins candidates give tangent-continuous joins, with the same minimum
// turning radius as a hand-placed curve. Both turn directions are considered.
function dubinsCandidates(path){
  const candidates=[];
  const distance=Math.hypot(path.x,path.z);
  if(distance<.05&&Math.abs(Math.sin(path.heading))<.001&&Math.cos(path.heading)>.999)return [{word:[],values:[],radius:18,length:0}];
  for(const radius of [16,18,22,26]){
    const theta=Math.atan2(-path.x,-path.z),d=distance/radius,a=mod(path.heading-theta),b=mod(-theta);
    const sa=Math.sin(a),sb=Math.sin(b),ca=Math.cos(a),cb=Math.cos(b),cab=Math.cos(a-b);
    const add=(word,t,p,q)=>{if([t,p,q].every(Number.isFinite))candidates.push({word:word.split(''),values:[mod(t),p,mod(q)],radius,length:(mod(t)+p+mod(q))*radius});};
    let p2=2+d*d-2*cab+2*d*(sa-sb);
    if(p2>=-1e-9){const temp=Math.atan2(cb-ca,d+sa-sb);add('LSL',-a+temp,Math.sqrt(Math.max(0,p2)),b-temp);}
    p2=2+d*d-2*cab+2*d*(-sa+sb);
    if(p2>=-1e-9){const temp=Math.atan2(ca-cb,d-sa+sb);add('RSR',a-temp,Math.sqrt(Math.max(0,p2)),-b+temp);}
    p2=-2+d*d+2*cab+2*d*(sa+sb);
    if(p2>=0){const p=Math.sqrt(p2),temp=Math.atan2(-ca-cb,d+sa+sb)-Math.atan2(-2,p);add('LSR',-a+temp,p,-b+temp);}
    p2=d*d-2+2*cab-2*d*(sa+sb);
    if(p2>=0){const p=Math.sqrt(p2),temp=Math.atan2(ca+cb,d-sa-sb)-Math.atan2(2,p);add('RSL',a-temp,p,b-temp);}
  }
  return candidates.sort((a,b)=>a.length-b.length);
}

function clonePath(source){
  const next=makePath();Object.assign(next,{x:source.x,z:source.z,heading:source.heading,s:source.s,points:source.points.map(p=>p.clone()),upHints:source.upHints.map(p=>p.clone()),owners:[...source.owners],lengths:[...source.lengths],segments:[...source.segments]});return next;
}
function appendClosure(path,candidate){
  const start=path.points.at(-1).clone(),first=path.points.length;
  candidate.word.forEach((type,i)=>{if(candidate.values[i]<1e-7)return;if(type==='S')path.straight(candidate.values[i]*candidate.radius,-1);else path.turn((type==='L'?1:-1)*candidate.values[i],candidate.radius,-1);});
  if(Math.hypot(path.x,path.z)>.02||Math.cos(path.heading)<.999)throw Error('No se pudo alinear el cierre.');
  if(candidate.length>0)path.segments.push({index:-1,label:'Cierre automático',type:'closure',start:start.toArray(),end:[0,FLOOR,0],points:[start,...path.points.slice(first)].map(p=>p.toArray())});
}

function pathBounds(path,width){
  const min=new T.Vector3(Infinity,Infinity,Infinity),max=new T.Vector3(-Infinity,-Infinity,-Infinity);
  for(const p of path.points){min.min(p);max.max(p);}
  return {min:min.toArray(),max:max.toArray(),width:max.x-min.x+width+2,depth:max.z-min.z+width+2,height:max.y};
}
function collision(path,draft,closed){
  const samples=[];let last=-Infinity;
  for(let i=0;i<path.points.length;i++)if(path.lengths[i]-last>=1.8||i===path.points.length-1){samples.push({p:path.points[i],s:path.lengths[i],owner:path.owners[i]});last=path.lengths[i];}
  const threshold=draft.width+.35,local=draft.width*2.8+3;
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++){
    const a=samples[i],b=samples[j],along=b.s-a.s;
    if(Math.min(along,closed?path.s-along:Infinity)<local)continue;
    const dy=Math.abs(a.p.y-b.p.y);
    if(dy<2.0&&Math.hypot(a.p.x-b.p.x,a.p.z-b.p.z)<threshold)return {a:a.owner,b:b.owner};
  }
  return null;
}

function validateGeometry(path,draft,closed){
  const errors=[],bounds=pathBounds(path,draft.width);
  if(path.s>1100)errors.push('El circuito supera 1,100 m. Quita algunas piezas.');
  if(bounds.width>136||bounds.depth>290)errors.push('La pista sale del taller. Acorta las rectas o cambia una curva.');
  const overlap=collision(path,draft,closed);
  if(overlap)errors.push(overlap.a<0||overlap.b<0?'El cierre automático cruza otra pieza. Añade una curva o cambia el final.':`Las piezas ${overlap.a+1} y ${overlap.b+1} se cruzan. Cambia una curva o usa una rampa.`);
  return {errors,bounds};
}

export function buildCustomTrack(input,{close=true}={}){
  const draft=normalizeDraft(input),errors=[],warnings=[];
  if(!input||typeof input!=='object'||!Array.isArray(input.pieces))errors.push('El archivo no contiene una lista de piezas válida.');
  if(Array.isArray(input?.pieces)&&input.pieces.length>LIMIT)errors.push('Usa como máximo 32 piezas.');
  if(Array.isArray(input?.pieces)&&input.pieces.some(p=>!p||!definitions.has(p.type)))errors.push('Hay una pieza desconocida. Elimínala o elige una de la biblioteca.');
  if(Array.isArray(input?.pieces)&&input.pieces.some(p=>p&&Object.entries(p).some(([k,v])=>k!=='type'&&typeof v==='number'&&!Number.isFinite(v))))errors.push('Una medida no es un número válido. Corrige la pieza indicada.');
  if(draft.pieces.length<3)errors.push('Añade al menos tres piezas antes de probar la pista.');
  let runway=0;
  for(const piece of draft.pieces){if(piece.type==='loop')break;if(piece.type==='straight'||piece.type==='short')runway+=piece.length;else break;}
  if(draft.pieces.some(p=>p.type==='loop')&&runway<24)errors.push('Deja al menos 24 m de recta al inicio antes del primer loop.');
  const base=makePath();draft.pieces.forEach((p,i)=>appendPiece(base,p,i,draft.width));
  if(base.points.length<2)return {draft,track:null,segments:[],closure:null,validation:{valid:false,errors,warnings,length:0,loops:0,closed:false,bounds:null}};
  let path=base,closed=false,closure=null,geometry;
  if(close){
    const candidates=dubinsCandidates(base);let fallback;
    for(const candidate of candidates){
      const attempt=clonePath(base);
      try{appendClosure(attempt,candidate);}catch{continue;}
      const checked=validateGeometry(attempt,draft,true);
      if(!fallback)fallback={path:attempt,candidate,checked};
      if(!checked.errors.length){path=attempt;geometry=checked;closed=true;closure=candidate;break;}
    }
    if(!closed&&fallback){path=fallback.path;geometry=fallback.checked;closure=fallback.candidate;closed=true;}
    if(!closed)errors.push('No hay espacio para conectar el final con la salida. Añade una curva y vuelve a cerrar.');
  }else errors.push('Cierra el circuito para poder correr.');
  geometry??=validateGeometry(path,draft,closed);errors.push(...geometry.errors);
  const offset=new T.Vector3(-(geometry.bounds.min[0]+geometry.bounds.max[0])/2,0,-(geometry.bounds.min[2]+geometry.bounds.max[2])/2);
  for(const p of path.points)p.add(offset);
  const segments=path.segments.map(s=>({...s,start:new T.Vector3(...s.start).add(offset).toArray(),end:new T.Vector3(...s.end).add(offset).toArray(),points:s.points.map(p=>new T.Vector3(...p).add(offset).toArray())}));
  const loops=draft.pieces.filter(p=>p.type==='loop').length;
  const course={id:hashGeometry(draft),name:draft.name,difficulty:'PERSONALIZADA',description:'Un circuito creado en tu taller.',loops,width:draft.width,target:0,color:'#ff8b21',theme:'custom',custom:true};
  const track=createTrackFromPoints(path.points,course,{closed});
  // Authored normal hints keep flat modules upright and the car radial inside
  // the helical loop, rather than accumulating parallel-transport holonomy.
  const matrix=new T.Matrix4(),hints=path.upHints,pointCount=track.curve.points.length;
  const count=track.frames.length-1;
  for(let i=0;i<=count;i++){
    const u=closed&&i===count?0:i/count,t=track.curve.getUtoTmapping(u);
    const cursor=t*(closed?pointCount:pointCount-1),a=Math.min(pointCount-1,Math.floor(cursor));
    const b=closed?(a+1)%pointCount:Math.min(pointCount-1,a+1);
    const f=track.frames[i],hint=hints[a].clone().lerp(hints[b],cursor-a).normalize();
    f.right.crossVectors(hint,f.forward).normalize();
    f.up.crossVectors(f.forward,f.right).normalize();
    f.q.setFromRotationMatrix(matrix.makeBasis(f.right,f.up,f.forward));
  }
  for(let i=0;i<count;i++){
    const a=track.frames[closed?(i-2+count)%count:Math.max(0,i-2)],b=track.frames[closed?(i+2)%count:Math.min(count,i+2)];
    track.frames[i].curvature=b.forward.clone().sub(a.forward).dot(track.frames[i].right)/(track.length/count*4);
  }
  track.frames[count].curvature=track.frames[0].curvature;
  if(track.frames[0].up.dot(track.frames.at(-1).up)<.995&&closed)errors.push('Las piezas dejan un giro de inclinación en la unión. Separa la rampa de la curva.');
  if(loops>3)warnings.push('Muchos loops exigen reservar nitro para conservar el impulso.');
  const bounds=pathBounds(path,draft.width);
  return {draft,track,segments,closure:closure?{length:closure.length,radius:closure.radius,word:closure.word.join('')}:null,validation:{valid:closed&&errors.length===0,errors:[...new Set(errors)],warnings,length:track.length,loops,closed,bounds}};
}
