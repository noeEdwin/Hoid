import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";

interface Props {
  isRecording: boolean;
  isProcessing: boolean;
  isConnected: boolean;
  durationMillis: number;
  onPress: () => void;
}

export default function RoleplayMicButton({
  isRecording,
  isProcessing,
  isConnected,
  durationMillis,
  onPress,
}: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(pulse, {
        duration: 1300,
        toValue: 1,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [isRecording, pulse]);

  const label = isRecording
    ? `正在聆听 · ${Math.floor(durationMillis / 1000)}秒`
    : isProcessing
      ? "正在思考…"
      : isConnected
        ? "点击说话"
        : "正在连接…";

  return (
    <View style={styles.container}>
      {isRecording ? (
        <Animated.View
          style={[
            styles.pulse,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) },
              ],
            },
          ]}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={isProcessing || !isConnected}
        accessibilityRole="button"
        accessibilityLabel={isRecording ? "停止录音" : "开始录音"}
        style={({ pressed }) => [styles.outer, pressed && styles.outerPressed]}
      >
        <LinearGradient
          colors={isRecording ? ["#d82b5f", "#9d174d"] : ["#2376d2", "#7622e5"]}
          style={styles.inner}
        >
          <Ionicons name={isRecording ? "stop" : "mic"} size={31} color="white" />
        </LinearGradient>
      </Pressable>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    height: 130,
    justifyContent: "flex-start",
  },
  pulse: {
    backgroundColor: "rgba(0,91,189,0.2)",
    borderRadius: 48,
    height: 96,
    position: "absolute",
    width: 96,
  },
  outer: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "white",
    borderRadius: 48,
    borderWidth: 1,
    elevation: 8,
    height: 96,
    justifyContent: "center",
    shadowColor: "#283d68",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    width: 96,
  },
  outerPressed: {
    transform: [{ scale: 0.97 }],
  },
  inner: {
    alignItems: "center",
    borderRadius: 33,
    height: 66,
    justifyContent: "center",
    width: 66,
  },
  label: {
    color: "#626575",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
});
