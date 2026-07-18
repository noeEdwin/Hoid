import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPreviousLocalDateKey(date: Date = new Date()): string {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return getLocalDateKey(previous);
}

export function getCalendarDayNumber(dateKey: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

function millisecondsUntilNextLocalDay(): number {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1, nextDay.getTime() - now.getTime());
}

export function useLocalDayRefresh(): void {
  const [, setDateKey] = useState(getLocalDateKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      setDateKey(getLocalDateKey());
      timer = setTimeout(scheduleRefresh, millisecondsUntilNextLocalDay());
    };

    scheduleRefresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") scheduleRefresh();
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);
}
