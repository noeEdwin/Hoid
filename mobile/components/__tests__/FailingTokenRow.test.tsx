import React from "react";
import { render } from "@testing-library/react-native";
import FailingTokenRow from "../FailingTokenRow";

jest.mock("../../lib/dimens", () => ({
  normalize: (s: number) => s,
  Dimens: {
    padding: 24,
    gutter: 16,
  },
}));

describe("FailingTokenRow", () => {
  const baseToken = {
    id: "t1",
    sentence: "我___你",
    answer: "爱",
    answerPinyin: "ài",
    difficultyScore: 0.5,
    totalReviews: 10,
    totalFailures: 5,
  };

  it("renders answer in hanzi", () => {
    const { getByText } = render(<FailingTokenRow token={baseToken} />);
    expect(getByText("爱")).toBeTruthy();
  });

  it("renders sentence", () => {
    const { getByText } = render(<FailingTokenRow token={baseToken} />);
    expect(getByText("我___你")).toBeTruthy();
  });

  it("renders difficulty percentage", () => {
    const { getByText } = render(<FailingTokenRow token={baseToken} />);
    expect(getByText("50% Fail")).toBeTruthy();
  });

  it("shows Critical Level for score >= 0.8", () => {
    const { getByText } = render(
      <FailingTokenRow token={{ ...baseToken, difficultyScore: 0.85 }} />
    );
    expect(getByText("Critical Level")).toBeTruthy();
  });

  it("shows Needs Practice for score >= 0.5", () => {
    const { getByText } = render(
      <FailingTokenRow token={{ ...baseToken, difficultyScore: 0.6 }} />
    );
    expect(getByText("Needs Practice")).toBeTruthy();
  });

  it("shows Review Soon for score < 0.5", () => {
    const { getByText } = render(
      <FailingTokenRow token={{ ...baseToken, difficultyScore: 0.3 }} />
    );
    expect(getByText("Review Soon")).toBeTruthy();
  });

  it("renders difficulty bar width", () => {
    const { toJSON } = render(
      <FailingTokenRow token={{ ...baseToken, difficultyScore: 0.7 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("70%");
  });
});
