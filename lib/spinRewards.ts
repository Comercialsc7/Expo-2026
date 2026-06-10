export const MAX_SPINS = 5;
export const SPIN_THRESHOLD = 3000;

export function calculateSpins(total: number, maxSpins: number = MAX_SPINS): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const safeMaxSpins = Number.isFinite(maxSpins) && maxSpins > 0
    ? Math.floor(maxSpins)
    : MAX_SPINS;

  return Math.min(safeMaxSpins, Math.floor(total / SPIN_THRESHOLD));
}