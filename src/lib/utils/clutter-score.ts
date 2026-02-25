export function computeClutterScore(profile: {
  totalCount: number;
  openRate: number;
  avgFrequencyDays: number | null;
  hasListUnsubscribe: boolean;
}): number {
  const { totalCount, openRate, avgFrequencyDays, hasListUnsubscribe } =
    profile;

  // Volume score (30%): log scale, caps at ~500 emails
  const volumeScore =
    Math.min(Math.log10(totalCount + 1) / Math.log10(500), 1) * 30;

  // Open rate score (35%): lower open rate = higher clutter
  const openRateScore = (1 - Math.min(openRate, 1)) * 35;

  // Frequency score (25%): more frequent = more clutter
  let frequencyScore = 0;
  if (avgFrequencyDays !== null && avgFrequencyDays > 0) {
    frequencyScore = Math.min(1 / Math.max(avgFrequencyDays, 0.5), 1) * 25;
  }

  // Unsubscribe header bonus (10%): suggests bulk/marketing mail
  const unsubBonus = hasListUnsubscribe ? 10 : 0;

  return Math.round(volumeScore + openRateScore + frequencyScore + unsubBonus);
}
