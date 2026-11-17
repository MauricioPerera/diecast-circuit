import './builder.css';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  arrow: '<svg viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m14 5-7 7 7 7M7 12h14"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M7 8H2V3m0 5c7-9 20-4 18 5-1 5-6 7-11 5"/></svg>',
  redo: '<svg viewBox="0 0 24 24"><path d="M17 8h5V3m0 5C15-1 2 4 4 13c1 5 6 7 11 5"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M4 3h13l4 4v14H3V3h1Zm3 0v7h10V3M7 21v-7h10v7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/></svg>',
};
const shapePaths = {
  straight: 'M9 13h48M9 25h48',
  short: 'M20 13h26M20 25h26',
  right: 'M10 10h21c16 0 23 7 23 20M10 21h21c8 0 12 3 12 9',
  left: 'M56 10H35C19 10 12 17 12 30M56 21H35c-8 0-12 3-12 9',
  ramp: 'M8 29c11 0 11-20 24-20s13 20 25 20M8 34h49',
  jump: 'M7 31h7q11 0 17-14M39 23h18M39 30h18',
  open: 'M9 15h19c13 0 24 9 24 21M9 25h19c8 0 14 5 14 11',
  loop: 'M5 29h15c14 0 28-8 28-18 0-11-23-11-23 0 0 10 14 18 30 18h7',
};
function pieceIcon(type) {
  return `<svg class="builder-piece-drawing" viewBox="0 0 66 40" aria-hidden="true"><path d="${shapePaths[type] || shapePaths.straight}"/></svg>`;
}
function parametersFor(meta) { return Array.isArray(meta?.parameters) ? meta.parameters : meta?.parameter ? [meta.parameter] : []; }

export function createBuilderUI(options) {
  const pieces = options.pieces || [];
  const root = document.createElement('section');
  root.id = 'track-builder';
  root.className = 'track-builder';
  root.hidden = true;
  root.setAttribute('aria-label', 'Taller de pistas');
  root.innerHTML = `
    <header class="builder-header">
      <button class="builder-icon builder-exit" type="button" data-editor-action="exit" aria-label="Volver al menú" title="Volver al menú">${icons.back}</button>
      <div class="builder-heading"><p>DIECAST / CIRCUIT</p><h1>TALLER DE PISTAS</h1></div>
      <div class="builder-history"><button class="builder-icon" type="button" data-editor-action="undo" aria-label="Deshacer" title="Deshacer">${icons.undo}</button><button class="builder-icon" type="button" data-editor-action="redo" aria-label="Rehacer" title="Rehacer">${icons.redo}</button></div>
    </header>
    <div class="builder-view-tools" role="group" aria-label="Vista del circuito"><button type="button" data-editor-action="view" data-view="perspective" aria-pressed="true">3D</button><button type="button" data-editor-action="view" data-view="top" aria-pressed="false">PLANTA</button></div>
    <div class="builder-preview-help"><span class="builder-preview-dot"></span> VISTA PREVIA EN VIVO <span>Arrastra para girar · rueda para acercar</span></div>
    <aside class="builder-panel" aria-label="Herramientas de construcción">
      <section class="builder-identity"><label for="builder-name">NOMBRE DEL CIRCUITO</label><input id="builder-name" name="track-name" type="text" maxlength="40" placeholder="Mi circuito" autocomplete="off" spellcheck="false"><div class="builder-field-heading"><label for="builder-width">ANCHO DE PISTA</label><output for="builder-width" class="builder-width-output">6.4 m</output></div><input id="builder-width" name="track-width" type="range" min="5" max="8" step="0.1" value="6.4"></section>
      <section class="builder-palette-section"><div class="builder-section-heading"><h2>AÑADIR UNA PIEZA</h2><span>ENCAJA · CONSTRUYE</span></div><div class="builder-palette">${pieces.map(meta => `<button type="button" class="builder-palette-piece" data-editor-action="add" data-piece="${escape(meta.id)}" title="${escape(meta.description || meta.label)}">${pieceIcon(meta.id)}<span>${escape(meta.label || meta.id)}</span><i aria-hidden="true">+</i></button>`).join('')}</div></section>
      <section class="builder-sequence-section"><div class="builder-section-heading"><h2>TU RECORRIDO <span class="builder-piece-count">0</span></h2><div class="builder-reset-tools"><button type="button" data-editor-action="new" title="Empezar un circuito nuevo">NUEVA</button><button type="button" data-editor-action="template" title="Cargar el circuito de ejemplo">EJEMPLO</button></div></div><ol class="builder-sequence" aria-label="Piezas del recorrido"></ol><p class="builder-empty" hidden>Añade piezas para comenzar. Deja una recta de salida antes del primer loop.</p></section>
      <section class="builder-inspector" aria-label="Pieza seleccionada"><div class="builder-section-heading"><h2>AJUSTAR PIEZA</h2><span class="builder-selected-number"></span></div><div class="builder-inspector-content"></div></section>
      <section class="builder-library"><div class="builder-section-heading"><h2>MIS PISTAS</h2><span>EN ESTE NAVEGADOR</span></div><label class="builder-sr-only" for="builder-saved">Pistas guardadas</label><div class="builder-library-row"><select id="builder-saved" aria-label="Pistas guardadas"><option value="">Sin pistas guardadas</option></select><button class="builder-icon builder-load" type="button" data-editor-action="load" aria-label="Cargar pista guardada" title="Cargar pista guardada">${icons.arrow}</button><button class="builder-icon builder-delete-saved" type="button" data-editor-action="delete-saved" aria-label="Borrar pista guardada" title="Borrar pista guardada">${icons.trash}</button></div></section>
      <p class="builder-panel-note">Cada cambio dibuja el recorrido. Cierra el circuito para comprobarlo y salir a pista.</p>
    </aside>
    <footer class="builder-footer"><div class="builder-status" role="status" aria-live="polite"><div class="builder-status-title"><span class="builder-status-light"></span><strong>DISEÑANDO EL RECORRIDO</strong></div><div class="builder-status-description"></div><div class="builder-track-stats"><span><strong class="builder-length">0</strong> M</span><span><strong class="builder-loops">0</strong> LOOPS</span><span class="builder-closed-state">ABIERTO</span></div></div><div class="builder-actions"><button class="builder-close" type="button" data-editor-action="close">${icons.check}<span>CERRAR CIRCUITO</span></button><button class="builder-save" type="button" data-editor-action="save">${icons.save}<span>GUARDAR</span></button><button class="builder-play" type="button" data-editor-action="play" disabled><span>PROBAR PISTA</span>${icons.arrow}</button></div></footer>
    <div class="builder-notice" role="status" aria-live="polite"></div>
  `;
  document.body.append(root);
  const find = selector => root.querySelector(selector);
  const refs = {
    panel: find('.builder-panel'), name: find('#builder-name'), width: find('#builder-width'), widthValue: find('.builder-width-output'),
    sequence: find('.builder-sequence'), empty: find('.builder-empty'), count: find('.builder-piece-count'),
    inspector: find('.builder-inspector-content'), selectedNumber: find('.builder-selected-number'),
    saved: find('#builder-saved'), load: find('.builder-load'), deleteSaved: find('.builder-delete-saved'),
    undo: find('[data-editor-action="undo"]'), redo: find('[data-editor-action="redo"]'),
    play: find('.builder-play'), save: find('.builder-save'), close: find('.builder-close'),
    status: find('.builder-status'), statusTitle: find('.builder-status-title strong'), statusDescription: find('.builder-status-description'),
    length: find('.builder-length'), loops: find('.builder-loops'), closed: find('.builder-closed-state'), notice: find('.builder-notice'),
  };
  const emit = (name, ...args) => options[name]?.(...args);
  let currentView = null, sequenceSignature = '', inspectorSignature = '', librarySignature = '', localSavedId = '', lastSelectedSaveId = undefined, viewMode = 'perspective';
  const syncValue = (element, value) => { if (document.activeElement !== element && element.value !== String(value)) element.value = value; };
  const text = (element, value) => { if (element.textContent !== String(value)) element.textContent = value; };

  function onClick(event) {
    const button = event.target.closest('button[data-editor-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.editorAction;
    const index = Number(button.dataset.index);
    if (['new','template','undo','redo'].includes(action)) emit('onChange', {type: action});
    else if (action === 'add') emit('onChange', {type:'add',pieceType:button.dataset.piece});
    else if (action === 'select') emit('onChange', {type:'select',index});
    else if (action === 'remove') emit('onChange', {type:'remove',index});
    else if (action === 'move') emit('onChange', {type:'move',index,direction:Number(button.dataset.direction)});
    else if (action === 'close') emit('onCloseTrack');
    else if (action === 'save') emit('onSave');
    else if (action === 'play' && currentView?.closed && currentView?.validation?.valid) emit('onPlay');
    else if (action === 'exit') emit('onExit');
    else if (action === 'load' && refs.saved.value) emit('onLoad', refs.saved.value);
    else if (action === 'delete-saved' && refs.saved.value) emit('onDeleteSaved', refs.saved.value);
    else if (action === 'view') {
      viewMode = button.dataset.view;
      for (const element of root.querySelectorAll('[data-editor-action="view"]')) element.setAttribute('aria-pressed', String(element.dataset.view === viewMode));
      emit('onView', viewMode);
    }
  }
  function onInput(event) {
    if (event.target === refs.name) emit('onChange', {type:'name',value:refs.name.value});
    else if (event.target === refs.width) emit('onChange', {type:'width',value:Number(refs.width.value)});
    else if (event.target.dataset.parameter) emit('onChange', {type:'parameter',key:event.target.dataset.parameter,value:Number(event.target.value)});
  }
  function onChange(event) {
    if (event.target === refs.saved) { localSavedId = refs.saved.value; refs.load.disabled = refs.deleteSaved.disabled = !localSavedId; }
  }
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);

  function update(view) {
    currentView = view;
    const wasActive = !root.hidden;
    root.hidden = !view.active;
    if (!view.active) return;
    if (!wasActive) { refs.panel.scrollTop = 0; viewMode = 'perspective'; for (const element of root.querySelectorAll('[data-editor-action="view"]')) element.setAttribute('aria-pressed', String(element.dataset.view === viewMode)); }
    const draft = view.draft || {pieces:[],name:'',width:6.4};
    const sequence = draft.pieces || [];
    const selectedIndex = Number.isInteger(view.selectedIndex) ? view.selectedIndex : sequence.length - 1;
    const validation = view.validation || {};
    const errors = validation.errors || [], warnings = validation.warnings || [];
    syncValue(refs.name, draft.name || '');
    syncValue(refs.width, draft.width || 6.4);
    text(refs.widthValue, `${Number(draft.width || 6.4).toFixed(1)} m`);
    text(refs.count, sequence.length);
    refs.empty.hidden = sequence.length > 0;
    const nextSequence = JSON.stringify([sequence,selectedIndex]);
    if (nextSequence !== sequenceSignature) {
      sequenceSignature = nextSequence;
      refs.sequence.innerHTML = sequence.map((piece,index) => {
        const meta = pieces.find(entry => entry.id === piece.type);
        const parameter = parametersFor(meta)[0];
        const value = parameter && Number.isFinite(Number(piece[parameter.key])) ? `${Number(piece[parameter.key])}${parameter.unit || ''}` : '';
        return `<li class="builder-segment${index === selectedIndex ? ' selected' : ''}" data-segment="${index}"><button type="button" class="builder-segment-select" data-editor-action="select" data-index="${index}" aria-pressed="${index === selectedIndex}" aria-label="Seleccionar pieza ${index+1}: ${escape(meta?.label || piece.type)}"><span class="builder-segment-number">${String(index+1).padStart(2,'0')}</span>${pieceIcon(piece.type)}<span class="builder-segment-name">${escape(meta?.label || piece.type)}</span><span class="builder-segment-value">${escape(value)}</span></button><div class="builder-segment-tools"><button type="button" data-editor-action="move" data-index="${index}" data-direction="-1" aria-label="Subir pieza ${index+1}" title="Subir pieza" ${index===0?'disabled':''}>↑</button><button type="button" data-editor-action="move" data-index="${index}" data-direction="1" aria-label="Bajar pieza ${index+1}" title="Bajar pieza" ${index===sequence.length-1?'disabled':''}>↓</button><button type="button" data-editor-action="remove" data-index="${index}" aria-label="Quitar pieza ${index+1}" title="Quitar pieza">×</button></div></li>`;
      }).join('');
    }
    const piece = sequence[selectedIndex], meta = pieces.find(entry => entry.id === piece?.type), parameters = parametersFor(meta);
    const inspectorKey = JSON.stringify([selectedIndex,piece?.type,parameters]);
    if (inspectorKey !== inspectorSignature) {
      inspectorSignature = inspectorKey;
      refs.selectedNumber.textContent = piece ? `PIEZA ${String(selectedIndex+1).padStart(2,'0')}` : '';
      refs.inspector.innerHTML = !piece ? '<p class="builder-selection-help">Selecciona una pieza del recorrido.</p>' : `<div class="builder-inspector-title">${pieceIcon(piece.type)}<strong>${escape(meta?.label || piece.type)}</strong></div><p class="builder-inspector-description">${escape(meta?.description || 'Encajada al final de la pieza anterior.')}</p>${parameters.length ? parameters.map(parameter => `<div class="builder-parameter"><div class="builder-field-heading"><label for="builder-param-${escape(parameter.key)}">${escape(parameter.label || parameter.key)}</label><output data-parameter-output="${escape(parameter.key)}" for="builder-param-${escape(parameter.key)}"></output></div><input id="builder-param-${escape(parameter.key)}" type="range" data-parameter="${escape(parameter.key)}" min="${escape(parameter.min)}" max="${escape(parameter.max)}" step="${escape(parameter.step || 1)}"><div class="builder-range-bounds"><span>${escape(parameter.min)}${escape(parameter.unit || '')}</span><span>${escape(parameter.max)}${escape(parameter.unit || '')}</span></div></div>`).join('') : '<p class="builder-selection-help">Esta pieza conserva sus medidas de encaje.</p>'}`;
    }
    for (const parameter of parameters) {
      const input = refs.inspector.querySelector(`[data-parameter="${CSS.escape(parameter.key)}"]`);
      const output = refs.inspector.querySelector(`[data-parameter-output="${CSS.escape(parameter.key)}"]`);
      const value = piece?.[parameter.key] ?? parameter.default ?? parameter.min;
      if (input) syncValue(input,value);
      if (output) output.textContent = `${value} ${parameter.unit || ''}`.trim();
    }
    const savedTracks = view.savedTracks || [];
    const nextLibrary = JSON.stringify(savedTracks.map(saved => [saved.id,saved.name]));
    if (nextLibrary !== librarySignature) {
      librarySignature = nextLibrary;
      refs.saved.innerHTML = savedTracks.length ? savedTracks.map(saved => `<option value="${escape(saved.id)}">${escape(saved.name || 'Circuito sin nombre')}</option>`).join('') : '<option value="">Sin pistas guardadas</option>';
      if (savedTracks.some(saved => saved.id === localSavedId)) refs.saved.value = localSavedId;
    }
    if (view.selectedSaveId !== lastSelectedSaveId) {
      lastSelectedSaveId = view.selectedSaveId;
      if (view.selectedSaveId && savedTracks.some(saved => saved.id === view.selectedSaveId)) refs.saved.value = view.selectedSaveId;
    }
    localSavedId = refs.saved.value;
    refs.load.disabled = refs.deleteSaved.disabled = !localSavedId;
    refs.saved.disabled = !savedTracks.length;
    refs.undo.disabled = !view.canUndo;
    refs.redo.disabled = !view.canRedo;
    refs.play.disabled = !(view.closed && validation.valid);
    refs.save.disabled = !sequence.length;
    refs.close.disabled = !sequence.length;
    root.querySelectorAll('[data-editor-action="add"]').forEach(button => button.disabled = sequence.length >= 32);
    const status = errors.length ? 'error' : view.closed && validation.valid ? 'ready' : 'open';
    refs.status.dataset.status = status;
    text(refs.statusTitle, status === 'error' ? 'REVISA EL RECORRIDO' : status === 'ready' ? 'LISTA PARA CORRER' : 'CIRCUITO EN CONSTRUCCIÓN');
    text(refs.statusDescription, errors[0] || (status === 'ready' ? warnings[0] || 'Salida y meta conectadas. Tu pista está lista.' : 'Cierra el circuito para conectar la salida con la meta.'));
    refs.statusDescription.title = [...errors,...warnings].join('\n');
    text(refs.length, Number.isFinite(validation.length) ? Math.round(validation.length) : '—');
    text(refs.loops, Number.isFinite(validation.loops) ? validation.loops : sequence.filter(piece => piece.type==='loop').length);
    text(refs.closed, view.closed ? 'CERRADO' : 'ABIERTO');
    text(refs.notice, view.notice || '');
    refs.notice.classList.toggle('visible',Boolean(view.notice));
  }
  return {update,destroy(){root.removeEventListener('click',onClick);root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.remove();}};
}
