import { PIECES, createDefaultDraft, buildCustomTrack } from './builder-track.js';
import { createBuilderUI } from './builder-ui.js';

const DRAFT_KEY='diecast-circuit.builder-draft.v1';
const LIBRARY_KEY='diecast-circuit.tracks.v1';
const copy=value=>JSON.parse(JSON.stringify(value));
const parameters=piece=>piece.parameters||(piece.parameter?[piece.parameter]:[]);

// Treat persisted browser data as untrusted input and keep it bounded.
function cleanDraft(value) {
  if(!value||!Array.isArray(value.pieces))return createDefaultDraft();
  return {
    version:1,name:String(value.name||'Mi circuito').slice(0,40),
    width:Math.min(8,Math.max(5,Number(value.width)||6.4)),closed:!!value.closed,
    pieces:value.pieces.slice(0,32).filter(p=>p&&PIECES.some(def=>def.id===p.type)).map(piece=>{
      const definition=PIECES.find(def=>def.id===piece.type),out={type:piece.type};
      for(const param of parameters(definition)) {
        const value=Number(piece[param.key]);
        out[param.key]=Number.isFinite(value)?Math.min(param.max,Math.max(param.min,value)):param.default;
      }
      return out;
    }),
  };
}

export function createTrackBuilder(callbacks) {
  let draft=createDefaultDraft(),savedTracks=[],selectedSaveId='',active=false,selectedIndex=0;
  let result=null,notice='',past=[],future=[];
  try {
    const stored=localStorage.getItem(DRAFT_KEY);
    if(stored&&stored.length<100000){const parsed=JSON.parse(stored);draft=cleanDraft(parsed);selectedSaveId=typeof parsed.savedId==='string'?parsed.savedId:'';}
    const library=localStorage.getItem(LIBRARY_KEY);
    if(library&&library.length<1000000){
      const parsed=JSON.parse(library);
      if(Array.isArray(parsed))savedTracks=parsed.slice(0,12).filter(x=>x&&typeof x.id==='string').map(x=>({id:x.id.slice(0,80),name:String(x.name||'Mi circuito').slice(0,40),updatedAt:x.updatedAt,draft:cleanDraft(x.draft)}));
    }
  }catch{notice='Se inició una pista nueva porque el guardado no era válido.';}
  if(!savedTracks.some(t=>t.id===selectedSaveId))selectedSaveId='';
  selectedIndex=Math.max(0,draft.pieces.length-1);

  function persistDraft() {
    try {localStorage.setItem(DRAFT_KEY,JSON.stringify({...draft,savedId:selectedSaveId}));}
    catch {notice='El navegador no permite guardar. Puedes seguir construyendo y probar la pista.';}
  }
  function update() {
    ui.update({active,draft,selectedIndex,validation:result?.validation||{valid:false,errors:[],warnings:[],length:0,loops:0},closed:!!draft.closed,savedTracks,selectedSaveId,notice,canUndo:past.length>0,canRedo:future.length>0});
  }
  function rebuild(fit=false) {
    try {result=buildCustomTrack(draft,{close:!!draft.closed});}
    catch(error) {result={track:null,segments:[],validation:{valid:false,errors:[error.message||'No se pudo construir esta pista.'],warnings:[],length:0,loops:0}};}
    if(active)callbacks.onPreview?.(result.track,{draft,result,selectedIndex,fit});
    callbacks.onSelect?.(result.segments?.[selectedIndex]);
    update();
  }
  const historySnapshot=()=>({draft:copy(draft),selectedSaveId,selectedIndex});
  function remember(){past.push(historySnapshot());if(past.length>50)past.shift();future=[];notice='';}
  function change(intent) {
    if(intent.type==='select'){
      selectedIndex=Math.max(0,Math.min(draft.pieces.length-1,intent.index));
      callbacks.onSelect?.(result?.segments?.[selectedIndex]);update();return;
    }
    if(intent.type==='undo'||intent.type==='redo'){
      const from=intent.type==='undo'?past:future,to=intent.type==='undo'?future:past;
      if(!from.length)return;
      to.push(historySnapshot());const previous=from.pop();draft=previous.draft;
      selectedSaveId=savedTracks.some(t=>t.id===previous.selectedSaveId)?previous.selectedSaveId:'';
      selectedIndex=Math.max(0,Math.min(previous.selectedIndex,draft.pieces.length-1));
      notice='';persistDraft();rebuild();return;
    }
    if(intent.type==='add'&&draft.pieces.length>=32){notice='Puedes usar hasta 32 piezas por circuito.';update();return;}
    remember();
    let geometry=true,fit=false;
    if(intent.type==='name') {draft.name=String(intent.value).slice(0,40);geometry=false;}
    else if(intent.type==='width')draft.width=Math.min(8,Math.max(5,Number(intent.value)||6.4));
    else if(intent.type==='new') {draft={version:1,name:'Mi circuito',width:6.4,pieces:[{type:'straight',length:36}],closed:false};selectedIndex=0;selectedSaveId='';fit=true;}
    else if(intent.type==='template') {draft=createDefaultDraft();selectedIndex=draft.pieces.length-1;selectedSaveId='';fit=true;}
    else if(intent.type==='add'){
      const def=PIECES.find(p=>p.id===intent.pieceType);if(!def)return;
      const piece={type:def.id};for(const p of parameters(def))piece[p.key]=p.default;
      const at=Math.min(draft.pieces.length,selectedIndex+1);draft.pieces.splice(at,0,piece);selectedIndex=at;draft.closed=false;
    }
    else if(intent.type==='remove') {draft.pieces.splice(intent.index,1);selectedIndex=Math.max(0,Math.min(intent.index,draft.pieces.length-1));draft.closed=false;}
    else if(intent.type==='move'){
      const target=intent.index+intent.direction;
      if(target<0||target>=draft.pieces.length)return;
      [draft.pieces[intent.index],draft.pieces[target]]=[draft.pieces[target],draft.pieces[intent.index]];selectedIndex=target;draft.closed=false;
    }
    else if(intent.type==='parameter') {
      const piece=draft.pieces[selectedIndex],def=PIECES.find(d=>d.id===piece?.type);
      const param=def&&parameters(def).find(p=>p.key===intent.key);
      if(!param)return;
      piece[param.key]=Math.min(param.max,Math.max(param.min,Number(intent.value)||param.default));draft.closed=false;
    }
    else return;
    persistDraft();
    if(geometry)rebuild(fit);
    else {if(result?.track)result.track.course.name=draft.name.trim()||'Mi circuito';update();}
  }
  function closeTrack(){remember();draft.closed=true;persistDraft();rebuild();if(result.validation.valid)notice='Circuito conectado y listo para correr.';update();}
  function save() {
    const name=draft.name.trim()||'Mi circuito';draft.name=name;
    let entry=savedTracks.find(t=>t.id===selectedSaveId);
    if(!entry){if(savedTracks.length>=12){notice='La biblioteca tiene 12 pistas. Carga una para actualizarla o elimina alguna.';update();return;}entry={id:`track-${Date.now().toString(36)}`};savedTracks.push(entry);}
    Object.assign(entry,{name,updatedAt:Date.now(),draft:copy(draft)});selectedSaveId=entry.id;
    try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(savedTracks));notice=`«${name}» guardada en este navegador.`;persistDraft();}
    catch{notice='No se pudo guardar en este navegador. El diseño sigue disponible en esta sesión.';}
    update();
  }
  function load(id){const entry=savedTracks.find(t=>t.id===id);if(!entry)return;remember();draft=cleanDraft(entry.draft);selectedSaveId=id;selectedIndex=Math.max(0,draft.pieces.length-1);notice=`Pista cargada: ${entry.name}.`;persistDraft();rebuild(true);}
  function deleteSaved(id){const entry=savedTracks.find(t=>t.id===id);if(!entry)return;savedTracks=savedTracks.filter(t=>t.id!==id);if(selectedSaveId===id)selectedSaveId='';try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(savedTracks));notice='Pista eliminada de la biblioteca. El diseño actual sigue abierto.';}catch{notice='No se pudo actualizar la biblioteca.';}update();}
  const ui=createBuilderUI({pieces:PIECES,onChange:change,onCloseTrack:closeTrack,onSave:save,onLoad:load,onDeleteSaved:deleteSaved,
    onPlay(){if(!result?.validation.valid||!draft.closed)return;active=false;update();callbacks.onPlay?.(result.track);},
    onExit(){active=false;update();callbacks.onExit?.();},onView:callbacks.onView,
  });
  update();
  return {
    open(){active=true;rebuild(true);},
    snapshot(){return {draft:copy(draft),selectedIndex,validation:result?.validation,closed:!!draft.closed,savedCount:savedTracks.length,active};},
    get active(){return active;},
    destroy(){ui.destroy();},
  };
}
