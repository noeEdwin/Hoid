import {
  calculateReviewOutcome,
  formatPracticeDelay,
  formatReviewInterval,
  requiredCorrectChecks,
} from "../srs";

describe("SRS policy", () => {
  it("graduates a passed 180-day review to one year", () => {
    const outcome = calculateReviewOutcome({
      currentInterval: 180,
      failureCount: 0,
      responseTimeMs: 5_000,
      consecutiveCorrect: 6,
      difficultyScore: 0.1,
    });
    expect(outcome.intervalDays).toBe(365);
  });

  it("never schedules beyond one year", () => {
    const outcome = calculateReviewOutcome({
      currentInterval: 365,
      failureCount: 0,
      responseTimeMs: 5_000,
      consecutiveCorrect: 20,
      difficultyScore: 0,
    });
    expect(outcome.intervalDays).toBe(365);
  });

  it.each([[1, 30], [2, 14], [3, 1]])(
    "reduces a yearly card after %i failures to %i days",
    (failureCount, expected) => {
      const outcome = calculateReviewOutcome({
        currentInterval: 365,
        failureCount,
        responseTimeMs: 5_000,
        consecutiveCorrect: 8,
        difficultyScore: 0.1,
      });
      expect(outcome.intervalDays).toBe(expected);
    },
  );

  it("applies only a small slow-response reduction", () => {
    const outcome = calculateReviewOutcome({
      currentInterval: 180,
      failureCount: 0,
      responseTimeMs: 30_000,
      consecutiveCorrect: 6,
      difficultyScore: 0.1,
    });
    expect(outcome.intervalDays).toBe(310);
  });

  it("requires one to four checks based on confidence and failures", () => {
    expect(requiredCorrectChecks(30, 3, 0)).toBe(1);
    expect(requiredCorrectChecks(0, 0, 0)).toBe(2);
    expect(requiredCorrectChecks(30, 3, 2)).toBe(3);
    expect(requiredCorrectChecks(30, 3, 8)).toBe(4);
  });

  it("formats practice and long-term intervals", () => {
    expect(formatPracticeDelay(180_000)).toBe("3 min");
    expect(formatReviewInterval(30)).toBe("1 month");
    expect(formatReviewInterval(365)).toBe("1 year");
  });
});
