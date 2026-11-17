import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Scene, Mesh, PlaneGeometry, MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { root, run, json } from './craft-cli.mjs';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; this.onloadend(); }); }
};
mkdirSync(join(root, 'craft'), { recursive: true });
mkdirSync(join(root, 'public/assets'), { recursive: true });
const scene = new Scene();
const geometry = new PlaneGeometry(1.34, 1.05);
geometry.rotateX(-Math.PI / 2);
const hood = new Mesh(geometry, new MeshStandardMaterial({ color: 0xffffff }));
hood.name = 'Number 02 die-cast hood livery';
scene.add(hood);
const bytes = await new GLTFExporter().parseAsync(scene, { binary: true });
writeFileSync(join(root, 'craft/racing-hood-mesh.glb'), Buffer.from(bytes));
const project = 'craft/racing-hood.tcraft';
run('texturecraft', 'new', 'craft/racing-hood-mesh.glb', project, '--resolution', '512');
const step = (id, params) => json('texturecraft', 'run', project, id, JSON.stringify(params), '-o', project);
step('layer.add.fill', { name: 'Petrol blue metallic enamel', color: '#12718a', roughness: 0.26, metallic: 0.82 });
const lettering = step('resource.text', { name: 'Race number', text: '02', size: 320, style: 'Bold', color: '#fff3da' });
step('layer.add.decal', {
  image: lettering.name, name: 'Printed race number 02',
  position: [0, 0, 0], normal: [0, 1, 0], up: [0, 0, -1], size: [0.76, 0.6], depth: 0.04,
});
console.log(step('file.exportMesh', { path: 'public/assets/racing-hood.glb', format: 'glb' }));
console.log(run('texturecraft', 'info', project));
