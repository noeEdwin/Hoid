import React from "react";
import { render, act } from "@testing-library/react-native";
import ReviewResult from "../ReviewResult";

jest.mock("../../lib/dimens", () => ({
  normalize: (s: number) => s,
  Dimens: {
    padding: 24,
    borderRadius: 16,
  },
}));

describe("ReviewResult", () => {
  const defaultProps = {
    isCorrect: true,
    answer: "爱",
    answerPinyin: "ài",
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows correct answer", () => {
    const { getByText } = render(<ReviewResult {...defaultProps} />);
    expect(getByText("爱")).toBeTruthy();
    expect(getByText("ài")).toBeTruthy();
  });

  it("shows Correct! for correct answer", () => {
    const { getByText } = render(<ReviewResult {...defaultProps} />);
    expect(getByText("Correct!")).toBeTruthy();
  });

  it("shows Incorrect for wrong answer", () => {
    const { getByText } = render(
      <ReviewResult {...defaultProps} isCorrect={false} />
    );
    expect(getByText("Incorrect")).toBeTruthy();
  });

  it("shows checkmark icon for correct", () => {
    const { getByText } = render(<ReviewResult {...defaultProps} />);
    expect(getByText("✓")).toBeTruthy();
  });

  it("shows X icon for incorrect", () => {
    const { getByText } = render(
      <ReviewResult {...defaultProps} isCorrect={false} />
    );
    expect(getByText("✗")).toBeTruthy();
  });

  it("calls onDismiss after timeout", () => {
    render(<ReviewResult {...defaultProps} />);

    expect(defaultProps.onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(defaultProps.onDismiss).toHaveBeenCalled();
  });
});
