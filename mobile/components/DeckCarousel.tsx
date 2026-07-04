import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import DeckCard from "./DeckCard";
import { Dimens } from "../lib/dimens";
import { parallaxLayout } from "../lib/carousel-animations";

interface DeckItem {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
  isReviewedToday?: boolean;
}

interface DeckCarouselProps {
  decks: DeckItem[];
  onStartReview: (deckId: string) => void;
}

const ITEM_WIDTH = Dimens.width * 0.9;
const ITEM_HEIGHT = Dimens.height * 0.4;

export default function DeckCarousel({ decks, onStartReview }: DeckCarouselProps) {
  const flatListRef = useRef<ICarouselInstance>(null);

  return (
    <View style={styles.container}>
      <Carousel
        ref={flatListRef}
        testID="deck-carousel-list"
        data={decks}
        vertical
        loop={decks.length > 1}
        style={styles.carousel}
        contentContainerStyle={styles.contentContainer}
        width={ITEM_WIDTH}
        height={ITEM_HEIGHT}
        pagingEnabled={false}
        snapEnabled={false}
        customAnimation={parallaxLayout({ size: ITEM_WIDTH })}
        scrollAnimationDuration={500}
        renderItem={({ item, animationValue }) => (
          <DeckCard
            deckId={item.id}
            name={item.name}
            description={item.description}
            cardCount={item.cardCount}
            isReviewedToday={item.isReviewedToday}
            onStartReview={onStartReview}
            animationValue={animationValue}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  carousel: {
    width: ITEM_WIDTH,
    height: Dimens.height * 0.7,
  },
  contentContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
  },
});
