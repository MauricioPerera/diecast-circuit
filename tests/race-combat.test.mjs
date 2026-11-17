import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, advanceCombat, combatSnapshot, useRaceItem } from '../online/race-combat.js';
import { courses } from '../src/courses.js';
import { hazardDistance, itemBoxes } from '../src/race-items.js';
import { createRun, stepRun } from '../src/simulation.js';
import { createTrackData } from '../src/track.js';
import { surfaceAt } from '../src/track-surface.js';

const track = createTrackData(courses[0]);
const boxes = itemBoxes(track);
const combatForTwo = () => createCombat([{ id: 'first' }, { id: 'second' }]);
const tick = (distance, offset, at, airborne = false) => ({ distance, offset, at, speed: 20, airborne });
const collect = (combat, player, box, at, roll) => advanceCombat(combat, player, null, tick(box.distance, box.offset, at), boxes, () => roll);

test('All five courses place boxes on a drivable deck, and full assistance can reach the side lanes', () => {
  for (const course of courses) {
    const layout = createTrackData(course);
    assert.equal(itemBoxes(layout).length, 12);
    for (const box of itemBoxes(layout)) {
      assert.ok(surfaceAt(layout, box.distance).rails);
      assert.ok(layout.sample(box.distance).up.y > .85);
    }
  }
  const run = createRun(track, 'full');
  run.mode = 'racing';
  while (run.distance < 19) stepRun(run, { throttle: true, steerLeft: run.distance > 8 });
  assert.ok(Math.abs(run.offset - boxes[2].offset) < .81);
});

test('Only one driver claims a box at a time, and each holds one object with a single-use token', () => {
  const combat = combatForTwo();
  const middle = boxes[1];
  const firstTick = tick(22, 0, 1130);
  const pickup = advanceCombat(combat, 'first', tick(16, 0, 1000), firstTick, boxes, () => .2);
  assert.equal(pickup[0].item, 'disc');
  assert.equal(collect(combat, 'second', middle, 1250, .6).length, 0);
  assert.equal(collect(combat, 'first', boxes[4], 5000, .6).length, 0);
  const held = combatSnapshot(combat, 'first', 1130).held;
  assert.equal(combatSnapshot(combat, 'second', 1130).held, null);
  assert.equal(useRaceItem(combat, 'first', held.token + 1, firstTick, track, 1170).event, undefined);
  assert.equal(useRaceItem(combat, 'first', held.token, firstTick, track, 1170).event.item, 'disc');
  assert.equal(useRaceItem(combat, 'first', held.token, firstTick, track, 1190).event, undefined);
  assert.equal(collect(combat, 'second', middle, 4450, .6)[0].item, 'trap');
  assert.equal(collect(combat, 'first', boxes[2], 5000, .2).length, 0, 'cannot collect another box from the same row');
});

test('A disc hits a rival across a missed tick, and the shield is consumed by that hit', () => {
  const combat = combatForTwo();
  collect(combat, 'first', boxes[1], 1050, .1);
  collect(combat, 'second', boxes[2], 1000, .99);
  const defender = combat.drivers.second.held;
  assert.equal(useRaceItem(combat, 'second', defender.token, tick(34, 0, 1210), track, 1210).event.item, 'shield');
  const attacker = combat.drivers.first.held;
  useRaceItem(combat, 'first', attacker.token, tick(22, 0, 1230), track, 1230);
  const disc = combat.hazards[0];
  assert.ok(hazardDistance(disc, 1620) > 48);
  assert.deepEqual(advanceCombat(combat, 'second', tick(35, 0, 1235), tick(42, 0, 1620), boxes),
    [{ kind: 'blocked', playerId: 'second', sourceId: 'first', item: 'disc' }]);
  assert.equal(combat.drivers.second.shieldUntil, 0);
  assert.equal(combat.hazards.length, 0);
});

test('A trap can be dodged by changing lanes or being airborne, and is removed when it hits', () => {
  const combat = combatForTwo();
  collect(combat, 'first', boxes[1], 1000, .7);
  const token = combat.drivers.first.held.token;
  assert.match(useRaceItem(combat, 'first', token, tick(45, 0, 1200, true), track, 1200).error, /aterrizar/);
  assert.equal(useRaceItem(combat, 'first', token, tick(45, 0, 1200), track, 1850).event, undefined);
  useRaceItem(combat, 'first', token, tick(45, 0, 1200), track, 1200);
  assert.equal(advanceCombat(combat, 'second', tick(37, 1.8, 1200), tick(42, 1.8, 1450), boxes).length, 0);
  assert.equal(advanceCombat(combat, 'second', tick(37, 0, 1200, true), tick(42, 0, 1450, true), boxes).length, 0);
  assert.equal(advanceCombat(combat, 'first', tick(41, 0, 1200), tick(44, 0, 1410), boxes).length, 0);
  assert.equal(advanceCombat(combat, 'second', tick(37, 0, 1200), tick(42, 0, 1450), boxes)[0].kind, 'hit');
  assert.equal(combat.hazards.length, 0);
});

test('An impact slows the car, disables nitro briefly, and preserves the jump trajectory if a hit arrives in flight', () => {
  const run = createRun(track, 'full');
  run.mode = 'racing';
  run.speed = 25;
  run.impactPending = true;
  stepRun(run, { throttle: true, nitro: true });
  assert.ok(run.speed < 15);
  assert.ok(run.stun > .7);
  assert.equal(run.boost, false);
  const jump = track.sections[0];
  run.flight = jump;
  run.distance = jump.launch + .6;
  run.speed = 28;
  run.impactPending = true;
  stepRun(run, { throttle: true });
  assert.equal(run.speed, 28);
  assert.equal(run.impactPending, true);
});
