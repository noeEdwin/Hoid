import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { normalize, Dimens } from "../lib/dimens";

interface ReviewResultProps {
  isCorrect: boolean;
  answer: string;
  answerPinyin: string;
  onDismiss: () => void;
}

export default function ReviewResult({
  isCorrect,
  answer,
  answerPinyin,
  onDismiss,
}: ReviewResultProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const bgColor = isCorrect ? "#e8f5e9" : "#fbe9e7";
  const borderColor = isCorrect ? "#4caf50" : "#f44336";
  const icon = isCorrect ? "✓" : "✗";
  const iconColor = isCorrect ? "#4caf50" : "#f44336";

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity },
      ]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: bgColor,
            borderColor,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
        <Text style={styles.label}>
          {isCorrect ? "Correct!" : "Incorrect"}
        </Text>
        <View style={styles.answerRow}>
          <Text style={styles.answer}>{answer}</Text>
          <Text style={styles.answerPinyin}>{answerPinyin}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 100,
  },
  card: {
    width: "80%",
    borderRadius: Dimens.borderRadius,
    borderWidth: 2,
    padding: Dimens.padding * 2,
    alignItems: "center",
  },
  icon: {
    fontSize: normalize(64),
    fontWeight: "bold",
    marginBottom: 8,
  },
  label: {
    fontSize: normalize(20),
    fontWeight: "600",
    color: "#1b1b1f",
    marginBottom: 16,
  },
  answerRow: {
    alignItems: "center",
  },
  answer: {
    fontSize: normalize(36),
    fontWeight: "bold",
    color: "#1b1b1f",
    marginBottom: 4,
  },
  answerPinyin: {
    fontSize: normalize(16),
    color: "#757575",
  },
});
