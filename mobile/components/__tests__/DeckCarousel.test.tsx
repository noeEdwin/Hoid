import React from "react";
import { render } from "@testing-library/react-native";
import DeckCarousel from "../DeckCarousel";

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

jest.mock("../DeckCard", () => {
  const { Text, Pressable } = require("react-native");
  return function MockDeckCard({ name, onStartReview, deckId }: any) {
    return (
      <Pressable onPress={() => onStartReview(deckId)}>
        <Text>{name}</Text>
      </Pressable>
    );
  };
});

describe("DeckCarousel", () => {
  const decks = [
    { id: "d1", name: "HSK 1", description: "Beginner", cardCount: 10 },
    { id: "d2", name: "Travel", description: null, cardCount: 5 },
  ];

  it("renders all decks", () => {
    const { getByText } = render(
      <DeckCarousel decks={decks} onStartReview={jest.fn()} />
    );
    expect(getByText("HSK 1")).toBeTruthy();
    expect(getByText("Travel")).toBeTruthy();
  });

  it("renders pagination dots container when more than 1 deck", () => {
    const { toJSON } = render(
      <DeckCarousel decks={decks} onStartReview={jest.fn()} />
    );
    const tree = JSON.stringify(toJSON());
    // The dots container has backgroundColor: "#005bbd" for active dot
    expect(tree).toContain("#005bbd");
    expect(tree).toContain("#d0d0d0");
  });

  it("does not render active dot style for single deck", () => {
    const { toJSON } = render(
      <DeckCarousel decks={[decks[0]]} onStartReview={jest.fn()} />
    );
    const tree = JSON.stringify(toJSON());
    // Single deck should not have the dots container
    expect(tree).not.toContain("#005bbd");
  });
});
