export function computeHealthScore(
  senderScores: { clutterScore: number; totalCount: number }[]
): number {
  if (senderScores.length === 0) return 100;

  // Weighted average clutter score (weighted by email count)
  const totalEmails = senderScores.reduce((sum, s) => sum + s.totalCount, 0);
  if (totalEmails === 0) return 100;

  const weightedClutter = senderScores.reduce(
    (sum, s) => sum + s.clutterScore * s.totalCount,
    0
  );

  const avgClutter = weightedClutter / totalEmails;

  return Math.max(0, Math.min(100, Math.round(100 - avgClutter)));
}
