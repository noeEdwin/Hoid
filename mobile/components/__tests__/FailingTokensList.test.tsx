import React from "react";
import { render } from "@testing-library/react-native";
import FailingTokensList from "../FailingTokensList";

jest.mock("../../lib/dimens", () => ({
  normalize: (s: number) => s,
  Dimens: {
    padding: 24,
    gutter: 16,
    borderRadius: 16,
  },
}));

jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return { BlurView: View };
});

jest.mock("../FailingTokenRow", () => {
  const { Text } = require("react-native");
  return function MockFailingTokenRow({ token }: any) {
    return <Text>{token.answer}</Text>;
  };
});

describe("FailingTokensList", () => {
  it("shows empty state when no tokens", () => {
    const { getByText } = render(<FailingTokensList tokens={[]} />);
    expect(getByText("No failing tokens yet")).toBeTruthy();
  });

  it("renders title when tokens present", () => {
    const { getByText } = render(
      <FailingTokensList
        tokens={[
          {
            id: "t1",
            sentence: "test",
            answer: "爱",
            answerPinyin: "ài",
            difficultyScore: 0.8,
            totalReviews: 5,
            totalFailures: 4,
          },
        ]}
      />
    );
    expect(getByText("Failing Tokens")).toBeTruthy();
  });

  it("renders all tokens", () => {
    const { getByText } = render(
      <FailingTokensList
        tokens={[
          { id: "t1", sentence: "s1", answer: "爱", answerPinyin: "", difficultyScore: 0.8, totalReviews: 5, totalFailures: 4 },
          { id: "t2", sentence: "s2", answer: "朋友", answerPinyin: "", difficultyScore: 0.6, totalReviews: 3, totalFailures: 2 },
        ]}
      />
    );
    expect(getByText("爱")).toBeTruthy();
    expect(getByText("朋友")).toBeTruthy();
  });
});
