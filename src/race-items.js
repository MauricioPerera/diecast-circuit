export const ITEM_TYPES = {
  disc: { name: 'Disco', hint: 'Dispara hacia delante por tu carril', color: 0xff744b },
  trap: { name: 'Trampa', hint: 'Déjala detrás de tu coche', color: 0xc292ff },
  shield: { name: 'Escudo', hint: 'Bloquea un impacto', color: 0x76edf5 },
};

export const DISC_SPEED = 63;

export function itemBoxes(track) {
  const lane = track.course.width * .29;
  return (track.itemRows ?? []).flatMap((distance, row) =>
    [-lane, 0, lane].map((offset, column) => ({ id: row * 3 + column, row, distance, offset })));
}

export function hazardDistance(hazard, now) {
  return hazard.distance + (hazard.kind === 'disc' ? Math.max(0, now - hazard.startAt) * DISC_SPEED / 1000 : 0);
}
