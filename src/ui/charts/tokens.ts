// The only place chart geometry reads a colour. Everything here resolves a theme token at paint
// time, so a chart follows the theme switch without re-rendering and no literal ever reaches a
// component (docs/05 § No raw colors in TSX).
export const chartColor = {
  series: 'var(--accent)',
  reference: 'var(--muted-text)',
  grid: 'var(--border)',
  surface: 'var(--surface)',
};
// A tone, not a status: a chart stays a chart and the module keeps the vocabulary. The three
// carrying tones are the scorecard status scale (docs/05 § Charts); neutral is the text grey, for
// a mark that must not claim a state it does not have.
export type ChartTone = 'positive' | 'caution' | 'negative' | 'neutral';
export const toneColor: Record<ChartTone, string> = {
  positive: 'var(--status-good)',
  caution: 'var(--status-warn)',
  negative: 'var(--status-bad)',
  neutral: 'var(--muted-text)',
};
// Marks are thin and the chrome is recessive (dataviz § Mark specs). A column is capped well under
// its slot so the band's leftover reads as air, and rounds only at the end away from the baseline.
// `bar` is the column a full history draws; `barWide` is what a short one draws, so a measure with
// two periods behind it reads as two columns rather than two threads on an empty field.
export const chartMark = { line: 2, hairline: 1, dot: 4, ring: 2, bar: 22, barWide: 40, cap: 4 };
