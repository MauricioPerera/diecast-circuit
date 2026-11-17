import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ITEM_TYPES, hazardDistance, itemBoxes } from './race-items.js';
import { surfaceAt } from './track-surface.js';

function crateFace() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#08434b';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#65d6d9';
  ctx.lineWidth = 5;
  ctx.strokeRect(12, 12, 104, 104);
  ctx.fillStyle = '#d9ffff';
  ctx.font = 'bold 78px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 68);
  for (const x of [22, 106]) for (const y of [22, 106]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export function createItemVisuals(scene) {
  const group = new T.Group();
  group.visible = false;
  scene.add(group);
  const transform = new T.Object3D();
  const face = crateFace();
  const crates = new T.InstancedMesh(new RoundedBoxGeometry(1.08, 1.08, 1.08, 2, .12),
    new T.MeshStandardMaterial({ map: face, emissiveMap: face, emissive: 0x8dffff, emissiveIntensity: .67, metalness: .28, roughness: .35 }), 12);
  const aura = new T.InstancedMesh(new T.TorusGeometry(.78, .044, 6, 18).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: 0x62e4ea }), 12);
  const hazards = {};
  for (const kind of ['disc', 'trap']) {
    const disc = kind === 'disc';
    const color = ITEM_TYPES[kind].color;
    const base = new T.InstancedMesh(new T.CylinderGeometry(disc ? .59 : .68, .69, disc ? .20 : .28, disc ? 16 : 6),
      new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .24, metalness: .54, roughness: .3 }), 32);
    const ring = new T.InstancedMesh(new T.TorusGeometry(disc ? .66 : .52, .065, 8, 20).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({ color }), 32);
    hazards[kind] = { base, ring };
    group.add(base, ring);
  }
  const shield = new T.Mesh(new T.SphereGeometry(1, 24, 12), new T.MeshBasicMaterial({
    color: ITEM_TYPES.shield.color, transparent: true, opacity: .28, depthWrite: false, wireframe: true,
  }));
  shield.scale.set(1.5, 1.2, 2.5);
  group.add(crates, aura, shield);
  // Instances are compacted as items spawn and disappear, so the bounding
  // sphere of the first visible subset cannot be used for later frames.
  for (const object of group.children) if (object.isInstancedMesh) object.frustumCulled = false;
  let track;
  let boxes = [];

  function pose(distance, offset, height) {
    const frame = track.sample(distance);
    transform.position.copy(frame.p).addScaledVector(frame.right, offset).addScaledVector(frame.up, height);
    transform.position.y += surfaceAt(track, distance).rise;
    transform.quaternion.copy(frame.q);
  }

  function write(mesh, index) {
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  }

  function flush(mesh, count) {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    start(next) { track = next; boxes = itemBoxes(next); },
    clear() { group.visible = false; track = undefined; boxes = []; },
    update(combat, now, car, selfId) {
      group.visible = Boolean(combat && track);
      if (!group.visible) return;
      let count = 0;
      for (const box of boxes) {
        if (combat.spent[box.id] > now) continue;
        pose(box.distance, box.offset, .048);
        write(aura, count);
        transform.translateY(.992 + Math.sin(now * .004 + box.id) * .13);
        transform.rotateY(now * .0014 + box.id);
        write(crates, count++);
      }
      flush(crates, count);
      flush(aura, count);
      for (const [kind, { base, ring }] of Object.entries(hazards)) {
        let count = 0;
        for (const hazard of combat.hazards) {
          if (hazard.kind !== kind || hazard.expiresAt <= now) continue;
          pose(hazardDistance(hazard, now), hazard.offset, kind === 'disc' ? .69 : .17);
          transform.rotateY(now * (kind === 'disc' ? .014 : .003));
          write(base, count);
          transform.translateY(.12);
          write(ring, count++);
        }
        flush(base, count);
        flush(ring, count);
      }
      shield.visible = combat.shields[selfId] > now;
      shield.position.copy(car.position);
      shield.position.y += .57;
      shield.quaternion.copy(car.quaternion);
    },
    get visibleBoxes() { return group.visible ? crates.count : 0; },
    get visibleHazards() { return group.visible ? hazards.disc.base.count + hazards.trap.base.count : 0; },
  };
}
