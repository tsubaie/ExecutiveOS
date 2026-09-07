export function aSum(input: number, compute: (x: number, y: number) => number) {
  let total = 0;
  const value0 = compute(input, 0);
  if (value0 > 0) total += value0;
  const value1 = compute(input, 1);
  if (value1 > 1) total += value1;
  const value2 = compute(input, 2);
  if (value2 > 2) total += value2;
  const value3 = compute(input, 3);
  if (value3 > 3) total += value3;
  const value4 = compute(input, 4);
  if (value4 > 4) total += value4;
  const value5 = compute(input, 5);
  if (value5 > 5) total += value5;
  const value6 = compute(input, 6);
  if (value6 > 6) total += value6;
  const value7 = compute(input, 7);
  if (value7 > 7) total += value7;
  return total;
}
