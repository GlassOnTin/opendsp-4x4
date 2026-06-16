// High-level EQ model (engineering units: Hz, dB, octaves). Wire encodings are
// applied only at emit time via the Calibration interface — drawing math here is
// pure and protocol-independent.

export const FS = 48000; // device sample rate

export interface PeqBand {
  freqHz: number;  // 20 .. 20000
  gainDb: number;  // ~ -18 .. +18
  bwOct: number;   // bandwidth in octaves (editor unit; -> Q on the wire)
  type: number;    // PeqType code (0..6)
  bypass: boolean;
}

export interface Crossover {
  freqHz: number;
  slope: number;   // Slope code (0 = bypass)
}

export interface ChannelEq {
  bands: PeqBand[]; // length 7
  hpf: Crossover;   // Low-Cut
  lpf: Crossover;   // High-Cut
}
