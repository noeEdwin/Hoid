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

  it("hides repeated answers at every blank position", () => {
    const { getByText } = render(
      <ClozeInput
        {...defaultProps}
        sentence="我姐姐___聪明___漂亮。"
        sentencePinyin="wǒ jiějie yòu cōngmíng yòu piàoliang"
        answer="又"
        answerPinyin="yòu"
      />
    );

    expect(getByText("wǒ jiějie ___ cōngmíng ___ piàoliang")).toBeTruthy();
  });

  it("hides ellipsis-separated repeated answer pinyin", () => {
    const { getByText } = render(
      <ClozeInput
        {...defaultProps}
        sentence="我姐姐___聪明___漂亮。"
        sentencePinyin="wǒ jiějie yòu cōngmíng yòu piàoliang"
        answer="又...又..."
        answerPinyin="yòu...yòu..."
      />
    );

    expect(getByText("wǒ jiějie ___ cōngmíng ___ piàoliang")).toBeTruthy();
  });

  it("hides pinyin inside a combined number token", () => {
    const { getByText } = render(
      <ClozeInput
        {...defaultProps}
        sentence="这块手表三___块。"
        sentencePinyin="zhè kuài shǒubiǎo sānqiān kuài."
        answer="千"
        answerPinyin="qiān"
      />
    );

    expect(getByText("zhè kuài shǒubiǎo sān___ kuài.")).toBeTruthy();
  });

  it("reveals ordered answers in their corresponding blanks", () => {
    const { getByText } = render(
      <ClozeInput
        {...defaultProps}
        sentence="他回___家的时候，太太已经做___饭了。"
        sentencePinyin="tā huí dào jiā de shíhou, tàitai yǐjīng zuò hǎo fàn le."
        answer="到...好"
        answerPinyin="dào...hǎo"
        isResultVisible
      />
    );

    expect(getByText("他回到")).toBeTruthy();
    expect(getByText("家的时候，太太已经做好")).toBeTruthy();
    expect(getByText("饭了。")).toBeTruthy();
    expect(getByText("到 … 好")).toBeTruthy();
  });

  it("accepts Chinese punctuation between ordered answers", () => {
    const onSubmit = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <ClozeInput
        {...defaultProps}
        sentence="他回___家的时候，太太已经做___饭了。"
        answer="到...好"
        answerPinyin="dào...hǎo"
        onSubmit={onSubmit}
      />
    );

    fireEvent.changeText(
      getByPlaceholderText("Type the missing word in hanzi..."),
      "到。。。好"
    );
    fireEvent.press(getByText("Submit"));

    expect(onSubmit).toHaveBeenCalledWith(true);
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
