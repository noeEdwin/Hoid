import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

type ToastStatus = "success" | "partial" | "failure";

interface ToastPopupProps {
  visible: boolean;
  status: ToastStatus;
  message: string;
  onPress?: () => void;
}

const palette: Record<ToastStatus, { bg: string; border: string; text: string }> = {
  success: { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  partial: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  failure: { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
};

export default function ToastPopup({
  visible,
  status,
  message,
  onPress,
}: ToastPopupProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 18,
        duration: visible ? 180 : 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  if (!message) {
    return null;
  }

  const colors = palette[status];

  return (
    <View pointerEvents={onPress ? "auto" : "none"} style={styles.container}>
      <Pressable testID="sync-toast-button" onPress={onPress} disabled={!onPress}>
        <Animated.View
          testID="sync-toast"
          style={[
            styles.toast,
            {
              backgroundColor: colors.bg,
              borderColor: colors.border,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[styles.message, { color: colors.text }]}
          >
            {message}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 92,
    alignItems: "center",
    zIndex: 40,
  },
  toast: {
    minHeight: 44,
    maxWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  message: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
