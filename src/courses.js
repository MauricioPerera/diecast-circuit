export const courses = [
  { id: 'garage', name: 'Garage Run', difficulty: 'FÁCIL', description: 'Tu primera vuelta. Curvas amplias y un loop para sentir la velocidad.', loops: 1, radius: 5.8, span: 21, straight: 76, width: 6.8, target: 31, color: '#f58220', theme: 'garage' },
  { id: 'district', name: 'Loop District', difficulty: 'MEDIA', description: 'Dos loops consecutivos. Carga el nitro y conserva el impulso.', loops: 2, radius: 7.1, span: 23, straight: 96, width: 6.3, target: 38, color: '#ff7d20', theme: 'district' },
  { id: 'heights', name: 'Nitro Heights', difficulty: 'DIFÍCIL', description: 'Cambios de altura y curvas rápidas. Elige dónde acelerar.', loops: 2, radius: 8.5, span: 20, straight: 111, width: 5.9, target: 44, color: '#f46a20', theme: 'heights' },
  { id: 'helix', name: 'Double Helix', difficulty: 'EXPERTA', description: 'Tres inversiones, poco margen. Frena antes de las curvas.', loops: 3, radius: 8.0, span: 18, straight: 126, width: 5.4, target: 49, color: '#ed6020', theme: 'helix' },
  { id: 'skyline', name: 'Skyline Gauntlet', difficulty: 'EXTREMA', description: 'Loops gigantes y una pista estrecha. Una vuelta para demostrarlo.', loops: 3, radius: 10.0, span: 17, straight: 148, width: 4.9, target: 58, color: '#ee5420', theme: 'skyline' },
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
