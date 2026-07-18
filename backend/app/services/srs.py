from __future__ import annotations

from app.schemas.review import ReviewRating

REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 120, 180, 365]
MAX_REVIEW_INTERVAL_DAYS = REVIEW_INTERVALS[-1]
MASTERY_THRESHOLD = 3


def _find_next_step(current_interval: int) -> int | None:
    for step in REVIEW_INTERVALS:
        if step > current_interval:
            return step
    return None


def calculate_new_interval(
    current_interval: int,
    ease_factor: float,
    difficulty_score: float,
    rating: ReviewRating,
    consecutive_correct: int = 0,
) -> int:
    if rating == ReviewRating.hard:
        return max(1, min(30, round(min(current_interval, MAX_REVIEW_INTERVAL_DAYS) * 0.1)))

    next_step = _find_next_step(max(0, min(current_interval, MAX_REVIEW_INTERVAL_DAYS)))
    interval = next_step if next_step is not None else MAX_REVIEW_INTERVAL_DAYS
    return min(MAX_REVIEW_INTERVAL_DAYS, interval)


def calculate_lapse_interval(current_interval: int, failure_count: int) -> int:
    current = max(1, min(current_interval, MAX_REVIEW_INTERVAL_DAYS))
    if failure_count >= 3:
        return 1
    if failure_count == 2:
        return max(1, min(14, round(current * 0.05)))
    return max(1, min(30, round(current * 0.1)))


def apply_response_speed(interval: int, response_time_ms: int) -> int:
    if response_time_ms <= 15_000:
        return min(interval, MAX_REVIEW_INTERVAL_DAYS)
    if response_time_ms >= 30_000:
        modifier = 0.85
    else:
        modifier = 1.0 - ((response_time_ms - 15_000) / 15_000) * 0.15
    return max(1, min(MAX_REVIEW_INTERVAL_DAYS, round(interval * modifier)))


def calculate_new_ease(current_ease: float, rating: ReviewRating) -> float:
    if rating == ReviewRating.hard:
        return max(1.3, current_ease - 0.2)
    if rating == ReviewRating.good:
        return min(3.0, current_ease + 0.05)
    return current_ease


def calculate_new_difficulty(
    current_difficulty: float,
    rating: ReviewRating,
    response_time_ms: int,
    consecutive_failures: int,
) -> float:
    penalty = 0.0
    if rating == ReviewRating.hard:
        consecutive_penalty = min(consecutive_failures * 0.05, 0.25)
        penalty = 0.15 + consecutive_penalty
    elif rating == ReviewRating.good:
        penalty = 0.02 if response_time_ms > 15_000 else 0.0
    adjusted = current_difficulty + penalty
    return max(0.0, min(1.0, adjusted))


def calculate_mastery_correct(
    current_consecutive_correct: int,
    rating: ReviewRating,
) -> int:
    if rating == ReviewRating.good:
        return current_consecutive_correct + 1
    return 0
