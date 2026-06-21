import React from "react";
import { render } from "@testing-library/react-native";
import GlassCard from "../GlassCard";
import { Text } from "react-native";

jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return { BlurView: View };
});

jest.mock("../../lib/dimens", () => ({
  Dimens: {
    padding: 24,
    borderRadius: 16,
  },
}));

describe("GlassCard", () => {
  it("renders children", () => {
    const { getByText } = render(
      <GlassCard>
        <Text>Hello</Text>
      </GlassCard>
    );
    expect(getByText("Hello")).toBeTruthy();
  });

  it("renders multiple children", () => {
    const { getByText } = render(
      <GlassCard>
        <Text>First</Text>
        <Text>Second</Text>
      </GlassCard>
    );
    expect(getByText("First")).toBeTruthy();
    expect(getByText("Second")).toBeTruthy();
  });
});
