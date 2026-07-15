import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ClozeInput from "../ClozeInput";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium", Heavy: "heavy" },
}));

jest.mock("../../lib/dimens", () => ({
  normalize: (s: number) => s,
  Dimens: {
    padding: 24,
    borderRadius: 16,
  },
}));

describe("ClozeInput", () => {
  const defaultProps = {
    sentence: "我___你",
    sentencePinyin: "wǒ ài nǐ",
    answer: "爱",
    answerPinyin: "ài",
    onSubmit: jest.fn(),
    onSpeak: jest.fn(),
    onNext: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders pinyin with answer hidden", () => {
    const { getByText } = render(<ClozeInput {...defaultProps} />);
    expect(getByText("wǒ ___ nǐ")).toBeTruthy();
  });

  it("renders image when provided", () => {
    const { getByText } = render(
      <ClozeInput {...defaultProps} imagePath="❤️" />
    );
    expect(getByText("❤️")).toBeTruthy();
  });

  it("does not render image when not provided", () => {
    const { queryByText } = render(<ClozeInput {...defaultProps} />);
    expect(queryByText("❤️")).toBeNull();
  });

  it("calls onSubmit with true when answer is correct", () => {
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput {...defaultProps} />
    );
    const input = getByPlaceholderText("Type the missing word in hanzi...");
    fireEvent.changeText(input, "爱");
    fireEvent.press(getByText("Submit"));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith(true);
  });

  it("calls onSubmit with false when answer is incorrect", () => {
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput {...defaultProps} />
    );
    const input = getByPlaceholderText("Type the missing word in hanzi...");
    fireEvent.changeText(input, "错");
    fireEvent.press(getByText("Submit"));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith(false);
  });

  it("trims whitespace before comparing", () => {
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput {...defaultProps} />
    );
    const input = getByPlaceholderText("Type the missing word in hanzi...");
    fireEvent.changeText(input, "  爱  ");
    fireEvent.press(getByText("Submit"));

    expect(defaultProps.onSubmit).toHaveBeenCalledWith(true);
  });

  it("does not submit empty input", () => {
    const { getByText } = render(<ClozeInput {...defaultProps} />);
    fireEvent.press(getByText("Submit"));

    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("does not show speaker button before submit", () => {
    const { queryByText } = render(<ClozeInput {...defaultProps} />);

    expect(queryByText("🔊")).toBeNull();
  });

  it("clears input after submission", () => {
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput {...defaultProps} />
    );
    const input = getByPlaceholderText("Type the missing word in hanzi...");
    fireEvent.changeText(input, "爱");
    fireEvent.press(getByText("Submit"));

    expect(input.props.value).toBe("");
  });

  it("shows typed text in the blank when input is provided", () => {
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput {...defaultProps} />
    );
    const input = getByPlaceholderText("Type the missing word in hanzi...");
    fireEvent.changeText(input, "测试");

    expect(getByText("测试")).toBeTruthy();
  });

  it("submit button does not fire onSubmit when empty", () => {
    const { getByText } = render(<ClozeInput {...defaultProps} />);
    fireEvent.press(getByText("Submit"));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });

  it("submit button fires onSubmit when input has text", () => {
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput {...defaultProps} />
    );
    const input = getByPlaceholderText("Type the missing word in hanzi...");
    fireEvent.changeText(input, "爱");
    fireEvent.press(getByText("Submit"));
    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it("shows Correct! in result mode", () => {
    const { getByText } = render(
      <ClozeInput {...defaultProps} isResultVisible isCorrect />
    );

    expect(getByText("Correct!")).toBeTruthy();
  });

  it("shows Incorrect in result mode", () => {
    const { getByText } = render(
      <ClozeInput {...defaultProps} isResultVisible isCorrect={false} />
    );

    expect(getByText("Incorrect")).toBeTruthy();
  });

  it("shows answer and pinyin in result mode", () => {
    const { getAllByText, getByText } = render(
      <ClozeInput {...defaultProps} isResultVisible isCorrect />
    );

    expect(getAllByText("爱").length).toBeGreaterThan(0);
    expect(getByText("ài")).toBeTruthy();
  });

  it("calls onSpeak when result speaker button pressed", () => {
    const { getByText } = render(
      <ClozeInput {...defaultProps} isResultVisible isCorrect />
    );

    fireEvent.press(getByText("🔊"));

    expect(defaultProps.onSpeak).toHaveBeenCalled();
  });

  it("calls onNext when Next is pressed in result mode", () => {
    const { getByText } = render(
      <ClozeInput {...defaultProps} isResultVisible isCorrect />
    );

    fireEvent.press(getByText("Next"));

    expect(defaultProps.onNext).toHaveBeenCalled();
  });

  it("hides text input in result mode", () => {
    const { queryByPlaceholderText } = render(
      <ClozeInput {...defaultProps} isResultVisible isCorrect />
    );

    expect(queryByPlaceholderText("Type the missing word in hanzi...")).toBeNull();
  });
});
