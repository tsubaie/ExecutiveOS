// The only place chart geometry reads a colour. Everything here resolves a theme token at paint
// time, so a chart follows the theme switch without re-rendering and no literal ever reaches a
// component (docs/05 § No raw colors in TSX).
export const chartColor = {
  series: 'var(--accent)',
  reference: 'var(--muted-text)',
  grid: 'var(--border)',
  surface: 'var(--surface)',
  on_target: 'var(--success)',
  near_target: 'var(--warning)',
  off_target: 'var(--danger)',
  neutral: 'var(--muted-text)',
};
// Marks are thin and the grid is a solid hairline one step off the surface (dataviz § Mark specs).
export const chartMark = { line: 2, hairline: 1, dot: 4, ring: 2 };
