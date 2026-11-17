export function hazardControls({ distance, offset, lateral, speed, sections }) {
  const jump = sections.find(section => section.kind === 'jump' && distance >= section.start - 12 && distance < section.land);
  const curve = sections.find(section => section.kind === 'open' && distance >= section.start - 2 && distance < section.end);
  const projectedOffset = offset + lateral * .115;
  const steer = jump && distance >= jump.start && distance < jump.launch + 7
    ? jump.landingOffset - projectedOffset
    : curve ? .35 - projectedOffset : 0;
  return {
    steerLeft: steer > .12,
    steerRight: steer < -.12,
    nitro: Boolean(jump && distance < jump.launch && speed < jump.minimumSpeed + 1.5),
  };
}

// Drive the same keyboard that a player uses. The diagnostics supply only
// distance and lateral position, with no hooks that move the car.
export async function driveHazards(page, observe = () => {}) {
  const held = new Map([['KeyA', false], ['KeyD', false], ['ShiftRight', false]]);
  const deadline = Date.now() + 42000;
  try {
    while (Date.now() < deadline) {
      const state = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
      if (state && !['countdown', 'racing'].includes(state.mode)) return;
      if (state?.mode === 'racing') {
        const controls = hazardControls(state);
        for (const [key, active] of [['KeyA', controls.steerLeft], ['KeyD', controls.steerRight], ['ShiftRight', controls.nitro]]) {
          if (held.get(key) === active) continue;
          if (active) await page.keyboard.down(key);
          else await page.keyboard.up(key);
          held.set(key, active);
        }
        observe(state);
      }
      await page.waitForTimeout(35);
    }
    throw Error('The race did not end');
  } finally {
    for (const [key, active] of held) if (active) await page.keyboard.up(key);
  }
}
