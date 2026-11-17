const endpoint = import.meta.env.VITE_ROOM_SERVER?.trim() || (
  ['127.0.0.1', 'localhost'].includes(location.hostname) ? 'http://127.0.0.1:8787' : ''
);

export const roomCodePattern = /^[A-HJ-NP-Z2-9]{6}$/;

export function createRoomClient(onChange, onTick) {
  let socket;
  let pingTimer;
  let deadline;
  let clockOffset = 0;
  let bestRoundTrip = Infinity;
  let hasWelcome = false;
  const state = { room: null, selfId: null, error: '', status: 'offline', configured: Boolean(endpoint) };
  const emit = () => onChange({ ...state });

  function disconnect(clearError = true) {
    clearInterval(pingTimer);
    clearTimeout(deadline);
    const previous = socket;
    socket = undefined;
    if (previous && previous.readyState < WebSocket.CLOSING) previous.close();
    Object.assign(state, { room: null, selfId: null, status: 'offline' });
    if (clearError) state.error = '';
    hasWelcome = false;
  }

  function send(message) {
    if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 32768) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function fail(message) {
    disconnect(false);
    state.error = message;
    emit();
  }

  function connect({ code, name, vehicle }) {
    disconnect();
    name = name.trim();
    if (!endpoint) return fail('El servidor de salas aún no está configurado.');
    if (!name || name.length > 20) return fail('Escribe un apodo de 1 a 20 caracteres.');
    if (code && !roomCodePattern.test(code)) return fail('Escribe un código de seis caracteres válido.');
    let connection;
    try {
      const url = new URL(endpoint);
      if (url.protocol === 'https:') url.protocol = 'wss:';
      if (url.protocol === 'http:') url.protocol = 'ws:';
      if (!['ws:', 'wss:'].includes(url.protocol)) throw Error('Protocol');
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/rooms/${code || 'new'}`;
      url.search = '';
      url.hash = '';
      connection = new WebSocket(url);
    } catch {
      return fail('No se pudo abrir la conexión con el servidor de salas.');
    }
    socket = connection;
    bestRoundTrip = Infinity;
    clockOffset = 0;
    state.status = 'connecting';
    emit();
    deadline = setTimeout(() => fail('El servidor tardó demasiado en responder. Inténtalo de nuevo.'), 10000);
    connection.addEventListener('open', () => {
      if (connection !== socket) return;
      send({ type: 'hello', name, vehicle });
    });
    connection.addEventListener('message', ({ data }) => {
      if (connection !== socket || typeof data !== 'string') return;
      let message;
      try { message = JSON.parse(data); } catch { return; }
      if (message.type === 'welcome') {
        clearTimeout(deadline);
        hasWelcome = true;
        clockOffset = message.serverNow - Date.now();
        Object.assign(state, { status: 'connected', room: message.room, selfId: message.id });
        const ping = () => send({ type: 'ping', stamp: Date.now() });
        ping();
        pingTimer = setInterval(ping, 5000);
        emit();
      } else if (message.type === 'pong') {
        const roundTrip = Date.now() - message.stamp;
        if (roundTrip >= 0 && roundTrip <= bestRoundTrip * 1.5 && Number.isFinite(message.serverNow)) {
          bestRoundTrip = Math.min(bestRoundTrip, roundTrip);
          clockOffset = message.serverNow - message.stamp - roundTrip / 2;
        }
      } else if (message.type === 'room') {
        state.room = message.room;
        state.error = '';
        emit();
      } else if (message.type === 'tick') {
        onTick(message);
      } else if (message.type === 'error') {
        if (message.fatal || !hasWelcome) fail(message.message);
        else { state.error = message.message; emit(); }
      }
    });
    connection.addEventListener('close', () => {
      if (connection === socket) fail(hasWelcome ? 'Se perdió la conexión con la sala.' : 'No se pudo conectar al servidor de salas.');
    });
  }

  return { state, connect, send, now: () => Date.now() + clockOffset, leave() { disconnect(); emit(); } };
}
