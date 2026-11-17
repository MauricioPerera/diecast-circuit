import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, run, json } from './craft-cli.mjs';

mkdirSync(join(root, 'craft'), { recursive: true });
mkdirSync(join(root, 'public/assets'), { recursive: true });

// CAD X/Y are the front elevation; the playable arch uses Three.js X/Y in metres.
// Three closed rectangles define the left post, right post, and top beam in mm.
const rectangles = [
  [[-4500, 0], [-4100, 5000]],
  [[4100, 0], [4500, 5000]],
  [[-4100, 4600], [4100, 5000]],
  [[-3600, -1500], [3600, -600]],
];
const commands = rectangles.map(([p1, p2]) => `RECTANG ${p1.join(',')} ${p2.join(',')}`);
writeFileSync(join(root, 'craft/start-gantry.scr'), `${commands.join('\n')}\n`);
run('cadcraft', 'run', '--metric', '--script-file', 'craft/start-gantry.scr', '--save', 'craft/start-gantry.dxf');
const summary = json('cadcraft', 'info', 'craft/start-gantry.dxf');

// Read the produced DXF, rather than copying input dimensions to the browser.
// CADCraft writes LWPOLYLINE vertices with group codes 10 (X) and 20 (Y).
const tokens = readFileSync(join(root, 'craft/start-gantry.dxf'), 'utf8').split(/\r?\n/);
const entities = [];
let active = null;
for (let i = 0; i + 1 < tokens.length; i += 2) {
  const code = Number(tokens[i].trim());
  const value = tokens[i + 1].trim();
  if (code === 0) {
    if (active?.length) entities.push(active);
    active = value === 'LWPOLYLINE' ? [] : null;
  } else if (active && code === 10) active.push([Number(value) / 1000, 0]);
  else if (active && code === 20 && active.length) active[active.length - 1][1] = Number(value) / 1000;
}
if (active?.length) entities.push(active);
if (entities.length !== 4) throw new Error(`Expected four CAD profiles, got ${entities.length}`);
const bounds = entities.map(points => ({
  minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
  minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])),
}));
const [left, right, beam, stripe] = bounds;
const asset = {
  source: 'CADCraft 0.20.1 / craft/start-gantry.dxf', units: 'metres',
  trackWidth: stripe.maxX - stripe.minX,
  gantry: {
    openingWidth: right.minX - left.maxX, height: beam.minY,
    postWidth: left.maxX - left.minX, beamHeight: beam.maxY - beam.minY, depth: 0.48,
    profiles: entities.slice(0, 3),
  },
  finishStripe: { width: stripe.maxX - stripe.minX, depth: stripe.maxY - stripe.minY },
  verified: { entityCount: entities.length, drawing: summary },
};
writeFileSync(join(root, 'public/assets/cad-track.json'), JSON.stringify(asset, null, 2));
console.log(`CADCraft: ${asset.gantry.openingWidth}m opening, ${asset.gantry.height}m clearance; DXF parsed.`);
