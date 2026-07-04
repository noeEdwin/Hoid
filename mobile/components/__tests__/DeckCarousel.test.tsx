import React from "react";
import { render } from "@testing-library/react-native";
import DeckCarousel from "../DeckCarousel";

jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (c: any) => c,
  },
  useSharedValue: (v: number) => ({ value: v }),
  useAnimatedStyle: () => ({}),
  withTiming: (v: any) => v,
  interpolate: () => 0,
  Extrapolation: { CLAMP: "clamp" },
}));

jest.mock("react-native-reanimated-carousel", () => {
  const React = require("react");
  const { View } = require("react-native");

  const Carousel = ({ data, renderItem, testID }: any) => (
    <View testID={testID}>
      {data?.map((item: any, index: number) => (
        <React.Fragment key={`${item.id}-${index}`}>
          {renderItem({ item, index, animationValue: { value: 0 } })}
        </React.Fragment>
      ))}
    </View>
  );

  return {
    __esModule: true,
    default: Carousel,
  };
});

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return { LinearGradient: View };
});

jest.mock("../../lib/dimens", () => ({
  normalize: (s: number) => s,
  Dimens: {
    width: 375,
    height: 812,
    padding: 24,
    gap: 12,
    borderRadius: 16,
  },
}));

jest.mock("../../lib/carousel-animations", () => ({
  parallaxLayout: () => (value: number) => ({}),
}));

jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return { BlurView: View };
});

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
    const { getAllByText } = render(
      <DeckCarousel decks={decks} onStartReview={jest.fn()} />
    );
    expect(getAllByText("HSK 1").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Travel").length).toBeGreaterThanOrEqual(1);
  });

  it("renders carousel with vertical mode", () => {
    const { getByTestId } = render(
      <DeckCarousel decks={decks} onStartReview={jest.fn()} />
    );
    expect(getByTestId("deck-carousel-list")).toBeTruthy();
  });

  it("renders single deck without errors", () => {
    const { getByTestId } = render(
      <DeckCarousel decks={[decks[0]]} onStartReview={jest.fn()} />
    );
    expect(getByTestId("deck-carousel-list")).toBeTruthy();
  });
});
