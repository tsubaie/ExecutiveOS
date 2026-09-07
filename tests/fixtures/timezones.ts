// Midnight boundaries in two zones, including a DST transition (docs/08 § Test data and clocks).
export const midnightBoundaries = [
  { timezone: 'Asia/Riyadh', before: '2026-09-07T20:59:59Z', after: '2026-09-07T21:00:00Z' },
  { timezone: 'America/New_York', before: '2026-03-08T04:59:59Z', after: '2026-03-08T05:00:00Z' },
];
// Furthest offsets either side of UTC; a calendar date must render identically under both.
export const extremeZones = { east: 'Pacific/Kiritimati', west: 'Pacific/Pago_Pago' };
