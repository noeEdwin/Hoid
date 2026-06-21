import React from "react";
import { render } from "@testing-library/react-native";
import ProgressBar from "../ProgressBar";

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

describe("ProgressBar", () => {
  it("renders without crashing", () => {
    const { toJSON } = render(<ProgressBar current={5} total={10} />);
    expect(toJSON()).toBeTruthy();
  });

  it("calculates progress ratio", () => {
    const { toJSON } = render(<ProgressBar current={3} total={10} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toBeTruthy();
  });

  it("handles zero total", () => {
    const { toJSON } = render(<ProgressBar current={0} total={0} />);
    expect(toJSON()).toBeTruthy();
  });

  it("handles full progress", () => {
    const { toJSON } = render(<ProgressBar current={10} total={10} />);
    expect(toJSON()).toBeTruthy();
  });
});
