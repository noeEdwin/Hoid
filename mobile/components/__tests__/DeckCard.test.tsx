import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import DeckCard from "../DeckCard";

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

jest.mock("../../lib/dimens", () => ({
  normalize: (s: number) => s,
  Dimens: {
    width: 375,
    padding: 24,
    gap: 12,
    borderRadius: 16,
  },
}));

describe("DeckCard", () => {
  const defaultProps = {
    deckId: "deck-1",
    name: "HSK 1",
    description: "Beginner vocabulary",
    cardCount: 20,
    onStartReview: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders deck name", () => {
    const { getByText } = render(<DeckCard {...defaultProps} />);
    expect(getByText("HSK 1")).toBeTruthy();
  });

  it("renders description when provided", () => {
    const { getByText } = render(<DeckCard {...defaultProps} />);
    expect(getByText("Beginner vocabulary")).toBeTruthy();
  });

  it("does not render description when null", () => {
    const { queryByText } = render(
      <DeckCard {...defaultProps} description={null} />
    );
    expect(queryByText("Beginner vocabulary")).toBeNull();
  });

  it("renders card count singular", () => {
    const { getByText } = render(
      <DeckCard {...defaultProps} cardCount={1} />
    );
    expect(getByText("1 card")).toBeTruthy();
  });

  it("renders card count plural", () => {
    const { getByText } = render(
      <DeckCard {...defaultProps} cardCount={20} />
    );
    expect(getByText("20 cards")).toBeTruthy();
  });

  it("calls onStartReview with deckId when button pressed", () => {
    const { getByText } = render(<DeckCard {...defaultProps} />);
    fireEvent.press(getByText("View Deck"));

    expect(defaultProps.onStartReview).toHaveBeenCalledWith("deck-1");
  });
});
