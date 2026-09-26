// Mulberry32 seeded PRNG — deterministic, fast, good enough for simulation (not crypto).
export class RNG {
  private state: number;

  constructor(seed?: number) {
    this.state = seed ?? Math.floor(Math.random() * 0xffffffff);
  }

  // returns float in [0, 1)
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // returns integer in [0, max)
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  // weighted pick: weights array, returns index
  weightedPick(weights: number[]): number {
    const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
    if (total <= 0) return this.nextInt(weights.length);
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
