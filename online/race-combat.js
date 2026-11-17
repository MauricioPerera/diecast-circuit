import { DISC_SPEED, hazardDistance } from '../src/race-items.js';
import { surfaceAt } from '../src/track-surface.js';

const TICK_FRESHNESS = 520;
const RESPAWN_MS = 3200;
const SHIELD_MS = 5500;
const IMMUNITY_MS = 1800;

export function createCombat(players) {
  return {
    spent: {}, hazards: [], serial: 0,
    drivers: Object.fromEntries(players.map(({ id }) => [id, { held: null, row: -1, shieldUntil: 0, immuneUntil: 0 }])),
  };
}

// Intersect the time intervals in which both axes overlap. A fast disc or
// car can cross the entire hitbox between two accepted position packets.
function overlaps(from, to, distanceMargin, laneMargin) {
  let enter = 0, exit = 1;
  for (const [key, radius] of [['distance', distanceMargin], ['offset', laneMargin]]) {
    const start = from[key], change = to[key] - start;
    if (Math.abs(change) < 1e-8) {
      if (Math.abs(start) > radius) return false;
      continue;
    }
    const a = (-radius - start) / change, b = (radius - start) / change;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit;
}

function crossed(from, to, object, distanceMargin, laneMargin) {
  const start = Math.max(from.at, object.startAt ?? from.at);
  const end = Math.min(to.at, object.expiresAt ?? to.at);
  if (start > end) return false;
  const relative = time => {
    const mix = to.at === from.at ? 1 : (time - from.at) / (to.at - from.at);
    return {
      distance: from.distance + (to.distance - from.distance) * mix - hazardDistance(object, time),
      offset: from.offset + (to.offset - from.offset) * mix - object.offset,
    };
  };
  return overlaps(relative(start), relative(end), distanceMargin, laneMargin);
}

export function advanceCombat(combat, playerId, previous, tick, boxes, roll = Math.random) {
  const driver = combat.drivers[playerId];
  const now = tick.at;
  const events = [];
  const from = previous && now - previous.at <= TICK_FRESHNESS && !previous.airborne ? previous : tick;
  if (!tick.airborne && driver.immuneUntil <= now) {
    const index = combat.hazards.findIndex(hazard => hazard.owner !== playerId &&
      crossed(from, tick, hazard, hazard.kind === 'disc' ? 1.8 : 1.3, hazard.kind === 'disc' ? 1.06 : .89));
    if (index !== -1) {
      const [hazard] = combat.hazards.splice(index, 1);
      const blocked = driver.shieldUntil > now;
      driver.shieldUntil = 0;
      driver.immuneUntil = now + (blocked ? 600 : IMMUNITY_MS);
      events.push({ kind: blocked ? 'blocked' : 'hit', playerId, sourceId: hazard.owner, item: hazard.kind });
    }
  }
  if (!tick.airborne && !driver.held) {
    const box = boxes.find(box => box.row > driver.row && (combat.spent[box.id] ?? 0) <= now && crossed(from, tick, box, 1.4, .81));
    if (box) {
      const chance = roll();
      const kind = chance < .5 ? 'disc' : chance < .8 ? 'trap' : 'shield';
      combat.spent[box.id] = now + RESPAWN_MS;
      driver.row = box.row;
      driver.held = { kind, token: ++combat.serial };
      events.push({ kind: 'pickup', playerId, item: kind });
    }
  }
  // Keep the previous tick's window available for shots that expired during it.
  combat.hazards = combat.hazards.filter(hazard => now - hazard.expiresAt <= TICK_FRESHNESS);
  return events;
}

export function useRaceItem(combat, playerId, token, tick, track, now) {
  const driver = combat.drivers[playerId];
  if (!driver?.held || driver.held.token !== token || !tick || now - tick.at > TICK_FRESHNESS) return {};
  const kind = driver.held.kind;
  if (kind !== 'shield' && tick.airborne) return { error: 'Espera a aterrizar para usar este objeto.' };

  if (kind === 'shield') {
    driver.shieldUntil = now + SHIELD_MS;
  } else {
    const projected = tick.distance + tick.speed * Math.min(.13, (now - tick.at) / 1000);
    const distance = kind === 'disc' ? projected + 3.4 : Math.max(4, projected - 4.2);
    const deck = surfaceAt(track, distance);
    if (distance >= track.length - 2 || kind === 'trap' && (deck.gap || Math.abs(tick.offset - deck.center) > deck.half - .42)) {
      return { error: 'Aquí no hay espacio para soltar el objeto.' };
    }
    const lifespan = kind === 'disc' ? Math.min(1700, (track.length - distance) / DISC_SPEED * 1000) : 8500;
    combat.hazards.push({ id: token, kind, owner: playerId, distance, offset: tick.offset, startAt: now, expiresAt: now + lifespan });
  }
  driver.held = null;
  return { event: { kind: 'used', playerId, item: kind } };
}

export function combatSnapshot(combat, playerId, now) {
  return {
    held: combat.drivers[playerId]?.held ?? null,
    spent: combat.spent,
    hazards: combat.hazards.filter(hazard => hazard.expiresAt > now),
    shields: Object.fromEntries(Object.entries(combat.drivers).filter(([, driver]) => driver.shieldUntil > now)
      .map(([id, driver]) => [id, driver.shieldUntil])),
  };
}
