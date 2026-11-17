import { ITEM_TYPES } from './race-items.js';
import './items.css';

const icons = {
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m4 10 2-6h12l2 6m-17 1h18v7H3zM6 18v3m12-3v3M6 14h2m8 0h2M4 10h16"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m11 5-6 4H2v6h3l6 4zM15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m11 5-6 4H2v6h3l6 4zM16 8l6 8m0-8-6 8"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 22V3c5-4 9 4 15 0v12c-6 4-10-4-15 0"/><path d="M5 7c5-4 9 4 15 0m-15 4c5-4 9 4 15 0M10 2v12m5-10v12"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m14 2-10 12h7l-1 8L21 9h-8z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 4 4L19 6"/></svg>',
};

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—:——.———';
  const milliseconds = Math.max(0, Math.floor(seconds * 1000));
  return `${String(Math.floor(milliseconds / 60000)).padStart(2, '0')}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, '0')}.${String(milliseconds % 1000).padStart(3, '0')}`;
}

function trackIcon(index) {
  const paths = [
    'M16 13h40c18 0 18 25 0 25H16c-15 0-15-25 0-25Z',
    'M9 33h13c17 0 26-7 26-17 0-12-20-12-20 0 0 10 12 17 28 17h14',
    'M8 36c15 0 10-25 25-25s10 26 26 26h14M8 28h65',
    'M7 34c16 0 11-24 26-24s9 24 24 24 17-24 4-24-16 24-31 24H7',
    'M8 36h11l9-25 10 25h10l9-25 10 25h7',
  ];
  return `<svg viewBox="0 0 82 48" fill="none" aria-hidden="true"><path d="${paths[index % paths.length]}" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 43h67" stroke="currentColor" stroke-opacity=".12"/></svg>`;
}

export function createUI(options) {
  const { courses, assists } = options;
  const root = document.createElement('div');
  root.id = 'game-ui';
  root.dataset.mode = 'menu';
  root.innerHTML = `
    <header class="race-header">
      <a class="race-wordmark" href="#" aria-label="Diecast Circuit, volver al menú"><span class="race-mark" aria-hidden="true"><i></i><i></i></span><span>DIECAST<span class="wordmark-sub">CIRCUIT</span></span></a>
      <div class="race-discipline"><span class="live-dot"></span> CONTRARRELOJ <span class="discipline-divider">/</span> <span class="discipline-meta">ESCALA 1:64</span></div>
      <div class="header-tools"><button class="menu-online-entry" type="button">Multijugador</button><button class="online-exit" type="button" hidden>Salir de la sala</button><button class="icon-button camera-button" type="button" aria-label="Cambiar cámara" title="Cambiar cámara · C">${icons.camera}</button><button class="icon-button mute-button" type="button" aria-label="Silenciar sonido" title="Silenciar sonido">${icons.sound}</button><button class="icon-button pause-button" type="button" aria-label="Pausar carrera" title="Pausar · Esc">${icons.pause}</button></div>
    </header>
    <section class="course-menu" aria-label="Selección de circuito">
      <div class="menu-heading"><div><p class="eyebrow">CINCO CIRCUITOS. UN SOLO OBJETIVO.</p><h1>Contra el reloj.</h1></div><span class="menu-heading-icon">${icons.flag}</span></div>
      <div class="course-column-labels"><span>ELIGE TU CIRCUITO</span><span>MEJOR TIEMPO</span></div>
      <div class="course-list" role="group" aria-label="Circuitos disponibles">${courses.map((course, i) => `
        <button class="course-option" data-course="${escape(course.id)}" type="button" aria-pressed="false">
          <span class="course-thumbnail">${trackIcon(i)}</span>
          <span class="course-copy"><span class="course-name">${escape(course.name)}</span><span class="course-difficulty"><span class="difficulty-ticks" aria-hidden="true">${Array.from({ length: 5 }, (_, j) => `<i class="${j <= i ? 'filled' : ''}"></i>`).join('')}</span>${escape(course.difficulty)}</span></span>
          <span class="course-record">—:——.———</span><span class="course-selection-marker" aria-hidden="true"></span>
        </button>`).join('')}</div>
      <div class="assist-heading"><h2>ASISTENCIA DE CONDUCCIÓN</h2><span class="assist-info" title="Los récords se guardan por circuito y nivel de asistencia">i</span></div>
      <div class="assist-options" role="group" aria-label="Nivel de asistencia">${assists.map((assist) => `<button type="button" data-assist="${escape(assist.id)}" class="assist-option" aria-pressed="false"><span class="assist-name">${escape(assist.name)}<span class="assist-check">${icons.check}</span></span><span class="assist-description">${escape(assist.description)}</span></button>`).join('')}</div>
      <p class="record-note">Récords por combinación de piezas y nivel de asistencia.</p>
      <button class="start-button" type="button"><span>SALIR A PISTA</span>${icons.arrow}<kbd>↵</kbd></button>
      <div class="workshop-links"><button class="garage-entry" type="button">${icons.car} GARAJE <span>→</span></button><button class="builder-entry" type="button" aria-label="Construir mi pista"><span>＋</span> CONSTRUIR PISTA <span>→</span></button></div>
      <div class="menu-vehicle"><span>COCHE ACTUAL</span><strong class="menu-vehicle-name"></strong></div>
      <p class="menu-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> CONDUCIR</span><span><kbd>SHIFT</kbd> NITRO</span><span><kbd>C</kbd> CÁMARA</span></p>
    </section>
    <aside class="preview-caption" aria-label="Detalles del circuito seleccionado"><div class="preview-caption-line"></div><p class="eyebrow">TU PRÓXIMO DESAFÍO</p><h2 class="preview-course-name"></h2><p class="preview-description"></p><div class="preview-metrics"><span class="preview-difficulty"></span><span class="preview-loops"></span><span class="preview-target"></span></div></aside>
    <div class="menu-bottom"><span><i></i> MOTOR 3D EN TIEMPO REAL</span><span>METAL. PLÁSTICO. PURA VELOCIDAD.</span></div>
    <section class="race-hud" aria-label="Datos de la carrera">
      <div class="hud-timing"><p class="eyebrow hud-course-name"></p><div class="hud-timer">00:00.000</div><div class="hud-best"><span>RÉCORD</span><strong>—:——.———</strong><span class="hud-assist"></span></div><div class="hud-vehicle-name"></div></div>
      <div class="route-overview"><canvas id="minimap" width="320" height="200" aria-label="Mapa del circuito"></canvas><span class="route-percent">0%</span></div>
      <div class="race-progress" aria-label="Progreso del circuito"><div></div></div>
      <div class="race-online-position" hidden><strong></strong><span></span></div>
      <div class="race-items" hidden>
        <p class="item-notice" role="status"></p>
        <button class="item-button" type="button" aria-label="Usar objeto" disabled>
          <span class="item-symbol" aria-hidden="true"></span>
          <span class="item-copy"><strong>Recoge una caja</strong><small></small></span>
          <kbd aria-hidden="true">E</kbd>
        </button>
      </div>
      <div class="speed-cluster"><div class="speed-number">0</div><div class="speed-units">KM/H <span class="speed-gear">N</span></div><div class="nitro-label">${icons.bolt}<span>NITRO</span><span class="nitro-key">SHIFT / ESPACIO</span></div><div class="nitro-meter" role="meter" aria-label="Reserva de nitro" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span></span></div><div class="nitro-hint">Recarga al soltar</div></div>
      <div class="race-desktop-help"><kbd>W / ↑</kbd> ACELERAR <span>·</span> <kbd>S / ↓</kbd> FRENAR <span>·</span> <kbd>A D / ← →</kbd> GIRAR <span>·</span> <kbd>R</kbd> REINICIAR</div>
    </section>
    <div class="race-message" role="status" aria-live="polite"></div>
    <div class="countdown" role="status" aria-live="assertive"></div>
    <section class="race-modal-layer" hidden><div class="race-modal" role="dialog" aria-modal="true" aria-labelledby="result-title"><div class="modal-stripe"></div><p class="eyebrow modal-eyebrow"></p><h2 id="result-title"></h2><p class="modal-description"></p><div class="result-time"></div><div class="result-record"></div><div class="modal-actions"><button class="modal-primary" type="button"></button><button class="modal-retry" type="button">REINICIAR CARRERA</button><button class="modal-menu" type="button">ELEGIR CIRCUITO ${icons.arrow}</button></div><p class="modal-footnote"></p></div></section>
    <div class="touch-controls" aria-label="Controles táctiles"><div class="touch-steering"><button type="button" data-touch="steerLeft" aria-label="Girar a la izquierda">‹</button><button type="button" data-touch="steerRight" aria-label="Girar a la derecha">›</button></div><div class="touch-pedals"><button class="touch-nitro" type="button" data-touch="nitro" aria-label="Activar nitro">${icons.bolt}</button><button class="touch-brake" type="button" data-touch="brake" aria-label="Frenar">FRENO</button><button class="touch-throttle" type="button" data-touch="throttle" aria-label="Acelerar">GAS</button></div></div>
  `;
  document.body.append(root);
  const find = (selector) => root.querySelector(selector);
  const all = (selector) => [...root.querySelectorAll(selector)];
  const listeners = [];
  const bind = (element, event, fn) => { element.addEventListener(event, fn); listeners.push(() => element.removeEventListener(event, fn)); };
  const dispatch = (name, ...args) => options[name]?.(...args);
  let currentMode = 'menu';
  let modalMode = '';
  let lastCourse = null;
  let lastAssist = null;
  let lastRecordSignature = '';
  let lastMuted = null;
  let lastMessage = '';
  let lastCountdown = '';
  let lastSpeed = '';
  let lastTime = '';
  let lastVehicleName = '';
  const courseButtons = all('[data-course]');
  const assistButtons = all('[data-assist]');
  const activePointers = new Map();
  const clearTouch = () => {
    for (const [, { action, element }] of activePointers) { dispatch('onTouch', action, false); element.classList.remove('held'); }
    activePointers.clear();
  };
  bind(find('.race-wordmark'), 'click', (event) => { event.preventDefault(); dispatch('onMenu'); });
  for (const button of courseButtons) bind(button, 'click', () => dispatch('onCourse', courses.find((c) => String(c.id) === button.dataset.course)?.id));
  for (const button of assistButtons) bind(button, 'click', () => dispatch('onAssist', assists.find((a) => String(a.id) === button.dataset.assist)?.id));
  bind(find('.start-button'), 'click', () => dispatch('onStart'));
  bind(find('.builder-entry'), 'click', () => dispatch('onBuild'));
  bind(find('.garage-entry'), 'click', () => dispatch('onGarage'));
  bind(find('.menu-online-entry'), 'click', () => dispatch('onOnline'));
  bind(find('.online-exit'), 'click', () => dispatch('onLeaveOnline'));
  bind(find('.pause-button'), 'click', () => dispatch('onPause'));
  bind(find('.mute-button'), 'click', () => dispatch('onMute'));
  bind(find('.camera-button'), 'click', () => dispatch('onCamera'));
  const itemBox = find('.race-items');
  const itemButton = find('.item-button');
  const itemName = find('.item-copy strong');
  const itemHint = find('.item-copy small');
  const itemNotice = find('.item-notice');
  bind(itemButton, 'click', () => dispatch('onItem'));
  bind(find('.modal-primary'), 'click', () => dispatch(currentMode === 'paused' ? 'onResume' : 'onRetry'));
  bind(find('.modal-retry'), 'click', () => dispatch('onRetry'));
  bind(find('.modal-menu'), 'click', () => dispatch('onMenu'));
  for (const element of all('[data-touch]')) {
    bind(element, 'pointerdown', (event) => {
      event.preventDefault();
      if (currentMode !== 'racing' && currentMode !== 'countdown') return;
      element.setPointerCapture(event.pointerId);
      const action = element.dataset.touch;
      activePointers.set(event.pointerId, { action, element });
      element.classList.add('held');
      dispatch('onTouch', action, true);
    });
    const release = (event) => {
      const active = activePointers.get(event.pointerId);
      if (!active) return;
      activePointers.delete(event.pointerId);
      active.element.classList.remove('held');
      dispatch('onTouch', active.action, false);
    };
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) bind(element, eventName, release);
    bind(element, 'contextmenu', (event) => event.preventDefault());
  }
  bind(window, 'blur', clearTouch);
  bind(document, 'visibilitychange', () => { if (document.hidden) clearTouch(); });

  const refs = {
    timer: find('.hud-timer'), speed: find('.speed-number'), gear: find('.speed-gear'),
    nitro: find('.nitro-meter span'), nitroMeter: find('.nitro-meter'), progress: find('.race-progress div'),
    percent: find('.route-percent'), countdown: find('.countdown'), message: find('.race-message'),
    modalLayer: find('.race-modal-layer'), modalTitle: find('#result-title'),
  };
  function update(view) {
    root.toggleAttribute('data-online', Boolean(view.online));
    find('.online-exit').hidden = !view.online;
    const position = find('.race-online-position');
    position.hidden = !view.online;
    if (view.online) {
      position.querySelector('strong').textContent = `${view.online.position} / ${view.online.total}`;
      position.querySelector('span').textContent = `SALA ${view.online.code}`;
    }
    itemBox.hidden = !view.items;
    if (view.items) {
      const { kind, usable, shielded, notice } = view.items;
      const item = ITEM_TYPES[kind];
      const name = item?.name ?? (shielded ? 'Escudo activo' : 'Recoge una caja');
      const hint = item?.hint ?? '';
      if (itemName.textContent !== name) itemName.textContent = name;
      if (itemHint.textContent !== hint) itemHint.textContent = hint;
      if (itemNotice.textContent !== notice) itemNotice.textContent = notice;
      if (itemButton.dataset.item !== (kind ?? 'empty')) itemButton.dataset.item = kind ?? 'empty';
      itemButton.disabled = !usable;
    }
    const vehicleName=view.vehicle?.name||'GT 02';
    if(vehicleName!==lastVehicleName){find('.menu-vehicle-name').textContent=vehicleName;find('.hud-vehicle-name').textContent=vehicleName;lastVehicleName=vehicleName;}
    const course = view.course || courses.find((c) => c.id === view.courseId) || courses[0];
    const assist = assists.find((a) => a.id === view.assistId) || assists[0];
    const mode = view.mode || 'menu';
    if (mode !== currentMode) {
      if (!['racing', 'countdown'].includes(mode)) clearTouch();
      currentMode = mode;
      root.dataset.mode = mode;
      document.body.dataset.gameMode = mode;
    }
    if (`${course.id}:${course.name}` !== lastCourse) {
      lastCourse = `${course.id}:${course.name}`;
      for (const button of courseButtons) button.setAttribute('aria-pressed', String(button.dataset.course === String(course.id)));
      find('.preview-course-name').textContent = course.name;
      find('.preview-description').textContent = course.description || '';
      find('.preview-difficulty').textContent = course.difficulty;
      find('.preview-loops').textContent = `${course.loops} ${course.loops === 1 ? 'LOOP' : 'LOOPS'}`;
      find('.preview-target').textContent = course.target ? `META ${formatTime(course.target)}` : 'CONTRARRELOJ';
      find('.hud-course-name').textContent = course.name;
      find('.modal-menu').innerHTML = `${course.id.startsWith('custom-')?'VOLVER AL TALLER':'ELEGIR CIRCUITO'} ${icons.arrow}`;
    }
    if (assist.id !== lastAssist) {
      lastAssist = assist.id;
      for (const button of assistButtons) button.setAttribute('aria-pressed', String(button.dataset.assist === String(assist.id)));
      find('.hud-assist').textContent = assist.name;
    }
    const records = view.records || {};
    const recordSignature = `${view.vehicleKey||''}:${course.id}:${assist.id}:${records[`${course.id}-${assist.id}`]??''}:${courses.map((c) => records[`${c.id}-${assist.id}`] ?? '').join(',')}`;
    if (recordSignature !== lastRecordSignature) {
      lastRecordSignature = recordSignature;
      courses.forEach((c, i) => { courseButtons[i].querySelector('.course-record').textContent = formatTime(records[`${c.id}-${assist.id}`]); });
      find('.hud-best strong').textContent = formatTime(records[`${course.id}-${assist.id}`]);
    }
    const speed = String(Math.max(0, Math.round(view.speed || 0)));
    if (speed !== lastSpeed) { refs.speed.textContent = speed; lastSpeed = speed; refs.gear.textContent = Number(speed) < 1 ? 'N' : String(Math.min(6, Math.floor(Number(speed) / 45) + 1)); }
    const time = formatTime(view.elapsed || 0);
    if (time !== lastTime) { refs.timer.textContent = time; lastTime = time; }
    const nitro = Math.max(0, Math.min(1, view.nitro ?? 1));
    refs.nitro.style.transform = `scaleX(${nitro})`;
    refs.nitroMeter.setAttribute('aria-valuenow', String(Math.round(nitro * 100)));
    refs.nitroMeter.classList.toggle('low', nitro < 0.18);
    const progress = Math.max(0, Math.min(1, view.progress || 0));
    refs.progress.style.transform = `scaleX(${progress})`;
    refs.percent.textContent = `${Math.floor(progress * 100)}%`;
    const muted = Boolean(view.muted);
    if (muted !== lastMuted) {
      lastMuted = muted;
      find('.mute-button').innerHTML = muted ? icons.muted : icons.sound;
      find('.mute-button').setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
      find('.mute-button').setAttribute('aria-pressed', String(muted));
    }
    const countdown = mode === 'countdown' ? (view.countdown > 0 ? String(Math.ceil(view.countdown)) : '¡YA!') : '';
    if (countdown !== lastCountdown) {
      lastCountdown = countdown;
      refs.countdown.textContent = countdown;
      if (countdown && !matchMedia('(prefers-reduced-motion: reduce)').matches) refs.countdown.animate([{ opacity: 1, transform: 'translate(-50%, -50%) scale(1.1)' }, { opacity: 0.7, transform: 'translate(-50%, -50%) scale(1)' }], { duration: 650, easing: 'ease-out' });
    }
    const message = ['racing', 'countdown'].includes(mode) ? (view.message || '') : '';
    if (message !== lastMessage) { lastMessage = message; refs.message.textContent = message; refs.message.classList.toggle('visible', Boolean(message)); }
    const isModal = ['paused', 'finished', 'crashed'].includes(mode);
    refs.modalLayer.hidden = !isModal;
    if (isModal && (modalMode !== mode || view.result?.time !== refs.modalLayer._time)) {
      modalMode = mode;
      refs.modalLayer._time = view.result?.time;
      const paused = mode === 'paused';
      const crashed = mode === 'crashed';
      find('.modal-eyebrow').textContent = paused ? 'RESPIRA. LA PISTA TE ESPERA.' : crashed ? 'CADA INTENTO CUENTA.' : view.result?.newBest ? 'NUEVO RÉCORD PERSONAL' : 'BANDERA A CUADROS';
      refs.modalTitle.textContent = paused ? 'Carrera en pausa.' : crashed ? 'Fuera de pista.' : 'Vuelta completada.';
      find('.modal-description').textContent = crashed ? (view.result?.reason || 'Controla la velocidad en las curvas y guarda nitro para los loops.') : `${course.name} · ${vehicleName} · Asistencia ${assist.name.toLowerCase()}`;
      find('.result-time').textContent = paused || crashed ? '' : formatTime(view.result?.time ?? view.elapsed);
      find('.result-record').textContent = paused || crashed ? '' : `MEJOR TIEMPO  ${formatTime(view.result?.best ?? records[`${course.id}-${assist.id}`])}`;
      find('.modal-primary').innerHTML = `${paused ? 'VOLVER A LA CARRERA' : 'OTRA VUELTA'} ${icons.arrow}`;
      find('.modal-retry').hidden = !paused;
      find('.modal-footnote').textContent = paused ? 'ESC para continuar · R para reiniciar' : crashed ? 'R para volver a intentarlo' : view.result?.saved===false ? 'Tiempo disponible en esta sesión; el navegador no permitió guardarlo.' : 'Récord guardado en este navegador.';
      queueMicrotask(() => find('.modal-primary').focus({ preventScroll: true }));
    }
    if (!isModal) modalMode = '';
  }
  return { update, destroy() { clearTouch(); listeners.forEach((remove) => remove()); root.remove(); delete document.body.dataset.gameMode; } };
}
