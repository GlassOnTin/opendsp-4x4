// Pixel <-> value mappings for the EQ graph: log-frequency X, linear-dB Y.
// Pure and parameterized by the viewport rect + ranges (unit-testable).

export interface Scales {
  readonly W: number;
  readonly H: number;
  freqToX(f: number): number;
  xToFreq(x: number): number;
  dbToY(db: number): number;
  yToDb(y: number): number;
  toValue(x: number, y: number): { fHz: number; db: number };
}

export function makeScales(W: number, H: number, fMin = 20, fMax = 20000, dbRange = 18): Scales {
  const lmin = Math.log10(fMin), lmax = Math.log10(fMax), span = lmax - lmin;
  const freqToX = (f: number) => ((Math.log10(f) - lmin) / span) * W;
  const xToFreq = (x: number) => Math.pow(10, lmin + (x / W) * span);
  const dbToY = (db: number) => H / 2 - (db / dbRange) * (H / 2);
  const yToDb = (y: number) => ((H / 2 - y) / (H / 2)) * dbRange;
  return { W, H, freqToX, xToFreq, dbToY, yToDb, toValue: (x, y) => ({ fHz: xToFreq(x), db: yToDb(y) }) };
}
