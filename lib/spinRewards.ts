export const MAX_SPINS = 5;
export const SPIN_THRESHOLD = 3000;

export function calculateSpins(total: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return Math.min(MAX_SPINS, Math.floor(total / SPIN_THRESHOLD));
}