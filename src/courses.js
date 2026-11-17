export const TRACK_RULES_VERSION = 2;

export const courses = [
  { id: 'garage', name: 'Garage Run', difficulty: 'FÁCIL', description: 'Una vuelta con curvas amplias, un loop y un primer salto hacia la derecha.', loops: 1, radius: 5.8, span: 21, straight: 76, width: 6.8, target: 31, color: '#f58220', theme: 'garage', jump: { gap: 8, side: 1, landingWidth: .54 } },
  { id: 'district', name: 'Loop District', difficulty: 'MEDIA', description: 'Conserva el impulso en los dos loops y busca la recepción a la izquierda.', loops: 2, radius: 7.1, span: 23, straight: 96, width: 6.3, target: 38, color: '#ff7d20', theme: 'district', jump: { gap: 10, side: -1, landingWidth: .51 } },
  { id: 'heights', name: 'Nitro Heights', difficulty: 'DIFÍCIL', description: 'Salta en plena subida y frena para tomar la curva sin barandas.', loops: 2, radius: 8.5, span: 20, straight: 111, width: 5.9, target: 44, color: '#f46a20', theme: 'heights', jump: { gap: 11, side: 1, landingWidth: .49 }, openCurve: 17 },
  { id: 'helix', name: 'Double Helix', difficulty: 'EXPERTA', description: 'Tres loops, una recepción estrecha a la izquierda y una curva con el borde abierto.', loops: 3, radius: 8.0, span: 18, straight: 126, width: 5.4, target: 49, color: '#ed6020', theme: 'helix', jump: { gap: 12, side: -1, landingWidth: .47 }, openCurve: 23 },
  { id: 'skyline', name: 'Skyline Gauntlet', difficulty: 'EXTREMA', description: 'Loops gigantes, el salto más largo y una curva sin protección.', loops: 3, radius: 10.0, span: 17, straight: 148, width: 4.9, target: 58, color: '#ee5420', theme: 'skyline', jump: { gap: 14, side: 1, landingWidth: .46 }, openCurve: 29 },
];

export const assists = [
  { id: 'full', name: 'Completa', description: 'Dirección + freno' },
  { id: 'balanced', name: 'Equilibrada', description: 'Freno automático' },
  { id: 'manual', name: 'Manual', description: 'Control total' },
];

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '— — : — — . — — —';
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
