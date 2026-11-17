import { DONORS, SLOTS, PAINTS, DEFAULT_CONFIGURATION, stockConfiguration, normalizeConfiguration, configurationKey, getVehicleStats } from './vehicles.js';
import './garage.css';

const ACTIVE_KEY='diecast-circuit.vehicle.v1',LIBRARY_KEY='diecast-circuit.garage.v1';
const copy=value=>JSON.parse(JSON.stringify(value));
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={
  back:'<svg viewBox="0 0 24 24"><path d="m10 5-7 7 7 7M3 12h18"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M3 12h18m-7-7 7 7-7 7"/></svg>',
  save:'<svg viewBox="0 0 24 24"><path d="M4 3h13l4 4v14H3V3Zm3 0v7h10V3M7 21v-7h10v7"/></svg>',
  trash:'<svg viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
};
const silhouettes={
  gt:'M7 29l4-9 15-3 9-9h20l12 11 11 4 4 11H6Zm22-11h33L53 11H38Z',
  muscle:'M5 29l3-10 22-2 9-8h20l15 12 9 3 2 10H5Zm27-11h34L57 12H41Z',
  rally:'M10 30l2-13 9-3 7-8h29l12 14 10 6 2 8H9Zm15-15h37l-8-6H32Z',
  prototype:'M4 30l7-7 19-4 13-8h12l10 10 14 3 7 10H3Zm31-11h25l-8-5h-8Z',
};
function carIcon(id){return `<svg class="garage-car-drawing" viewBox="0 0 90 44" aria-hidden="true"><path d="${silhouettes[id]||silhouettes.gt}"/><circle cx="23" cy="32" r="7"/><circle cx="69" cy="32" r="7"/><circle cx="23" cy="32" r="3"/><circle cx="69" cy="32" r="3"/></svg>`;}
const ratingLabels={speed:'VELOCIDAD',acceleration:'ACELERACIÓN',grip:'AGARRE',nitro:'NITRO'};

export function createGarage(callbacks={}) {
  let applied=normalizeConfiguration(DEFAULT_CONFIGURATION),draft=copy(applied),saved=[],appliedSaveId='',selectedSaveId='',selectedSlot=SLOTS[0]?.id||'body',active=false,notice='',viewMode='perspective';
  try{
    const raw=localStorage.getItem(ACTIVE_KEY);
    if(raw&&raw.length<100000){const parsed=JSON.parse(raw);applied=normalizeConfiguration(parsed.configuration||parsed);appliedSaveId=typeof parsed.savedId==='string'?parsed.savedId:'';}
    const rawLibrary=localStorage.getItem(LIBRARY_KEY);
    if(rawLibrary&&rawLibrary.length<1000000){const parsed=JSON.parse(rawLibrary);if(Array.isArray(parsed))saved=parsed.slice(0,12).filter(e=>e&&typeof e.id==='string').map(e=>({id:e.id.slice(0,80),name:String(e.name||e.configuration?.name||'Mi coche').slice(0,40),configuration:normalizeConfiguration(e.configuration||e.config),updatedAt:Number(e.updatedAt)||0}));}
  }catch{notice='Se ha restaurado un coche de serie porque el guardado no era válido.';}
  if(!saved.some(e=>e.id===appliedSaveId))appliedSaveId='';
  draft=copy(applied);selectedSaveId=appliedSaveId;
  const root=document.createElement('section');root.id='car-garage';root.className='car-garage';root.hidden=true;root.setAttribute('aria-label','Garaje de coches');
  root.innerHTML=`
    <header class="garage-header"><button class="garage-icon" type="button" data-garage-action="back" aria-label="Volver sin aplicar" title="Volver sin aplicar">${icons.back}</button><div class="garage-heading"><p>DIECAST / CIRCUIT</p><h1>GARAJE DE COCHES</h1></div><span class="garage-header-badge">PIEZAS COMPATIBLES</span></header>
    <div class="garage-view-tools" role="group" aria-label="Vista del coche"><button type="button" data-garage-action="view" data-view="perspective" aria-pressed="true">3D</button><button type="button" data-garage-action="view" data-view="front" aria-pressed="false">FRENTE</button><button type="button" data-garage-action="view" data-view="side" aria-pressed="false">LATERAL</button><button type="button" data-garage-action="view" data-view="rear" aria-pressed="false">TRASERA</button></div>
    <div class="garage-preview-help"><i></i> VISTA EN VIVO <span>Arrastra para girar · rueda para acercar</span></div>
    <aside class="garage-panel" aria-label="Personalización del coche">
      <section class="garage-identity"><label for="garage-name">NOMBRE DE TU COCHE</label><input id="garage-name" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Mi coche"></section>
      <section><div class="garage-section-heading"><h2>COCHES DE SERIE</h2><span>ELIGE UNA BASE</span></div><div class="garage-presets">${DONORS.map(d=>`<button type="button" class="garage-preset" data-garage-action="preset" data-donor="${escape(d.id)}" aria-pressed="false" style="--donor:${escape(d.color)}">${carIcon(d.id)}<strong>${escape(d.name)}</strong><span>${escape(d.subtitle||d.description||'')}</span></button>`).join('')}</div></section>
      <section class="garage-mix"><div class="garage-section-heading"><h2>COMBINAR PIEZAS</h2><span>MEZCLA LOS CUATRO MODELOS</span></div><div class="garage-slots" role="group" aria-label="Tipo de pieza">${SLOTS.map(slot=>`<button type="button" data-garage-action="slot" data-slot="${escape(slot.id)}" aria-pressed="false">${escape(slot.name)}</button>`).join('')}</div><p class="garage-slot-description"></p><div class="garage-parts" role="group" aria-label="Pieza del modelo"></div></section>
      <section class="garage-paint"><div class="garage-section-heading"><h2>PINTURA Y DETALLES</h2><span>ACABADO METÁLICO</span></div><div class="garage-swatches" role="group" aria-label="Color de carrocería">${PAINTS.map(p=>`<button type="button" class="garage-swatch" data-garage-action="paint" data-color="${escape(p.color)}" aria-label="Pintura ${escape(p.name)}" title="${escape(p.name)}" aria-pressed="false" style="--paint:${escape(p.color)}">${icons.check}</button>`).join('')}</div><div class="garage-color-fields"><label>Pintura personalizada<input id="garage-paint" type="color" aria-label="Pintura personalizada" value="#157e9e"></label><label>Color de detalles<input id="garage-accent" type="color" aria-label="Color de detalles" value="#e9d8bb"></label></div></section>
      <section class="garage-performance"><div class="garage-section-heading"><h2>COMPORTAMIENTO</h2><span>SEGÚN TUS PIEZAS</span></div>${Object.entries(ratingLabels).map(([id,label])=>`<div class="garage-rating" data-rating="${id}"><div><span>${label}</span><strong>0</strong></div><div class="garage-rating-track"><span></span></div></div>`).join('')}<p class="garage-ratings-note">Cambiar piezas altera el rendimiento. Los récords se separan por configuración de piezas.</p></section>
      <section class="garage-library"><div class="garage-section-heading"><h2>MIS CREACIONES</h2><span>GUARDADO LOCAL · HASTA 12</span></div><label for="garage-saved" class="garage-sr-only">Coches guardados</label><div class="garage-library-row"><select id="garage-saved" aria-label="Coches guardados"></select><button class="garage-icon" type="button" data-garage-action="load" aria-label="Cargar coche guardado" title="Cargar coche guardado">${icons.arrow}</button><button class="garage-icon" type="button" data-garage-action="delete" aria-label="Borrar coche guardado" title="Borrar coche guardado">${icons.trash}</button></div><div class="garage-library-actions"><button type="button" data-garage-action="save">${icons.save}<span>GUARDAR</span></button><button type="button" data-garage-action="save-new">＋ GUARDAR COMO NUEVO</button></div></section>
    </aside>
    <aside class="garage-car-caption"><p>HECHO CON TUS PIEZAS</p><h2></h2><div class="garage-build-summary"></div></aside>
    <footer class="garage-footer"><div class="garage-status"><strong class="garage-status-title">LISTO PARA RODAR</strong><span class="garage-status-description">Combina piezas y crea tu próximo coche.</span></div><div class="garage-footer-actions"><button type="button" class="garage-cancel" data-garage-action="back">VOLVER SIN APLICAR</button><button type="button" class="garage-apply" data-garage-action="apply">USAR COCHE ${icons.arrow}</button></div></footer>
    <p class="garage-notice" role="status" aria-live="polite"></p>`;
  document.body.append(root);
  const persistenceToast=document.createElement('div');persistenceToast.className='garage-persistence-toast';persistenceToast.setAttribute('role','status');persistenceToast.setAttribute('aria-live','polite');document.body.append(persistenceToast);let toastTimer;
  const find=selector=>root.querySelector(selector),all=selector=>[...root.querySelectorAll(selector)];
  const refs={name:find('#garage-name'),parts:find('.garage-parts'),slotDescription:find('.garage-slot-description'),paint:find('#garage-paint'),accent:find('#garage-accent'),saved:find('#garage-saved'),panel:find('.garage-panel'),notice:find('.garage-notice'),title:find('.garage-car-caption h2'),summary:find('.garage-build-summary'),status:find('.garage-status-description'),statusTitle:find('.garage-status-title')};
  let partSignature='',librarySignature='',lastSelectedSaveId;
  const dirty=()=>JSON.stringify(draft)!==JSON.stringify(applied);
  const syncValue=(element,value)=>{if(document.activeElement!==element&&element.value!==String(value))element.value=value;};
  function render(){
    root.hidden=!active;if(!active)return;
    syncValue(refs.name,draft.name);syncValue(refs.paint,draft.paint);syncValue(refs.accent,draft.accent);
    const stock=DONORS.find(d=>SLOTS.every(s=>draft.parts[s.id]===d.id));
    for(const button of all('[data-garage-action=preset]'))button.setAttribute('aria-pressed',String(stock?.id===button.dataset.donor));
    for(const button of all('[data-garage-action=slot]'))button.setAttribute('aria-pressed',String(selectedSlot===button.dataset.slot));
    const slot=SLOTS.find(s=>s.id===selectedSlot)||SLOTS[0];refs.slotDescription.textContent=slot.description||`Elige de qué modelo tomar ${slot.name.toLowerCase()}.`;
    const signature=selectedSlot;
    if(signature!==partSignature){partSignature=signature;refs.parts.innerHTML=DONORS.map(d=>`<button type="button" class="garage-part" data-garage-action="part" data-donor="${escape(d.id)}" aria-pressed="${draft.parts[selectedSlot]===d.id}" style="--donor:${escape(d.color)}">${carIcon(d.id)}<span>${escape(d.name)}</span><i>${draft.parts[selectedSlot]===d.id?'✓':'＋'}</i></button>`).join('');}
    for(const button of all('[data-garage-action=part]')){const selected=draft.parts[selectedSlot]===button.dataset.donor;button.setAttribute('aria-pressed',String(selected));button.querySelector('i').textContent=selected?'✓':'＋';}
    for(const button of all('[data-garage-action=paint]'))button.setAttribute('aria-pressed',String(button.dataset.color.toLowerCase()===draft.paint.toLowerCase()));
    const stats=getVehicleStats(draft);
    for(const id of Object.keys(ratingLabels)){const value=Math.max(0,Math.min(100,Math.round(stats.ratings?.[id]||0))),row=find(`[data-rating=${id}]`);row.querySelector('strong').textContent=value;row.querySelector('.garage-rating-track span').style.transform=`scaleX(${value/100})`;}
    refs.title.textContent=draft.name||'Mi coche';
    refs.summary.innerHTML=SLOTS.map(slot=>`<span><b>${escape(slot.name)}</b>${escape(DONORS.find(d=>d.id===draft.parts[slot.id])?.name||'')}</span>`).join('');
    refs.statusTitle.textContent=stock?'MODELO DE SERIE':'COMBINACIÓN PERSONALIZADA';
    refs.status.textContent=dirty()?'Vista previa sin aplicar · pulsa Usar coche para salir con esta configuración.':'Tu coche está listo. Puedes cambiar piezas o salir a pista.';
    const nextLibrary=JSON.stringify(saved.map(e=>[e.id,e.name]));
    const previous=refs.saved.value;
    if(nextLibrary!==librarySignature){librarySignature=nextLibrary;refs.saved.innerHTML=saved.length?saved.map(e=>`<option value="${escape(e.id)}">${escape(e.name)}</option>`).join(''):'<option value="">Sin coches guardados</option>';if(saved.some(e=>e.id===selectedSaveId))refs.saved.value=selectedSaveId;else if(saved.some(e=>e.id===previous))refs.saved.value=previous;}
    if(selectedSaveId!==lastSelectedSaveId){lastSelectedSaveId=selectedSaveId;if(saved.some(e=>e.id===selectedSaveId))refs.saved.value=selectedSaveId;}
    for(const action of ['load','delete'])find(`[data-garage-action=${action}]`).disabled=!saved.length;
    refs.saved.disabled=!saved.length;
    refs.notice.textContent=notice;refs.notice.classList.toggle('visible',!!notice);
  }
  function preview(fit=false){draft=normalizeConfiguration(draft);callbacks.onPreview?.(copy(draft),{fit,slot:selectedSlot});render();}
  function save(asNew=false){
    draft=normalizeConfiguration(draft);let entry=!asNew&&saved.find(e=>e.id===selectedSaveId);
    if(!entry){if(saved.length>=12){notice='El garaje tiene 12 coches. Actualiza uno o elimina un guardado.';render();return;}entry={id:`car-${Date.now().toString(36)}`};saved.push(entry);}
    Object.assign(entry,{name:draft.name,configuration:copy(draft),updatedAt:Date.now()});selectedSaveId=entry.id;
    try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(saved));notice=`«${entry.name}» guardado en este navegador.`;}catch{notice='No se pudo guardar. El diseño sigue disponible en esta sesión.';}
    render();refs.saved.value=selectedSaveId;
  }
  function finish(cancelled){
    if(cancelled){draft=copy(applied);selectedSaveId=appliedSaveId;callbacks.onPreview?.(copy(applied),{fit:false});}
    else {
      applied=normalizeConfiguration(draft);appliedSaveId=selectedSaveId;
      try{localStorage.setItem(ACTIVE_KEY,JSON.stringify({...applied,savedId:appliedSaveId}));}
      catch{notice='El coche se usará en esta sesión, pero el navegador no permite guardarlo.';persistenceToast.textContent=notice;persistenceToast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>persistenceToast.classList.remove('visible'),6500);}
    }
    active=false;render();callbacks.onExit?.(copy(applied),{cancelled});
  }
  function onClick(event){
    const button=event.target.closest('button[data-garage-action]');if(!button||!root.contains(button)||button.disabled)return;
    const action=button.dataset.garageAction;
    if(action==='preset'){
      if(!DONORS.some(d=>d.id===button.dataset.donor))return;
      draft=stockConfiguration(button.dataset.donor);selectedSaveId='';notice='';preview(true);
    }else if(action==='slot'){
      if(!SLOTS.some(s=>s.id===button.dataset.slot))return;
      selectedSlot=button.dataset.slot;partSignature='';notice='';render();callbacks.onPreview?.(copy(draft),{fit:false,slot:selectedSlot});
    }else if(action==='part'){
      if(!DONORS.some(d=>d.id===button.dataset.donor))return;
      draft.parts[selectedSlot]=button.dataset.donor;notice='';preview();
    }else if(action==='paint'){draft.paint=button.dataset.color;notice='';preview();}
    else if(action==='apply')finish(false);
    else if(action==='back')finish(true);
    else if(action==='save'||action==='save-new')save(action==='save-new');
    else if(action==='load'){
      const entry=saved.find(e=>e.id===refs.saved.value);if(!entry)return;
      draft=normalizeConfiguration(entry.configuration);selectedSaveId=entry.id;notice=`Cargado: ${entry.name}.`;preview(true);
    }else if(action==='delete'){
      const id=refs.saved.value;saved=saved.filter(e=>e.id!==id);if(selectedSaveId===id)selectedSaveId='';if(appliedSaveId===id)appliedSaveId='';
      try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(saved));notice='Guardado eliminado. El diseño abierto sigue disponible.';}catch{notice='No se pudo actualizar la biblioteca.';}
      render();
    }else if(action==='view'){
      viewMode=button.dataset.view;for(const b of all('[data-garage-action=view]'))b.setAttribute('aria-pressed',String(b.dataset.view===viewMode));callbacks.onView?.(viewMode);
    }
  }
  function onInput(event){
    if(event.target===refs.name){draft.name=refs.name.value.slice(0,40);notice='';preview();}
    else if(event.target===refs.paint||event.target===refs.accent){draft[event.target===refs.paint?'paint':'accent']=event.target.value;notice='';preview();}
  }
  root.addEventListener('click',onClick);root.addEventListener('input',onInput);
  return {
    open(){active=true;draft=copy(applied);selectedSaveId=appliedSaveId;selectedSlot=SLOTS[0]?.id||'body';notice='';viewMode='perspective';partSignature='';refs.panel.scrollTop=0;for(const b of all('[data-garage-action=view]'))b.setAttribute('aria-pressed',String(b.dataset.view==='perspective'));preview(true);},
    getConfiguration(){return copy(applied);},
    snapshot(){return {active,configuration:copy(applied),draft:copy(draft),selectedSlot,selectedSaveId,savedCount:saved.length,stats:getVehicleStats(draft),key:configurationKey(draft),dirty:dirty()};},
    get active(){return active;},
    destroy(){clearTimeout(toastTimer);root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.remove();persistenceToast.remove();},
  };
}
