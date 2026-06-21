from __future__ import annotations

from app.schemas.review import ReviewRating

LEARNING_STEPS = [1, 3]


def _find_next_step(current_interval: int) -> int | None:
    for step in LEARNING_STEPS:
        if step > current_interval:
            return step
    return None


def calculate_new_interval(
    current_interval: int,
    ease_factor: float,
    difficulty_score: float,
    rating: ReviewRating,
) -> int:
    in_learning = current_interval <= LEARNING_STEPS[-1]

    if in_learning:
        if rating == ReviewRating.hard:
            return LEARNING_STEPS[0]
        next_step = _find_next_step(current_interval)
        if next_step is not None:
            return next_step
        return max(1, int(LEARNING_STEPS[-1] * ease_factor))

    if rating == ReviewRating.hard:
        return LEARNING_STEPS[0]

    base = int(current_interval * ease_factor)
    difficulty_modifier = 1.0 - (difficulty_score * 0.3)
    return max(1, int(base * difficulty_modifier))


def calculate_new_ease(current_ease: float, rating: ReviewRating) -> float:
    if rating == ReviewRating.hard:
        return max(1.3, current_ease - 0.2)
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
        response_factor = max(0.8, 1.0 - (response_time_ms - 2000) / 10000)
        penalty = (1.0 - response_factor) * 0.1
    adjusted = current_difficulty + penalty
    return max(0.0, min(1.0, adjusted))
