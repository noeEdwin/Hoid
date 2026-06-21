import { useRef, useState } from "react";
import { View, FlatList, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import DeckCard from "./DeckCard";
import { normalize, Dimens } from "../lib/dimens";

interface DeckItem {
  id: string;
  name: string;
  description: string | null;
  cardCount: number;
}

interface DeckCarouselProps {
  decks: DeckItem[];
  onStartReview: (deckId: string) => void;
}

export default function DeckCarousel({ decks, onStartReview }: DeckCarouselProps) {
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(
      e.nativeEvent.contentOffset.x / (Dimens.width - Dimens.padding * 4 + Dimens.gap * 2)
    );
    setActiveIndex(index);
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={decks}
        renderItem={({ item }) => (
          <DeckCard
            deckId={item.id}
            name={item.name}
            description={item.description}
            cardCount={item.cardCount}
            onStartReview={onStartReview}
          />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={Dimens.width - Dimens.padding * 4 + Dimens.gap * 2}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={onScroll}
        contentContainerStyle={styles.listContent}
      />
      {decks.length > 1 && (
        <View style={styles.dots}>
          {decks.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Dimens.gutter,
  },
  listContent: {
    paddingHorizontal: Dimens.padding * 2,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Dimens.gap,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d0d0d0",
  },
  dotActive: {
    backgroundColor: "#005bbd",
    width: 20,
  },
});
