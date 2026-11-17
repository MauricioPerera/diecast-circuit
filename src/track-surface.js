const GRAVITY = 44;
const RAMP_LENGTH = 14;
const RAMP_GRADE = .25;
const RAMP_RISE = RAMP_LENGTH * RAMP_GRADE / 2;
const LANDING_LENGTH = 11;
const MERGE_LENGTH = 10;

export function openSection(start, end) {
  return { start, end, kind: 'open' };
}

export function jumpSection(track, start, gap, side, landingWidth, end = start + jumpLength(gap)) {
  const launch = start + RAMP_LENGTH;
  const land = launch + gap;
  const merge = end - MERGE_LENGTH;
  const launchFrame = track.sample(launch);
  const launchY = launchFrame.p.y + RAMP_RISE;
  const launchSlope = launchFrame.forward.y + RAMP_GRADE;
  const drop = launchY + launchSlope * gap - track.sample(land).p.y;
  return {
    kind: 'jump', start, launch, land, merge, end,
    launchY, launchSlope, side, landingWidth,
    // In a rear view of a +Z-facing car, screen right is local -X.
    landingOffset: -side * track.course.width * (1 - landingWidth) / 2,
    minimumSpeed: gap * Math.sqrt(GRAVITY / (2 * drop)),
  };
}

export const jumpLength = gap => RAMP_LENGTH + gap + LANDING_LENGTH + MERGE_LENGTH;

export function sectionAt(track, distance) {
  return track.sections?.find(section => distance >= section.start && distance < section.end);
}

export function surfaceAt(track, distance, section = sectionAt(track, distance)) {
  const half = track.course.width / 2;
  if (section?.kind !== 'jump') return { half, center: 0, rise: 0, grade: 0, rails: !section, gap: false };
  if (distance <= section.launch) {
    const u = Math.max(0, (distance - section.start) / RAMP_LENGTH);
    return { half, center: 0, rise: RAMP_RISE * u * u, grade: RAMP_GRADE * u, rails: false, gap: false };
  }
  const narrow = Math.min(1, (section.end - distance) / MERGE_LENGTH);
  const center = section.landingOffset * narrow;
  return { half: half - Math.abs(center), center, rise: 0, grade: 0, rails: false, gap: distance < section.land };
}

// Treat distance through a straight jump as horizontal travel. Speed is
// fixed in flight, so a car traces the same arc at every render frame rate.
export function jumpPose(section, distance, speed) {
  const travel = Math.max(0, distance - section.launch);
  const time = travel / Math.max(1, speed);
  return {
    y: section.launchY + section.launchSlope * travel - GRAVITY * time * time / 2,
    slope: section.launchSlope - GRAVITY * time / Math.max(1, speed),
  };
}

export function surfacePose(track, frame, distance, speed, flight) {
  if (flight) {
    const pose = jumpPose(flight, distance, speed);
    return { lift: pose.y - frame.p.y, pitch: Math.atan(pose.slope) - Math.asin(frame.forward.y) };
  }
  const { rise, grade } = surfaceAt(track, distance);
  return { lift: rise, pitch: Math.atan(grade) };
}
