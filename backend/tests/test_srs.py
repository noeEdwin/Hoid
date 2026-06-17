from __future__ import annotations

from app.schemas.review import ReviewRating
from app.services.srs import (
    calculate_new_difficulty,
    calculate_new_ease,
    calculate_new_interval,
)


class TestCalculateNewInterval:
    def test_learning_step_1_progression(self) -> None:
        result = calculate_new_interval(0, 2.5, 0.0, ReviewRating.good)
        assert result == 1

    def test_learning_step_2_progression(self) -> None:
        result = calculate_new_interval(1, 2.5, 0.0, ReviewRating.good)
        assert result == 3

    def test_graduation_from_learning(self) -> None:
        result = calculate_new_interval(3, 2.5, 0.0, ReviewRating.good)
        assert result == 7

    def test_hard_resets_to_step_1_from_learning(self) -> None:
        result = calculate_new_interval(3, 2.5, 0.0, ReviewRating.hard)
        assert result == 1

    def test_hard_resets_to_step_1_from_graduated(self) -> None:
        result = calculate_new_interval(10, 2.5, 0.0, ReviewRating.hard)
        assert result == 1

    def test_easy_graduates_immediately_from_learning(self) -> None:
        result = calculate_new_interval(0, 2.5, 0.0, ReviewRating.easy)
        assert result == 7

    def test_difficulty_suppresses_interval(self) -> None:
        no_diff = calculate_new_interval(10, 2.5, 0.0, ReviewRating.good)
        with_diff = calculate_new_interval(10, 2.5, 0.5, ReviewRating.good)
        assert with_diff < no_diff

    def test_interval_never_below_1(self) -> None:
        result = calculate_new_interval(1, 1.3, 1.0, ReviewRating.good)
        assert result >= 1


class TestCalculateNewEase:
    def test_easy_increases_ease(self) -> None:
        result = calculate_new_ease(2.5, ReviewRating.easy)
        assert result == 2.65

    def test_hard_decreases_ease(self) -> None:
        result = calculate_new_ease(2.5, ReviewRating.hard)
        assert result == 2.3

    def test_good_leaves_ease_unchanged(self) -> None:
        result = calculate_new_ease(2.5, ReviewRating.good)
        assert result == 2.5


class TestCalculateNewDifficulty:
    def test_hard_increases_difficulty(self) -> None:
        result = calculate_new_difficulty(0.5, ReviewRating.hard, 2000, 0)
        assert result == 0.65

    def test_consecutive_failures_amplify_penalty(self) -> None:
        single = calculate_new_difficulty(0.5, ReviewRating.hard, 2000, 0)
        consecutive = calculate_new_difficulty(0.5, ReviewRating.hard, 2000, 3)
        assert consecutive > single

    def test_fast_good_keeps_difficulty_stable(self) -> None:
        result = calculate_new_difficulty(0.5, ReviewRating.good, 2000, 0)
        assert result == 0.5

    def test_easy_decreases_difficulty(self) -> None:
        result = calculate_new_difficulty(0.5, ReviewRating.easy, 2000, 0)
        assert result == 0.45
