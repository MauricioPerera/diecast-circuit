import { DurableObject } from 'cloudflare:workers';
import { assists, courses, TRACK_RULES_VERSION } from '../src/courses.js';
import { createTrackData } from '../src/track.js';
import { normalizeConfiguration } from '../src/vehicles.js';
import { itemBoxes } from '../src/race-items.js';
import { advanceCombat, combatSnapshot, createCombat, useRaceItem } from './race-combat.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const MAX_PLAYERS = 8;
const MAX_FRAME_BYTES = 4096;
const JOIN_WINDOW_MS = 12_000;
const IDLE_MS = 30 * 60_000;
const START_DELAY_MS = 4500;
const RACE_LIMIT_MS = 150_000;
const TICK_SPACING_MS = 65;
// The fastest current vehicle reaches 50.6 track units/s with nitro.
const MAX_SPEED = 54;
const FINISH_TOLERANCE = 12;
const CLASSIC_TRACK_RULES = 2;
const COURSE_BY_ID = new Map(courses.map(course => [course.id, course]));
const ASSIST_IDS = new Set(assists.map(assist => assist.id));
const COURSE_DATA = new Map();
const textEncoder = new TextEncoder();

function raceCourse(courseId) {
  if (!COURSE_DATA.has(courseId)) {
    const track = createTrackData(COURSE_BY_ID.get(courseId));
    COURSE_DATA.set(courseId, { track, boxes: itemBoxes(track) });
  }
  return COURSE_DATA.get(courseId);
}

function inviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, byte => CODE_ALPHABET[byte & 31]).join('');
}

function cleanName(input) {
  if (typeof input !== 'string') return '';
  return Array.from(input.normalize('NFKC').replace(/\p{C}/gu, '').trim().replace(/\s+/g, ' '))
    .slice(0, 24).join('');
}

function publicRoom({ code, hostId, phase, courseId, assistId, startAt, raceId, players, itemsEnabled }) {
  return { code, hostId, phase, courseId, assistId, startAt, raceId, players, itemsEnabled };
}

function send(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try { socket.send(JSON.stringify(message)); } catch { /* Connection closed during send. */ }
}

function close(socket, code, reason) {
  try { socket.close(code, reason); } catch { /* Already closed. */ }
}

function fail(socket, message, fatal = false) {
  send(socket, { type: 'error', message, fatal });
  if (fatal) close(socket, 1008, 'Sala no disponible');
}

function isUpgrade(request) {
  return request.method === 'GET' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, service: 'diecast-rooms' });
    }
    const match = /^\/rooms\/([^/]+)\/?$/.exec(url.pathname);
    if (!match) return new Response('Ruta no encontrada', { status: 404 });
    if (!isUpgrade(request)) return new Response('Se requiere WebSocket', { status: 426 });
    const origins = (env.ROOM_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (origins.length && !origins.includes(request.headers.get('Origin'))) {
      return new Response('Origen no permitido', { status: 403 });
    }

    const create = match[1] === 'new';
    if (!create && !CODE_PATTERN.test(match[1])) {
      return new Response('Código de sala inválido', { status: 400 });
    }

    for (let attempt = 0; attempt < (create ? 5 : 1); attempt++) {
      const code = create ? inviteCode() : match[1];
      const path = create ? '/create/' : '/join/';
      const forwarded = new Request(new URL(path + code, url), request);
      const response = await env.ROOMS.getByName(code).fetch(forwarded);
      if (response.status !== 409 || !create) return response;
    }
    return new Response('No se pudo asignar un código. Intenta de nuevo.', { status: 503 });
  },
};

export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = ctx.storage.kv.get('room');
    this.connections = new WeakMap();
  }

  #connection(socket) {
    let connection = this.connections.get(socket);
    if (!connection) {
      connection = socket.deserializeAttachment();
      if (connection) this.connections.set(socket, connection);
    }
    return connection;
  }

  #keepConnection(socket, connection) {
    this.connections.set(socket, connection);
    socket.serializeAttachment(connection);
  }

  #persist() {
    try {
      this.ctx.storage.kv.put('room', this.room);
    } catch (error) {
      this.room = this.ctx.storage.kv.get('room');
      throw error;
    }
  }

  #broadcast(message, except) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== except && this.#connection(socket)?.joined) send(socket, message);
    }
  }

  async #publish(now = Date.now()) {
    this.room.expiresAt = now + IDLE_MS;
    this.#persist();
    this.#broadcast({ type: 'room', room: publicRoom(this.room), serverNow: now });
    await this.#schedule();
  }

  async #schedule() {
    if (!this.room) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    let deadline = this.room.expiresAt;
    if (this.room.phase === 'race') deadline = Math.min(deadline, this.room.raceDeadline);
    for (const socket of this.ctx.getWebSockets()) {
      const connection = this.#connection(socket);
      if (connection && !connection.joined && socket.readyState === WebSocket.OPEN) {
        deadline = Math.min(deadline, connection.helloBy);
      }
    }
    await this.ctx.storage.setAlarm(deadline);
  }

  #clear() {
    this.ctx.storage.kv.delete('room');
    this.room = undefined;
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState === WebSocket.OPEN) fail(socket, 'La sala se cerró.', true);
    }
  }

  async fetch(request) {
    const match = /^\/(create|join)\/([A-HJ-NP-Z2-9]{6})$/.exec(new URL(request.url).pathname);
    if (!isUpgrade(request) || !match) return new Response('Ruta no encontrada', { status: 404 });
    const create = match[1] === 'create';
    const now = Date.now();
    if (this.room && now >= this.room.expiresAt) this.#clear();
    if (create && this.room) return new Response(null, { status: 409 });

    const [client, socket] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(socket);
    const upgrade = new Response(null, { status: 101, webSocket: client });
    const id = crypto.randomUUID();
    if (create) {
      this.room = {
        code: match[2], hostId: null, creatorId: id, phase: 'lobby',
        courseId: 'district', assistId: 'full', startAt: null, raceId: null,
        expiresAt: now + JOIN_WINDOW_MS, players: [],
      };
      this.#persist();
    } else if (!this.room?.hostId) {
      fail(socket, 'Esa sala no existe o ya se cerró.', true);
      return upgrade;
    } else if (this.room.phase !== 'lobby') {
      fail(socket, 'La carrera ya empezó. Espera a que el anfitrión abra la siguiente ronda.', true);
      return upgrade;
    } else if (this.#occupiedSeats(now) >= MAX_PLAYERS) {
      fail(socket, 'La sala ya tiene ocho jugadores.', true);
      return upgrade;
    }

    this.#keepConnection(socket, { id, joined: false, helloBy: now + JOIN_WINDOW_MS });
    await this.#schedule();
    return upgrade;
  }

  #occupiedSeats(now) {
    let count = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const connection = this.#connection(socket);
      if (!connection || socket.readyState !== WebSocket.OPEN) continue;
      if (connection.joined || now < connection.helloBy) count++;
      else fail(socket, 'Se agotó el tiempo para identificarte.', true);
    }
    return count;
  }

  async #hello(socket, connection, message, now) {
    if (message.type !== 'hello') {
      fail(socket, 'Envía tu apodo para entrar a la sala.', true);
      return;
    }
    const version = message.trackRules;
    const roomVersion = this.room?.trackRules ?? CLASSIC_TRACK_RULES;
    if (version === TRACK_RULES_VERSION && this.room?.hostId && roomVersion === CLASSIC_TRACK_RULES) {
      fail(socket, 'El anfitrión debe recargar el juego y crear una sala nueva.', true);
      return;
    }
    if ((version !== TRACK_RULES_VERSION && version !== CLASSIC_TRACK_RULES) || (this.room?.hostId && version !== roomVersion)) {
      fail(socket, 'Hay una actualización de pista. Recarga el juego para entrar.', true);
      return;
    }
    if (!this.room || this.room.phase !== 'lobby' || now >= connection.helloBy || now >= this.room.expiresAt) {
      fail(socket, 'La entrada a esta sala ya venció.', true);
      return;
    }
    const name = cleanName(message.name);
    if (!name || !/[\p{L}\p{N}]/u.test(name)) {
      fail(socket, 'Escribe un apodo con al menos una letra o un número.', true);
      return;
    }
    if (this.room.players.some(player => player.name.toLowerCase() === name.toLowerCase())) {
      fail(socket, 'Ese apodo ya está en uso en esta sala.', true);
      return;
    }
    if (this.room.players.length >= MAX_PLAYERS) {
      fail(socket, 'La sala ya tiene ocho jugadores.', true);
      return;
    }
    const host = !this.room.hostId && this.room.creatorId === connection.id;
    if (host) {
      this.room.hostId = connection.id;
      this.room.trackRules = version;
      this.room.itemsEnabled = version === TRACK_RULES_VERSION;
    }
    this.room.players.push({
      id: connection.id, name, vehicle: normalizeConfiguration(message.vehicle),
      ready: host, status: 'waiting', time: null, connected: true,
    });
    connection.joined = true;
    connection.trackRules = version;
    this.#keepConnection(socket, connection);
    this.room.expiresAt = now + IDLE_MS;
    this.#persist();
    const room = publicRoom(this.room);
    send(socket, { type: 'welcome', id: connection.id, serverNow: now, room, trackRules: version });
    this.#broadcast({ type: 'room', room, serverNow: now }, socket);
    await this.#schedule();
  }

  #rateLimit(connection, now) {
    if (now - (connection.controlSince ?? 0) >= 1000) {
      connection.controlSince = now;
      connection.controlCount = 0;
    }
    connection.controlCount = (connection.controlCount ?? 0) + 1;
    return connection.controlCount <= 16;
  }

  #active(player, message) {
    return this.room.phase === 'race' && this.room.raceId === message.raceId && player.status === 'racing';
  }

  #combatUpdate(events, now) {
    if (!events.length) return;
    this.#persist();
    for (const socket of this.ctx.getWebSockets()) {
      const connection = this.#connection(socket);
      if (!connection?.joined) continue;
      send(socket, {
        type: 'combat', raceId: this.room.raceId, events,
        ...combatSnapshot(this.room.combat, connection.id, now),
      });
    }
  }

  #useItem(socket, connection, player, message, now) {
    const combat = this.room.combat;
    if (!combat || !this.#active(player, message) || now < this.room.startAt || now >= this.room.raceDeadline) return;
    const tick = connection.tick?.raceId === this.room.raceId ? connection.tick : null;
    const result = useRaceItem(combat, player.id, message.token, tick, raceCourse(this.room.courseId).track, now);
    if (result.error) send(socket, { type: 'item-error', raceId: this.room.raceId, message: result.error });
    if (result.event) this.#combatUpdate([result.event], now);
  }

  #tick(socket, connection, player, message, now) {
    if (!this.#active(player, message) || now < this.room.startAt || now >= this.room.raceDeadline) return;
    const { distance, offset, speed, lift, pitch } = message;
    if (![distance, offset, speed, lift, pitch].every(Number.isFinite) || distance < 4 || speed < 0 || speed > MAX_SPEED) return;
    if (Math.abs(lift) > 15 || Math.abs(pitch) > 1.6) return;
    const previous = connection.tick?.raceId === this.room.raceId ? connection.tick : null;
    if (previous && now - previous.at < TICK_SPACING_MS) return;
    const course = COURSE_BY_ID.get(this.room.courseId);
    const elapsed = (now - this.room.startAt) / 1000;
    const previousDistance = previous?.distance ?? 4;
    const sincePrevious = (now - (previous?.at ?? this.room.startAt)) / 1000;
    if (
      distance < previousDistance || Math.abs(offset) > course.width / 2 + 1 ||
      distance > this.room.finishLine + 2 || distance > 4 + MAX_SPEED * elapsed + 8 ||
      distance > previousDistance + MAX_SPEED * sincePrevious + 10
    ) return;

    const combat = this.room.combat;
    if (combat) {
      const { track, boxes } = raceCourse(this.room.courseId);
      const airborne = message.airborne === true && lift >= -.05 && track.sections.some(section =>
        section.kind === 'jump' && distance >= section.launch && distance < section.end + 12);
      connection.tick = { raceId: this.room.raceId, distance, offset, speed, airborne, at: now };
      this.#combatUpdate(advanceCombat(combat, player.id, previous, connection.tick, boxes), now);
    } else {
      connection.tick = { raceId: this.room.raceId, distance, at: now };
    }
    this.#keepConnection(socket, connection);
    this.#broadcast({
      type: 'tick', id: player.id, raceId: this.room.raceId,
      distance, offset, speed, lift, pitch, boost: message.boost === true,
    }, socket);
  }

  #completeRound() {
    if (this.room.phase === 'race' && this.room.players.every(player => player.status !== 'racing')) {
      this.room.phase = 'results';
      delete this.room.combat;
    }
  }

  async #finish(socket, connection, player, message, now) {
    if (!this.#active(player, message)) return;
    if (now >= this.room.raceDeadline) {
      await this.#timeout(now);
      return;
    }
    const tick = connection.tick;
    const duration = (now - this.room.startAt) / 1000;
    if (
      tick?.raceId !== this.room.raceId || tick.distance < this.room.finishLine - FINISH_TOLERANCE ||
      duration < (this.room.finishLine - 4 - FINISH_TOLERANCE) / MAX_SPEED
    ) {
      fail(socket, 'El servidor aún no recibió el paso por meta. Vuelve a intentarlo.');
      return;
    }
    player.status = 'finished';
    player.time = duration;
    this.#completeRound();
    await this.#publish(now);
  }

  async #timeout(now) {
    for (const player of this.room.players) {
      if (player.status === 'racing') player.status = 'dnf';
    }
    this.#completeRound();
    await this.#publish(now);
  }

  async #roomAction(socket, player, message, now) {
    const host = player.id === this.room.hostId;
    const lobby = this.room.phase === 'lobby';
    switch (message.type) {
      case 'ready': {
        if (!lobby || host || typeof message.ready !== 'boolean' || message.ready === player.ready) return;
        player.ready = message.ready;
        break;
      }
      case 'settings': {
        if (!host || !lobby) return;
        if (message.itemsEnabled !== undefined && typeof message.itemsEnabled !== 'boolean') return;
        const courseId = message.courseId ?? this.room.courseId;
        const assistId = message.assistId ?? this.room.assistId;
        const itemsEnabled = this.room.trackRules === TRACK_RULES_VERSION && (message.itemsEnabled ?? this.room.itemsEnabled) === true;
        if (!COURSE_BY_ID.has(courseId) || !ASSIST_IDS.has(assistId)) return;
        if (courseId === this.room.courseId && assistId === this.room.assistId && itemsEnabled === (this.room.itemsEnabled === true)) return;
        this.room.courseId = courseId;
        this.room.assistId = assistId;
        this.room.itemsEnabled = itemsEnabled;
        for (const entry of this.room.players) entry.ready = entry.id === this.room.hostId;
        break;
      }
      case 'start':
        if (!host || !lobby) return;
        if (this.room.players.length < 2 || this.room.players.some(entry => !entry.ready)) {
          fail(socket, 'Se necesitan al menos dos jugadores y todos deben estar listos.');
          return;
        }
        this.room.phase = 'race';
        this.room.raceId = crypto.randomUUID();
        this.room.startAt = now + START_DELAY_MS;
        this.room.raceDeadline = this.room.startAt + RACE_LIMIT_MS;
        this.room.finishLine = raceCourse(this.room.courseId).track.length + 2;
        if (this.room.itemsEnabled) this.room.combat = createCombat(this.room.players);
        for (const entry of this.room.players) entry.status = 'racing';
        // Do not keep a seat for a guest whose identification wasn't completed.
        for (const pending of this.ctx.getWebSockets()) {
          if (!this.#connection(pending)?.joined) fail(pending, 'La carrera ya empezó.', true);
        }
        break;
      case 'dnf':
        if (!this.#active(player, message)) return;
        player.status = 'dnf';
        this.#completeRound();
        break;
      case 'rematch':
        if (!host || this.room.phase !== 'results') return;
        this.room.phase = 'lobby';
        this.room.raceId = null;
        this.room.startAt = null;
        delete this.room.raceDeadline;
        delete this.room.finishLine;
        this.room.players = this.room.players.filter(entry => entry.connected);
        for (const entry of this.room.players) {
          entry.status = 'waiting';
          entry.ready = entry.id === this.room.hostId;
          entry.time = null;
        }
        break;
      default:
        return;
    }
    await this.#publish(now);
  }

  async webSocketMessage(socket, raw) {
    const connection = this.#connection(socket);
    if (!connection) return;
    if (typeof raw !== 'string' || raw.length > MAX_FRAME_BYTES || textEncoder.encode(raw).byteLength > MAX_FRAME_BYTES) {
      fail(socket, 'Mensaje inválido o demasiado grande.', true);
      return;
    }
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (!message || typeof message !== 'object' || Array.isArray(message)) return;
    const now = Date.now();
    if (this.room && now >= this.room.expiresAt) {
      this.#clear();
      await this.#schedule();
      return;
    }
    if (!connection.joined) {
      await this.#hello(socket, connection, message, now);
      return;
    }
    if (this.room && connection.trackRules !== (this.room.trackRules ?? CLASSIC_TRACK_RULES)) {
      fail(socket, 'Hay una actualización de pista. Recarga el juego para entrar.', true);
      return;
    }
    const player = this.room?.players.find(entry => entry.id === connection.id && entry.connected);
    if (!player) return;
    if (this.room.phase === 'race' && now >= this.room.raceDeadline) await this.#timeout(now);
    if (message.type === 'tick') {
      this.#tick(socket, connection, player, message, now);
    } else if (this.#rateLimit(connection, now)) {
      if (message.type === 'ping' && Number.isFinite(message.stamp)) {
        send(socket, { type: 'pong', stamp: message.stamp, serverNow: now });
      } else if (message.type === 'finish') {
        await this.#finish(socket, connection, player, message, now);
      } else if (message.type === 'use-item') {
        this.#useItem(socket, connection, player, message, now);
      } else {
        await this.#roomAction(socket, player, message, now);
      }
    }
  }

  async #disconnect(socket) {
    const connection = this.#connection(socket);
    if (!this.room || !connection) return;
    if (!connection.joined) {
      if (!this.room.hostId && this.room.creatorId === connection.id) this.#clear();
      await this.#schedule();
      return;
    }
    const player = this.room.players.find(entry => entry.id === connection.id && entry.connected);
    if (!player) return;
    player.connected = false;
    if (this.room.phase === 'lobby') {
      this.room.players = this.room.players.filter(entry => entry.connected);
    } else if (player.status === 'racing') {
      player.status = 'dnf';
    }
    const connected = this.room.players.filter(entry => entry.connected);
    if (!connected.length) {
      this.#clear();
      await this.#schedule();
      return;
    }
    if (this.room.hostId === player.id) {
      this.room.hostId = connected[0].id;
      if (this.room.phase === 'lobby') connected[0].ready = true;
    }
    this.#completeRound();
    await this.#publish();
  }

  async webSocketClose(socket) {
    await this.#disconnect(socket);
  }

  async webSocketError(socket) {
    close(socket, 1011, 'Conexión interrumpida');
    await this.#disconnect(socket);
  }

  async alarm() {
    const now = Date.now();
    if (!this.room) return;
    if (now >= this.room.expiresAt) {
      this.#clear();
      return;
    }
    for (const socket of this.ctx.getWebSockets()) {
      const connection = this.#connection(socket);
      if (connection && !connection.joined && now >= connection.helloBy) {
        fail(socket, 'Se agotó el tiempo para identificarte.', true);
      }
    }
    if (this.room.phase === 'race' && now >= this.room.raceDeadline) {
      await this.#timeout(now);
    } else {
      await this.#schedule();
    }
  }
}
