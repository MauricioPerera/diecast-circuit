export const DONORS = [
  {id:'gt',name:'Apex GT',subtitle:'Coupé equilibrado',color:'#157e9e',description:'Coupé de metal, techo bajo y comportamiento equilibrado.'},
  {id:'muscle',name:'Iron V8',subtitle:'Potencia de recta',color:'#c64a2f',description:'Capó largo, hombros anchos y escapes de gran diámetro.'},
  {id:'rally',name:'Trail R',subtitle:'Agarre y agilidad',color:'#e5e2d8',description:'Hatchback compacto, pasos de rueda y neumáticos de rally.'},
  {id:'prototype',name:'Vector P1',subtitle:'Aerodinámica de circuito',color:'#8294a5',description:'Cuña de competición, cockpit envolvente y superficies aerodinámicas.'},
];
export const SLOTS = [
  {id:'body',name:'Carrocería',description:'Define la silueta, el peso y la velocidad punta.'},
  {id:'cabin',name:'Cabina',description:'Techo, cristales y posición del cockpit.'},
  {id:'wheels',name:'Ruedas',description:'Llantas y neumáticos: agarre, frenada y rodadura.'},
  {id:'spoiler',name:'Alerón',description:'Equilibra resistencia al aire y apoyo en curva.'},
  {id:'exhaust',name:'Escape',description:'Modifica el empuje y la eficiencia del nitro.'},
];
export const PAINTS = [
  {id:'petrol',name:'Azul petróleo',color:'#157e9e'},
  {id:'ember',name:'Rojo fundición',color:'#c64a2f'},
  {id:'ivory',name:'Marfil competición',color:'#e5e2d8'},
  {id:'graphite',name:'Grafito',color:'#25303b'},
  {id:'gold',name:'Oro satinado',color:'#d8a52b'},
  {id:'ice',name:'Plata glaciar',color:'#8294a5'},
];
export const DEFAULT_CONFIGURATION = Object.freeze({
  name:'Apex GT',parts:Object.freeze({body:'gt',cabin:'gt',wheels:'gt',spoiler:'gt',exhaust:'gt'}),paint:'#157e9e',accent:'#e9d8bb',
});
const donorIds=new Set(DONORS.map(d=>d.id));
const color=(value,fallback)=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value)?value.toLowerCase():fallback;
export function normalizeConfiguration(input) {
  const source=input&&typeof input==='object'?input:{};
  const parts={};for(const slot of SLOTS)parts[slot.id]=donorIds.has(source.parts?.[slot.id])?source.parts[slot.id]:'gt';
  return {name:typeof source.name==='string'?source.name.trim().slice(0,40)||'Mi coche':DEFAULT_CONFIGURATION.name,parts,paint:color(source.paint,DEFAULT_CONFIGURATION.paint),accent:color(source.accent,DEFAULT_CONFIGURATION.accent)};
}
export function stockConfiguration(id='gt') {
  const donor=DONORS.find(d=>d.id===id)||DONORS[0];
  return {name:donor.name,parts:Object.fromEntries(SLOTS.map(s=>[s.id,donor.id])),paint:donor.color,accent:donor.id==='rally'?'#d44632':donor.id==='prototype'?'#dd4b33':'#e9d8bb'};
}
export function configurationKey(input) {
  const config=normalizeConfiguration(input);
  return `v1-${SLOTS.map(slot=>config.parts[slot.id]).join('-')}`;
}
const fields=['acceleration','topSpeed','boostPower','grip','braking','nitroEfficiency'];
const deltas={
  body:{gt:[0,0,0,0,0,0],muscle:[.045,.05,0,-.035,-.02,-.01],rally:[.025,-.04,0,.025,.01,.015],prototype:[-.015,.055,0,-.01,0,-.015]},
  cabin:{gt:[0,0,0,0,0,0],muscle:[-.02,0,0,0,0,0],rally:[.015,-.01,0,0,0,0],prototype:[.02,.015,0,0,0,-.01]},
  wheels:{gt:[0,0,0,0,0,0],muscle:[-.005,.01,0,-.015,.01,0],rally:[-.01,-.02,0,.055,.04,0],prototype:[.005,.005,0,.02,.02,-.005]},
  spoiler:{gt:[0,0,0,0,0,0],muscle:[0,.015,0,-.02,0,0],rally:[0,-.015,0,.02,0,0],prototype:[0,-.015,0,.045,.005,0]},
  exhaust:{gt:[0,0,0,0,0,0],muscle:[.005,0,.07,0,0,-.04],rally:[0,0,-.025,0,0,.055],prototype:[-.005,0,.045,0,0,-.015]},
};
export function getVehicleStats(input) {
  const config=normalizeConfiguration(input),stats=Object.fromEntries(fields.map(f=>[f,1]));
  for(const slot of SLOTS){const values=deltas[slot.id][config.parts[slot.id]];fields.forEach((f,i)=>stats[f]+=values[i]);}
  for(const field of fields)stats[field]=Math.round(Math.min(1.10,Math.max(.92,stats[field]))*1e6)/1e6;
  const rating=value=>Math.round(Math.min(100,Math.max(0,64+(value-1)*260)));
  stats.ratings={speed:rating(stats.topSpeed),acceleration:rating(stats.acceleration),grip:rating(stats.grip),nitro:rating((stats.boostPower+stats.nitroEfficiency)/2)};
  return stats;
}
