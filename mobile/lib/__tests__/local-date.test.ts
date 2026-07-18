import { getCalendarDayNumber, getLocalDateKey, getPreviousLocalDateKey } from "../local-date";

describe("local date helpers", () => {
  it("formats dates using local calendar fields", () => {
    expect(getLocalDateKey(new Date(2026, 6, 8, 0, 1))).toBe("2026-07-08");
  });

  it("handles the previous day across month boundaries", () => {
    expect(getPreviousLocalDateKey(new Date(2026, 7, 1, 0, 1))).toBe("2026-07-31");
  });

  it("compares calendar days independently of daylight-saving duration", () => {
    const first = getCalendarDayNumber("2026-03-08");
    const second = getCalendarDayNumber("2026-03-09");

    expect(first).not.toBeNull();
    expect(second! - first!).toBe(1);
  });
});
