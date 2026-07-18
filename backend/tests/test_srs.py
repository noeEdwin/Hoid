from __future__ import annotations

from app.schemas.review import ReviewRating
from app.services.srs import (
    MASTERY_THRESHOLD,
    apply_response_speed,
    calculate_lapse_interval,
    calculate_mastery_correct,
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

    def test_uses_fixed_review_ladder(self) -> None:
        assert calculate_new_interval(10, 2.5, 0.0, ReviewRating.good) == 14

    def test_interval_never_below_1(self) -> None:
        result = calculate_new_interval(1, 1.3, 1.0, ReviewRating.good)
        assert result >= 1

    def test_mastered_card_grows_interval_normally(self) -> None:
        result = calculate_new_interval(
            7, 2.5, 0.0, ReviewRating.good, consecutive_correct=MASTERY_THRESHOLD
        )
        assert result == 14

    def test_mastered_card_hard_resets_to_learning(self) -> None:
        result = calculate_new_interval(
            42, 2.5, 0.0, ReviewRating.hard, consecutive_correct=MASTERY_THRESHOLD
        )
        assert result == 4

    def test_interval_never_exceeds_one_year(self) -> None:
        assert calculate_new_interval(365, 3.0, 0.0, ReviewRating.good) == 365

    def test_yearly_lapse_reductions(self) -> None:
        assert calculate_lapse_interval(365, 1) == 30
        assert calculate_lapse_interval(365, 2) == 14
        assert calculate_lapse_interval(365, 3) == 1

    def test_slow_response_has_small_penalty(self) -> None:
        assert apply_response_speed(365, 30_000) == 310


class TestCalculateNewEase:
    def test_hard_decreases_ease(self) -> None:
        result = calculate_new_ease(2.5, ReviewRating.hard)
        assert result == 2.3

    def test_good_increases_ease(self) -> None:
        result = calculate_new_ease(2.5, ReviewRating.good)
        assert result == 2.55

    def test_easy_ease_cannot_exceed_3(self) -> None:
        result = calculate_new_ease(2.98, ReviewRating.good)
        assert result <= 3.0

    def test_hard_ease_cannot_go_below_1_3(self) -> None:
        result = calculate_new_ease(1.3, ReviewRating.hard)
        assert result == 1.3


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

    def test_slow_good_increases_difficulty(self) -> None:
        result = calculate_new_difficulty(0.5, ReviewRating.good, 20000, 0)
        assert result > 0.5


class TestMasteryCorrect:
    def test_correct_increments(self) -> None:
        result = calculate_mastery_correct(0, ReviewRating.good)
        assert result == 1

    def test_correct_reaches_threshold(self) -> None:
        result = calculate_mastery_correct(MASTERY_THRESHOLD - 1, ReviewRating.good)
        assert result == MASTERY_THRESHOLD

    def test_hard_resets_to_zero(self) -> None:
        result = calculate_mastery_correct(5, ReviewRating.hard)
        assert result == 0

    def test_hard_from_zero_stays_zero(self) -> None:
        result = calculate_mastery_correct(0, ReviewRating.hard)
        assert result == 0
