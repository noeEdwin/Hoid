import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { BlurView as _BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { normalize, Dimens } from "../lib/dimens";

const BlurView = Animated.createAnimatedComponent(_BlurView);

interface DeckCardProps {
  deckId: string;
  name: string;
  description: string | null;
  cardCount: number;
  isReviewedToday?: boolean;
  onStartReview: (deckId: string) => void;
  animationValue?: SharedValue<number>;
}

export default React.memo(function DeckCard({
  deckId,
  name,
  description,
  cardCount,
  isReviewedToday,
  onStartReview,
  animationValue,
}: DeckCardProps) {
  const blurStyle = useAnimatedStyle(() => {
    if (!animationValue) return { opacity: 0 };
    const opacity = interpolate(
      animationValue.value,
      [-0.5, 0, 0.5, 1],
      [1, 0, 0, 1]
    );
    return { opacity };
  }, [animationValue]);

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
        {animationValue && (
          <BlurView
            intensity={90}
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, blurStyle]}
          />
        )}
      </LinearGradient>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 30,
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    borderRadius: 30,
    padding: Dimens.padding * 2,
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
    fontSize: normalize(24),
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
    fontSize: normalize(15),
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
