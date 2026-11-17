import { BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createCar } from './car.js';

function opponentModel(vehicle) {
  const source = createCar(vehicle);
  source.root.updateMatrixWorld(true);
  const parts = [];
  source.root.children[0].traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(mesh.matrixWorld);
    const { r, g, b } = mesh.material.color;
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = r;
      colors[i + 1] = g;
      colors[i + 2] = b;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    parts.push(geometry);
  });
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  source.dispose();
  const material = new MeshStandardMaterial({ vertexColors: true, metalness: .35, roughness: .48 });
  const root = new Group();
  root.name = vehicle.name;
  root.add(new Mesh(geometry, material));
  return { root, dispose() { geometry.dispose(); material.dispose(); } };
}

export function createOnlineCars(scene) {
  const peers = new Map();

  function remove(id) {
    const peer = peers.get(id);
    if (!peer) return;
    scene.remove(peer.car.root);
    peer.car.dispose();
    peers.delete(id);
  }

  return {
    sync(players, selfId, track) {
      const active = players.filter(player => player.id !== selfId && player.status === 'racing');
      for (const id of peers.keys()) if (!active.some(player => player.id === id)) remove(id);
      for (const player of active) {
        if (peers.has(player.id)) continue;
        const car = opponentModel(player.vehicle);
        // Wait for the first position so opponents never spawn inside the local car.
        car.root.visible = false;
        scene.add(car.root);
        peers.set(player.id, { car, distance: 4, target: 4, offset: 0, targetOffset: 0, lift: 0, targetLift: 0, pitch: 0, targetPitch: 0, speed: 0, at: 0, track });
      }
    },
    ingest(message) {
      const peer = peers.get(message.id);
      if (!peer) return;
      if (!peer.at) { peer.distance = message.distance; peer.offset = message.offset; }
      peer.at = performance.now();
      peer.target = message.distance;
      peer.targetOffset = message.offset;
      peer.targetLift = message.lift;
      peer.targetPitch = message.pitch;
      peer.speed = message.speed;
      peer.car.root.visible = true;
    },
    update(dt, localDistance, localOffset, shields, serverNow) {
      const now = performance.now();
      for (const [id, peer] of peers) {
        if (!peer.at) continue;
        const prediction = Math.min((now - peer.at) / 1000, .2) * peer.speed;
        const blend = 1 - Math.exp(-dt * 14);
        peer.distance += (peer.target + prediction - peer.distance) * blend;
        peer.offset += (peer.targetOffset - peer.offset) * blend;
        peer.lift += (peer.targetLift - peer.lift) * blend;
        peer.pitch += (peer.targetPitch - peer.pitch) * blend;
        const frame = peer.track.sample(peer.distance);
        peer.car.root.position.copy(frame.p).addScaledVector(frame.right, peer.offset).addScaledVector(frame.up, .024);
        peer.car.root.position.y += peer.lift;
        peer.car.root.quaternion.copy(frame.q);
        peer.car.root.rotateX(-peer.pitch);
        if (shields?.[id] > serverNow) peer.car.root.children[0].material.emissive.setHex(0x215c65);
        else peer.car.root.children[0].material.emissive.setHex(0);
        // Coincident cars would obscure the driver's car and flicker.
        peer.car.root.visible = Math.abs(peer.distance - localDistance) > 3.7 || Math.abs(peer.offset - localOffset) > 2;
      }
    },
    racePosition(localDistance, players, selfId) {
      return 1 + players.filter(player => player.id !== selfId && (player.status === 'finished' || (player.status === 'racing' && (peers.get(player.id)?.target ?? 4) > localDistance))).length;
    },
    drawMap(ctx, xy) {
      ctx.fillStyle = '#ff9a47';
      for (const peer of peers.values()) {
        if (!peer.at) continue;
        ctx.beginPath();
        ctx.arc(...xy(peer.car.root.position), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    clear() { for (const id of peers.keys()) remove(id); },
    get visibleCount() { return [...peers.values()].filter(peer => peer.car.root.visible).length; },
    get maxVisibleLift() { return Math.max(0, ...[...peers.values()].filter(peer => peer.car.root.visible).map(peer => peer.lift)); },
  };
}
