import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root, run } from './craft-cli.mjs';

mkdirSync(join(root, 'craft'), { recursive: true });
mkdirSync(join(root, 'public/assets'), { recursive: true });
// Authored deterministic micrograin. MaterialCraft rasterizes and cooks this vector
// resource, remaps its range, and produces the engine-ready roughness and normal maps.
let seed = 93471;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const circles = Array.from({ length: 1600 }, () => {
  const gray = Math.round(90 + random() * 100);
  return `<circle cx="${(random() * 256).toFixed(2)}" cy="${(random() * 256).toFixed(2)}" r="${(0.15 + random() * 0.4).toFixed(2)}" fill="rgb(${gray},${gray},${gray})"/>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#888888"/>${circles.join('')}</svg>`;
writeFileSync(join(root, 'craft/plastic-grain.svg'), svg);
run('materialcraft', 'new', 'empty', 'craft/track-empty.sbs', '--size', '256', '--name', 'Injection moulded orange track');
const steps = [
  { id: 'file.importVector', params: { path: 'craft/plastic-grain.svg', name: 'plastic-grain' } },
  { id: 'graph.node.add', params: { def: 'uniform', label: 'Injection-moulded orange', params: { color: '#ed6718' } } },
  { id: 'graph.node.add', params: { def: 'output', at: [400, 0], params: { identifier: 'base', usage: 0 }, connectFrom: { node: 1 } } },
  { id: 'graph.node.add', params: { def: 'svg', at: [0, 220], label: 'Mould micrograin', params: { resource: 'plastic-grain', color_mode: false } } },
  { id: 'graph.node.add', params: { def: 'levels', at: [200, 220], label: 'Subtle satin roughness', params: { out_low: [0.3, 0.3, 0.3, 0.3], out_high: [0.48, 0.48, 0.48, 1] }, connectFrom: { node: 3 } } },
  { id: 'graph.node.add', params: { def: 'output', at: [400, 220], params: { identifier: 'roughness', usage: 2 }, connectFrom: { node: 4 } } },
  { id: 'graph.node.add', params: { def: 'normal', at: [200, 400], params: { intensity: 0.04 }, connectFrom: { node: 3 } } },
  { id: 'graph.node.add', params: { def: 'output', at: [400, 400], params: { identifier: 'normal', usage: 1 }, connectFrom: { node: 6 } } },
];
writeFileSync(join(root, 'craft/track-material.batch.json'), JSON.stringify({ open: 'craft/track-empty.sbs', steps, save: 'craft/track-plastic.sbs' }, null, 2));
console.log(run('materialcraft', 'batch', 'craft/track-material.batch.json'));
console.log(run('materialcraft', 'export', 'craft/track-plastic.sbs', 'public/assets', '--format', 'png', '--depth', '8', '--pattern', 'track-$(identifier)'));
