export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120, 180, 365] as const;
export const MAX_REVIEW_INTERVAL_DAYS = 365;
export const PRACTICE_DELAYS_MS = [60_000, 180_000, 600_000] as const;

export interface ReviewOutcomeInput {
  currentInterval: number;
  failureCount: number;
  responseTimeMs: number;
  consecutiveCorrect: number;
  difficultyScore: number;
}

export interface ReviewOutcome {
  intervalDays: number;
  consecutiveCorrect: number;
  consecutiveFailures: number;
  difficultyScore: number;
}

function nextInterval(currentInterval: number): number {
  const current = Math.max(0, Math.min(MAX_REVIEW_INTERVAL_DAYS, currentInterval));
  return REVIEW_INTERVALS_DAYS.find((interval) => interval > current) ?? MAX_REVIEW_INTERVAL_DAYS;
}

function applySpeed(interval: number, responseTimeMs: number): number {
  if (responseTimeMs <= 15_000) return interval;
  const modifier = responseTimeMs >= 30_000
    ? 0.85
    : 1 - ((responseTimeMs - 15_000) / 15_000) * 0.15;
  return Math.max(1, Math.min(MAX_REVIEW_INTERVAL_DAYS, Math.round(interval * modifier)));
}

function lapseInterval(currentInterval: number, failureCount: number): number {
  const current = Math.max(1, Math.min(MAX_REVIEW_INTERVAL_DAYS, currentInterval));
  if (failureCount >= 3) return 1;
  if (failureCount === 2) return Math.max(1, Math.min(14, Math.round(current * 0.05)));
  return Math.max(1, Math.min(30, Math.round(current * 0.1)));
}

export function calculateReviewOutcome(input: ReviewOutcomeInput): ReviewOutcome {
  const hadLapse = input.failureCount > 0;
  const intervalDays = hadLapse
    ? lapseInterval(input.currentInterval, input.failureCount)
    : applySpeed(nextInterval(input.currentInterval), input.responseTimeMs);
  const difficultyDelta = hadLapse
    ? Math.min(0.4, 0.15 + (input.failureCount - 1) * 0.05)
    : input.responseTimeMs > 15_000 ? 0.02 : 0;

  return {
    intervalDays,
    consecutiveCorrect: hadLapse ? 0 : input.consecutiveCorrect + 1,
    consecutiveFailures: hadLapse ? 1 : 0,
    difficultyScore: Math.max(0, Math.min(1, input.difficultyScore + difficultyDelta)),
  };
}

export function requiredCorrectChecks(
  intervalDays: number,
  consecutiveCorrect: number,
  failureCount: number,
): number {
  const stableBase = intervalDays >= 3 && consecutiveCorrect >= 2 ? 1 : 2;
  return Math.max(stableBase, Math.min(4, failureCount + 1));
}

export function practiceDelayMs(unresolvedPresentationCount: number): number {
  return PRACTICE_DELAYS_MS[Math.min(unresolvedPresentationCount, PRACTICE_DELAYS_MS.length) - 1] ?? PRACTICE_DELAYS_MS[0];
}

export function formatReviewInterval(days: number): string {
  if (days >= 365) return "1 year";
  if (days >= 30) {
    const months = Math.round(days / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function formatPracticeDelay(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  return `${minutes} min`;
}
