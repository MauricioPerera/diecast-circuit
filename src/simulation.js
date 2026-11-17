import { jumpPose, sectionAt, surfaceAt } from './track-surface.js';

export const STEP = 1 / 120;
const OPEN_EDGE_MARGIN = .48;

export function createRun(track, assistId = 'balanced', vehicleStats = {}) {
  vehicleStats=vehicleStats&&typeof vehicleStats==='object'?vehicleStats:{};
  const vehicle={};
  for(const key of ['acceleration','topSpeed','boostPower','grip','braking','nitroEfficiency'])vehicle[key]=Number.isFinite(vehicleStats[key])?Math.min(1.2,Math.max(.8,vehicleStats[key])):1;
  return {
    track, assistId, vehicle, mode: 'countdown', countdown: 3, distance: 4, speed: 0,
    elapsed: 0, nitro: 1, offset: 0, lateral: 0, boost: false,
    railTime: 0, scrapeCooldown: 0, stallTime: 0, message: '', event: null,
    progress: 0, crashAge: 0, collisions: 0, loopsPassed: 0,
    flight: null,
  };
}

function crash(run, message) {
  run.mode = 'crashed';
  run.event = 'crash';
  run.message = message;
  run.boost = false;
}

function updateProgress(run) {
  run.progress = Math.min(1, (run.distance - 4) / (run.track.length - 2));
  if (!run.flight && run.distance >= run.track.length + 2) {
    run.mode = 'finished';
    run.event = 'finish';
    run.boost = false;
  }
}

function crossedOpenEdge(run, surface) {
  return Math.abs(run.offset - surface.center) > surface.half - OPEN_EDGE_MARGIN;
}

function stepFlight(run, steer, dt) {
  run.boost = false;
  run.nitro = Math.min(1, run.nitro + .055 * run.vehicle.nitroEfficiency * dt);
  run.lateral += (steer * 1.6 - run.lateral) * Math.min(1, dt * 3.8);
  run.offset += run.lateral * dt;
  run.distance += run.speed * dt;
  const { y } = jumpPose(run.flight, run.distance, run.speed);
  if (y <= run.track.sample(run.distance).p.y) {
    if (run.distance < run.flight.land) {
      crash(run, 'El salto quedó corto. Gana velocidad antes de la rampa.');
      return;
    }
    if (crossedOpenEdge(run, surfaceAt(run.track, run.distance))) {
      crash(run, 'Caíste fuera de la recepción. Alinea el coche antes de saltar.');
      return;
    }
    run.flight = null;
    run.event = 'land';
  }
  updateProgress(run);
}

export function stepRun(run, input, dt = STEP) {
  run.event = null;
  if (run.mode === 'countdown') {
    run.countdown -= dt;
    if (run.countdown <= 0) { run.mode = 'racing'; run.event = 'go'; }
    return;
  }
  if (run.mode !== 'racing') { run.boost = false; return; }
  const vehicle=run.vehicle;
  run.elapsed += dt;
  const steer = Number(Boolean(input.steerLeft)) - Number(Boolean(input.steerRight));
  if (run.flight) {
    stepFlight(run, steer, dt);
    return;
  }
  const frame = run.track.sample(run.distance);
  const section = sectionAt(run.track, run.distance);
  const surface = surfaceAt(run.track, run.distance, section);
  run.scrapeCooldown = Math.max(0, run.scrapeCooldown - dt);
  if (run.scrapeCooldown===0 && run.message==='ROCE CON EL BORDE') run.message='';
  const throttle = input.throttle ? 1 : 0;
  const brake = input.brake ? 1 : 0;
  const wasBoost = run.boost;
  run.boost = !!(input.nitro && throttle && run.nitro > (wasBoost ? .002 : .12) && !brake);
  if (run.boost && !wasBoost) run.event = 'boost';
  run.nitro = Math.max(0, Math.min(1, run.nitro + (run.boost ? -.20/vehicle.nitroEfficiency : .055*vehicle.nitroEfficiency) * dt));
  let acceleration = throttle * 17*vehicle.acceleration - brake * 29*vehicle.braking - 1.0 - run.speed * .11 - run.speed * run.speed * .009;
  acceleration -= 10.8 * (frame.forward.y + surface.grade);
  if (run.boost) acceleration += 25*vehicle.boostPower;
  if (run.assistId !== 'manual') {
    const lookahead = run.track.sample(run.distance + run.speed * .55 + 4);
    const curvature = Math.max(Math.abs(frame.curvature), Math.abs(lookahead.curvature));
    const safeSpeed = Math.min(34*vehicle.topSpeed, Math.sqrt(15*vehicle.grip / Math.max(curvature, .004)));
    if (run.speed > safeSpeed) acceleration -= Math.min(40, (run.speed - safeSpeed) * 6);
  }
  run.speed = Math.max(0, Math.min((run.boost ? 46 : 34)*vehicle.topSpeed, run.speed + acceleration * dt));
  const centrifugal = -frame.curvature * run.speed * run.speed * .058/vehicle.grip;
  const steering = steer * Math.min(4.5, run.speed * .15)*vehicle.grip;
  let desiredLateral = steering + centrifugal;
  if (run.assistId === 'full' && surface.rails) desiredLateral = steering * .55 - run.offset * 3.0 + centrifugal * .08;
  run.lateral += (desiredLateral - run.lateral) * Math.min(1, dt * 8);
  run.offset += run.lateral * dt;
  const edge = run.track.course.width / 2 - .92;
  if (!surface.rails) {
    run.railTime = 0;
    if (crossedOpenEdge(run, surface)) {
      crash(run, 'Saliste por el borde abierto. Frena y corrige la dirección.');
      return;
    }
  } else if (Math.abs(run.offset) > edge) {
    run.railTime += dt;
    if (run.scrapeCooldown === 0 && run.speed > 3) {
      run.speed *= .73; run.event = 'scrape'; run.collisions++;run.scrapeCooldown = .55;
      run.message = 'ROCE CON EL BORDE';
    }
    if (run.assistId === 'full') {
      run.offset = Math.sign(run.offset) * edge;
      run.lateral = -Math.sign(run.offset) * 1.2;
      run.railTime = 0;
    } else if (run.railTime > .62 || Math.abs(run.offset) > edge + .80) {
      crash(run, 'Te saliste de la pista. Corrige la dirección antes del borde.');
      return;
    }
  } else run.railTime = Math.max(0, run.railTime - dt * 2);
  if (frame.up.y < -.25 && run.speed < 6.5) {
    run.stallTime += dt;
    if (run.stallTime > .35) {crash(run, 'Sin impulso en el loop. Acelera y usa nitro antes de subir.');return;}
  } else run.stallTime=0;
  run.distance += run.speed * dt;
  if (section?.kind === 'jump' && run.distance >= section.launch && run.distance - run.speed * dt < section.launch) {
    run.flight = section;
    run.boost = false;
    run.event = 'jump';
  }
  updateProgress(run);
}
