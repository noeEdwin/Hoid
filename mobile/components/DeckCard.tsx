import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { normalize, Dimens } from "../lib/dimens";

interface DeckCardProps {
  deckId: string;
  name: string;
  description: string | null;
  cardCount: number;
  onStartReview: (deckId: string) => void;
}

export default function DeckCard({
  deckId,
  name,
  description,
  cardCount,
  onStartReview,
}: DeckCardProps) {
  return (
    <Pressable
      onPress={() => onStartReview(deckId)}
      style={styles.container}
    >
      <LinearGradient
        colors={["#005bbd", "#7622e5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.name}>{name}</Text>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
          <Text style={styles.count}>
            {cardCount} {cardCount === 1 ? "card" : "cards"}
          </Text>
        </View>
        <View style={styles.button}>
          <Text style={styles.buttonText}>View Deck</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Dimens.width - Dimens.padding * 4,
    marginHorizontal: Dimens.gap,
  },
  gradient: {
    borderRadius: Dimens.borderRadius,
    padding: Dimens.padding * 1.5,
    minHeight: normalize(180),
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: normalize(22),
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  description: {
    fontSize: normalize(14),
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
    lineHeight: normalize(20),
  },
  count: {
    fontSize: normalize(13),
    color: "rgba(255,255,255,0.7)",
  },
  button: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: "flex-start",
    marginTop: 16,
  },
  buttonText: {
    fontSize: normalize(14),
    fontWeight: "600",
    color: "#005bbd",
  },
});
