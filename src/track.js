import * as T from 'three';

export function createTrackData(course) {
  const points = [];
  let x = -course.span, z = -course.straight / 2;
  const floor = 3.4;
  const add = (px, py, pz) => points.push(new T.Vector3(px, py, pz));
  const straight = (length, direction = 1, hill = 0) => {
    const n = Math.ceil(length / 0.8);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      add(x, floor + hill * Math.sin(Math.PI * u) ** 2, z + length * u * direction);
    }
    z += length * direction;
  };
  straight(28);
  for (let loop = 0; loop < course.loops; loop++) {
    const radius = course.radius * (1 + loop * .06);
    const advance = 7.5;
    for (let i = 0; i < 200; i++) {
      const a = i / 200 * Math.PI * 2;
      add(x, floor + radius * (1 - Math.cos(a)), z + radius * Math.sin(a) + advance * a / (Math.PI * 2));
    }
    z += advance;
    straight(13);
  }
  straight(course.straight - 28 - course.loops * 20.5);
  for (let i = 0; i < 150; i++) {
    const a = i / 150 * Math.PI;
    add(x + course.span * (1 - Math.cos(a)), floor, z + course.span * Math.sin(a));
  }
  x += course.span * 2;
  straight(course.straight, -1, course.theme === 'heights' ? 10 : course.theme === 'skyline' ? 13 : 3);
  for (let i = 0; i < 150; i++) {
    const a = i / 150 * Math.PI;
    add(x - course.span * (1 - Math.cos(a)), floor, z - course.span * Math.sin(a));
  }
  return createTrackFromPoints(points, course);
}

// Shared path contract for authored courses and the workshop. Open paths are
// previewed as open paths; only validated closed paths are raced.
export function createTrackFromPoints(input, course, { closed = true } = {}) {
  const points=[];
  for(const value of input) {
    const p=value.isVector3?value.clone():new T.Vector3(...value);
    if(!p.toArray().every(Number.isFinite))throw Error('La pista contiene coordenadas inválidas.');
    if(!points.length||p.distanceToSquared(points.at(-1))>1e-10)points.push(p);
  }
  if(closed&&points.length>2&&points[0].distanceToSquared(points.at(-1))<1e-8)points.pop();
  if(points.length<2)throw Error('Añade una pieza para empezar.');
  const curve = new T.CatmullRomCurve3(points, closed, 'centripetal');
  curve.arcLengthDivisions = 8000;
  const length = curve.getLength();
  const n = Math.ceil(length / .32);
  const frames = [];
  let right = new T.Vector3(1, 0, 0);
  let previous = new T.Vector3(0, 0, 1);
  const rotation = new T.Quaternion();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u=t===1&&closed?0:t;
    const p = curve.getPointAt(u);
    const forward = curve.getTangentAt(u).normalize();
    rotation.setFromUnitVectors(previous, forward);
    right.applyQuaternion(rotation).normalize();
    const up = new T.Vector3().crossVectors(forward, right).normalize();
    right.crossVectors(up, forward).normalize();
    const basis = new T.Matrix4().makeBasis(right, up, forward);
    frames.push({ p, forward, right: right.clone(), up, q: new T.Quaternion().setFromRotationMatrix(basis), curvature: 0 });
    previous = forward;
  }
  for (let i = 0; i < n; i++) {
    const a = frames[closed?(i-2+n)%n:Math.max(0,i-2)], b = frames[closed?(i+2)%n:Math.min(n,i+2)];
    frames[i].curvature = b.forward.clone().sub(a.forward).dot(frames[i].right) / (length / n * 4);
  }
  frames[n].curvature = frames[0].curvature;
  return {
    course, curve, frames, length, closed,
    sample(distance) {
      const d=closed?((distance%length+length)%length):T.MathUtils.clamp(distance,0,length);
      const f = d / length * n;
      const i = Math.min(n-1,Math.floor(f)), a = frames[i], b = frames[i + 1], mix = f - i;
      return {
        p: a.p.clone().lerp(b.p, mix), q: a.q.clone().slerp(b.q, mix),
        forward: a.forward.clone().lerp(b.forward, mix).normalize(),
        up: a.up.clone().lerp(b.up, mix).normalize(),
        right: a.right.clone().lerp(b.right, mix).normalize(),
        curvature: T.MathUtils.lerp(a.curvature, b.curvature, mix),
      };
    },
  };
}

function ribbon(data, left, right, height, material) {
  const vertices = [], indices = [], uv = [];
  data.frames.forEach((f, i) => {
    for (const side of [left, right]) {
      const p = f.p.clone().addScaledVector(f.right, side).addScaledVector(f.up, height);
      vertices.push(p.x, p.y, p.z);
      uv.push(side, i * data.length / (data.frames.length - 1) / 9);
    }
    if (i) {
      const k = i * 2;
      indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildTrack(data, materials) {
  const group = new T.Group();
  const half = data.course.width / 2;
  group.add(ribbon(data, -half, half, 0, materials.road));
  for (const side of [-1, 1]) {
    group.add(ribbon(data, side * (half - .12), side * half, .2, materials.rail));
    const points = data.frames.filter((_, i) => i % 3 === 0).map(f => f.p.clone().addScaledVector(f.right, side * half).addScaledVector(f.up, .29));
    if(data.closed!==false)points.push(points[0]);
    group.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points,false,'centripetal'), Math.max(4,Math.ceil(data.length * 1.4)), .12, 5, data.closed!==false), materials.rail));
    group.add(ribbon(data, side * (half - .36), side * (half - .25), .022, materials.lane));
  }
  group.add(ribbon(data, -.035, .035, .018, materials.center));
  const count = Math.floor(data.length / 9);
  const beams = new T.InstancedMesh(new T.BoxGeometry(.32, 1, .32), materials.support, count * 2);
  const feet = new T.InstancedMesh(new T.BoxGeometry(1.5, .18, 1.1), materials.support, count * 2);
  const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
  let index = 0;
  for (let i = 0; i < count; i++) {
    const f = data.sample(i * data.length / count);
    if (f.up.y < .7 || f.p.y < floorHeight()) continue;
    for (const side of [-1, 1]) {
      p.copy(f.p).addScaledVector(f.right, side * (half - .4));
      const height = p.y - .15;
      s.set(1, height, 1);
      const base = p.clone();
      p.y = height / 2;
      beams.setMatrixAt(index, m.compose(p, q, s));
      base.y = .12;
      feet.setMatrixAt(index, m.compose(base, q, new T.Vector3(1, 1, 1)));
      index++;
    }
  }
  beams.count = feet.count = index;
  beams.castShadow = true;
  group.add(beams, feet);
  // Clearly marked braking zones before both hairpins.
  const markerGeo = new T.PlaneGeometry(data.course.width * .75, .28);
  const floorQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
  let mark = 0;
  const corners=[];
  for(let i=3;i<data.frames.length-3;i++) {
    if(Math.abs(data.frames[i].curvature)>.022 && Math.abs(data.frames[i-1].curvature)<=.022) corners.push(i/(data.frames.length-1)*data.length-9);
  }
  const markers = new T.InstancedMesh(markerGeo, materials.warning, Math.max(1,corners.length*7));
  for (const start of corners) {
    for (let i = 0; i < 7; i++) {
      const f = data.sample(start - i * 1.1);
      p.copy(f.p).addScaledVector(f.up, .035);
      markers.setMatrixAt(mark++, m.compose(p, f.q.clone().multiply(floorQ), new T.Vector3(1,1,1)));
    }
  }
  markers.count=mark;
  group.add(markers);
  return group;
}

function floorHeight() { return 1; }
