import { formatTime } from './courses.js';
import './online.css';

const roomCode = /^[A-HJ-NP-Z2-9]{6}$/;
const statusLabels = {
  racing: 'En carrera',
  finished: 'Terminó',
  dnf: 'No terminó',
};

function normalizeCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function fillSelect(select, choices) {
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = choice.id;
    option.textContent = choice.name;
    select.append(option);
  }
}

function showText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

export function createOnlineUI({ courses, assists, onCreate, onJoin, onReady, onSettings, onStart, onRematch, onLeave }) {
  const root = document.createElement('section');
  root.id = 'online-room';
  root.className = 'online-room';
  root.hidden = true;
  root.setAttribute('aria-labelledby', 'online-title');
  root.innerHTML = `
    <main class="online-panel">
      <header class="online-header">
        <div><div class="online-brand">DIECAST CIRCUIT</div><h1 id="online-title">Carrera en línea</h1></div>
        <button type="button" data-online-action="leave" class="online-button">Volver al menú</button>
      </header>
      <div class="online-error" role="alert" hidden></div>
      <form class="online-entry" autocomplete="off">
        <label class="online-field" for="online-name"><span>Tu apodo</span>
          <input id="online-name" maxlength="20" required placeholder="Nombre de piloto" autocomplete="nickname">
        </label>
        <div class="online-entry-actions">
          <div class="online-create">
            <h2>Crea una sala</h2>
            <p>Invita hasta a siete pilotos.</p>
            <button type="button" data-online-action="create" class="online-button online-primary">Crear sala</button>
          </div>
          <div class="online-join">
            <label class="online-field" for="online-code"><span>Código de invitación</span>
              <input id="online-code" placeholder="ABC234" maxlength="6" autocapitalize="characters" spellcheck="false">
            </label>
            <button type="submit" data-online-action="join" class="online-button">Unirme a la sala</button>
          </div>
        </div>
        <p class="online-connecting" role="status" hidden>Conectando con la sala…</p>
      </form>
      <div class="online-match" hidden>
        <div class="online-invite">
          <div><span class="online-label">Código de sala</span><strong class="online-code-display"></strong></div>
          <div class="online-copy-buttons">
            <button type="button" class="online-button" data-online-action="copy-code">Copiar código</button>
            <button type="button" class="online-button" data-online-action="copy-link">Copiar invitación</button>
          </div>
          <input class="online-copy-fallback" readonly aria-label="Invitación para copiar" hidden>
          <p class="online-copy-status" role="status" hidden></p>
        </div>
        <div class="online-match-details">
          <section class="online-roster" aria-labelledby="online-roster-title">
            <div class="online-section-heading"><h2 id="online-roster-title">Pilotos</h2><span class="online-player-count"></span></div>
            <ol class="online-players"></ol>
          </section>
          <section class="online-settings" aria-labelledby="online-settings-title">
            <h2 id="online-settings-title">Configuración</h2>
            <label class="online-field" for="online-course"><span>Circuito</span><select id="online-course"></select></label>
            <label class="online-field" for="online-assist"><span>Asistencia</span><select id="online-assist"></select></label>
          </section>
        </div>
        <footer class="online-match-footer">
          <p class="online-phase" role="status"></p>
          <button type="button" data-online-action="ready" class="online-button" aria-pressed="false" hidden>Estoy listo</button>
          <button type="button" data-online-action="start" class="online-button online-primary" hidden>Iniciar carrera</button>
          <button type="button" data-online-action="rematch" class="online-button online-primary" hidden>Otra carrera</button>
        </footer>
      </div>
    </main>`;
  document.body.append(root);

  const find = selector => root.querySelector(selector);
  const action = name => find(`[data-online-action="${name}"]`);
  const form = find('.online-entry');
  const match = find('.online-match');
  const connectingMessage = find('.online-connecting');
  const codeDisplay = find('.online-code-display');
  const rosterTitle = find('#online-roster-title');
  const playerCount = find('.online-player-count');
  const name = find('#online-name');
  const code = find('#online-code');
  const course = find('#online-course');
  const assist = find('#online-assist');
  const roster = find('.online-players');
  const errorBox = find('.online-error');
  const phase = find('.online-phase');
  const enter = action('create');
  const join = action('join');
  const leave = action('leave');
  const ready = action('ready');
  const start = action('start');
  const rematch = action('rematch');
  const copyField = find('.online-copy-fallback');
  const copyStatus = find('.online-copy-status');
  let current = {};
  let rosterSignature = '';
  let lastPrefill;
  let lastActive = false;
  let lastRoomCode;

  fillSelect(course, courses);
  fillSelect(assist, assists);

  const listeners = [];
  function bind(element, event, handler) {
    element.addEventListener(event, handler);
    listeners.push(() => element.removeEventListener(event, handler));
  }

  function validateNickname() {
    const nickname = name.value.trim();
    name.setCustomValidity(nickname ? '' : 'Escribe tu apodo.');
    return name.reportValidity() ? nickname : '';
  }

  function submitCreate() {
    const nickname = validateNickname();
    if (nickname && !enter.disabled) onCreate(nickname);
  }

  function submitJoin() {
    if (join.disabled) return;
    const nickname = validateNickname();
    if (!nickname) return;
    const invite = normalizeCode(code.value);
    code.setCustomValidity(roomCode.test(invite) ? '' : 'Escribe el código de seis caracteres.');
    if (code.reportValidity()) onJoin(invite, nickname);
  }

  bind(name, 'input', () => name.setCustomValidity(''));
  bind(code, 'input', () => {
    code.value = normalizeCode(code.value);
    code.setCustomValidity('');
  });
  bind(form, 'submit', event => {
    event.preventDefault();
    submitJoin();
  });
  bind(enter, 'click', submitCreate);
  bind(leave, 'click', () => onLeave());
  bind(ready, 'click', () => {
    const player = current.room?.players?.find(entry => entry.id === current.selfId);
    if (player) onReady(!player.ready);
  });
  bind(start, 'click', () => onStart());
  bind(rematch, 'click', () => onRematch());
  function changeSettings() {
    onSettings({ courseId: course.value, assistId: assist.value });
  }
  bind(course, 'change', changeSettings);
  bind(assist, 'change', changeSettings);

  async function copyInvite(withLink) {
    const selectedCode = current.room?.code;
    if (!selectedCode) return;
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('sala', selectedCode);
    const value = withLink ? url.href : selectedCode;
    try {
      await navigator.clipboard.writeText(value);
      copyField.hidden = true;
      copyStatus.textContent = withLink ? 'Invitación copiada.' : 'Código copiado.';
    } catch {
      copyField.value = value;
      copyField.hidden = false;
      copyField.focus();
      copyField.select();
      copyStatus.textContent = 'Copia el texto seleccionado.';
    }
    copyStatus.hidden = false;
  }
  bind(action('copy-code'), 'click', () => void copyInvite(false));
  bind(action('copy-link'), 'click', () => void copyInvite(true));

  function updateRoster(room, selfId) {
    const players = [...room.players];
    if (room.phase === 'results') {
      const time = player => player.status === 'finished' && Number.isFinite(player.time) ? player.time : Infinity;
      players.sort((a, b) => time(a) === time(b) ? 0 : time(a) - time(b));
    }
    const signature = JSON.stringify([room.phase, room.hostId, selfId, players]);
    if (signature === rosterSignature) return;
    rosterSignature = signature;
    roster.replaceChildren();
    players.forEach((player, index) => {
      const item = document.createElement('li');
      item.dataset.playerId = player.id;
      const rank = document.createElement('span');
      rank.className = 'online-position';
      rank.textContent = room.phase === 'results' && player.status === 'finished' ? String(index + 1) : '';
      rank.setAttribute('aria-hidden', 'true');
      const identity = document.createElement('div');
      identity.className = 'online-player';
      const title = document.createElement('strong');
      title.textContent = player.id === selfId ? `${player.name} (tú)` : player.name;
      const details = document.createElement('span');
      details.textContent = [player.vehicle?.name, player.id === room.hostId ? 'Anfitrión' : ''].filter(Boolean).join(' · ');
      identity.append(title, details);
      const status = document.createElement('span');
      status.className = 'online-player-status';
      if (room.phase === 'lobby') {
        if (player.id === room.hostId) status.textContent = '';
        else status.textContent = player.ready ? 'Listo' : 'En espera';
        status.dataset.state = player.ready ? 'ready' : 'waiting';
      } else {
        status.textContent = player.status === 'finished' && Number.isFinite(player.time) ? formatTime(player.time) : statusLabels[player.status] || 'En espera';
        status.dataset.state = player.status;
      }
      item.append(rank, identity, status);
      roster.append(item);
    });
  }

  function update(view) {
    current = view;
    root.hidden = !view.active;
    if (!view.active) {
      lastActive = false;
      return;
    }
    if (view.nickname && !lastActive && !name.value) name.value = view.nickname;
    if (view.prefillCode !== lastPrefill) {
      lastPrefill = view.prefillCode;
      if (view.prefillCode) code.value = normalizeCode(view.prefillCode);
      code.setCustomValidity('');
    }
    lastActive = true;
    const room = view.room;
    const blocked = view.configured === false;
    const connecting = view.status === 'connecting';
    const error = view.error || (blocked ? 'Este sitio aún no tiene un servidor de salas configurado.' : '');
    errorBox.hidden = !error;
    showText(errorBox, error);
    form.hidden = Boolean(room);
    match.hidden = !room;
    connectingMessage.hidden = !connecting;
    form.setAttribute('aria-busy', String(connecting));
    enter.disabled = join.disabled = blocked || connecting;
    showText(leave, room ? 'Salir de la sala' : connecting ? 'Cancelar' : 'Volver al menú');
    if (!room) return;

    if (lastRoomCode !== room.code) {
      copyField.hidden = true;
      copyStatus.hidden = true;
      lastRoomCode = room.code;
    }
    showText(codeDisplay, room.code);
    showText(rosterTitle, room.phase === 'results' ? 'Resultados' : 'Pilotos');
    showText(playerCount, `${room.players.length} / 8`);
    updateRoster(room, view.selfId);

    const host = room.hostId === view.selfId;
    const self = room.players.find(player => player.id === view.selfId);
    const lobby = room.phase === 'lobby';
    const allReady = room.players.length >= 2 && room.players.every(player => player.id === room.hostId || player.ready);
    if (course.value !== room.courseId) course.value = room.courseId;
    if (assist.value !== room.assistId) assist.value = room.assistId;
    course.disabled = assist.disabled = !host || !lobby;
    ready.hidden = !lobby || host || !self;
    showText(ready, self?.ready ? 'Aún no estoy listo' : 'Estoy listo');
    ready.setAttribute('aria-pressed', String(Boolean(self?.ready)));
    start.hidden = !lobby || !host;
    start.disabled = !allReady;
    rematch.hidden = room.phase !== 'results' || !host;

    if (lobby && room.players.length < 2) showText(phase, 'Comparte la invitación para sumar a otro piloto.');
    else if (lobby && allReady) showText(phase, host ? 'Todos listos para la salida.' : 'El anfitrión iniciará la carrera.');
    else if (lobby) showText(phase, 'Esperando a que todos estén listos.');
    else if (room.phase === 'race') showText(phase, 'Carrera en curso. Los resultados aparecerán al terminar.');
    else showText(phase, host ? 'Puedes iniciar otra carrera con este grupo.' : 'El anfitrión puede iniciar otra carrera.');
  }

  return {
    update,
    focus() {
      if (!root.hidden) (current.room ? leave : name).focus();
    },
    destroy() {
      for (const remove of listeners) remove();
      root.remove();
    },
  };
}
