import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { normalize, Dimens } from "../lib/dimens";

interface DeckCardProps {
  deckId: string;
  name: string;
  description: string | null;
  cardCount: number;
  isReviewedToday?: boolean;
  onStartReview: (deckId: string) => void;
}

export default function DeckCard({
  deckId,
  name,
  description,
  cardCount,
  isReviewedToday,
  onStartReview,
}: DeckCardProps) {
  return (
    <Pressable
      onPress={() => onStartReview(deckId)}
      style={styles.container}
    >
      <LinearGradient
        colors={isReviewedToday ? ["#2e7d32", "#43a047"] : ["#005bbd", "#7622e5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            {isReviewedToday && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>✓</Text>
              </View>
            )}
          </View>
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
          <Text style={styles.count}>
            {cardCount} {cardCount === 1 ? "card" : "cards"}
          </Text>
        </View>
        <View style={[styles.button, isReviewedToday && styles.buttonCompleted]}>
          <Text style={[styles.buttonText, isReviewedToday && styles.buttonTextCompleted]}>
            {isReviewedToday ? "Completed" : "View Deck"}
          </Text>
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  name: {
    fontSize: normalize(22),
    fontWeight: "700",
    color: "white",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "white",
    fontSize: normalize(12),
    fontWeight: "700",
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
  buttonCompleted: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  buttonText: {
    fontSize: normalize(14),
    fontWeight: "600",
    color: "#005bbd",
  },
  buttonTextCompleted: {
    color: "white",
  },
});
