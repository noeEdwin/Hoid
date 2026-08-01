import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { RoleplayMessage } from "../stores/useRoleplayStore";

interface Props {
  message: RoleplayMessage;
  onReplay: (message: RoleplayMessage) => void;
}

export default function RoleplayChatBubble({ message, onReplay }: Props) {
  const [showPinyin, setShowPinyin] = useState(false);
  const isUser = message.sender === "user";
  const evaluation = message.evaluations?.[0];

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <LinearGradient
          colors={["rgba(0,91,189,0.94)", "rgba(118,34,229,0.86)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubble}
        >
          <Text style={styles.userText}>{message.text}</Text>
          {evaluation ? (
            <View style={styles.evaluationRow}>
              <Ionicons
                name={evaluation.passed ? "checkmark-circle" : "sparkles-outline"}
                size={15}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.evaluationText}>
                {evaluation.passed
                  ? `已使用 ${evaluation.target_token}`
                  : `下次试试 ${evaluation.target_token}`}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.aiRow}>
      <View style={styles.avatar}>
        <Ionicons name="sparkles" size={17} color="#005bbd" />
      </View>
      <BlurView intensity={35} tint="light" style={styles.aiBubble}>
        <View style={styles.aiBubbleInner}>
          <Text style={styles.aiText}>{message.text}</Text>
          {showPinyin && message.pinyin ? (
            <Text style={styles.pinyin}>{message.pinyin}</Text>
          ) : null}
          <View style={styles.actions}>
            {message.audioB64 ? (
              <Pressable
                onPress={() => onReplay(message)}
                accessibilityRole="button"
                accessibilityLabel="重播语音"
                hitSlop={10}
              >
                <Ionicons name="volume-medium-outline" size={19} color="#626575" />
              </Pressable>
            ) : null}
            {message.pinyin ? (
              <Pressable
                onPress={() => setShowPinyin((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel="显示拼音"
                hitSlop={10}
              >
                <Text style={[styles.pinyinAction, showPinyin && styles.pinyinActionActive]}>拼</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  aiRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    maxWidth: 720,
  },
  userRow: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
    maxWidth: 720,
    width: "100%",
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(0,91,189,0.09)",
    borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  aiBubble: {
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 21,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    maxWidth: "84%",
    overflow: "hidden",
  },
  aiBubbleInner: {
    backgroundColor: "rgba(255,255,255,0.62)",
    padding: 16,
  },
  aiText: {
    color: "#172438",
    fontSize: 17,
    lineHeight: 26,
  },
  pinyin: {
    color: "#626575",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  actions: {
    borderTopColor: "rgba(23,36,56,0.08)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 18,
    marginTop: 11,
    paddingTop: 9,
  },
  pinyinAction: {
    color: "#626575",
    fontSize: 13,
    fontWeight: "700",
  },
  pinyinActionActive: {
    color: "#005bbd",
  },
  userBubble: {
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 21,
    borderBottomRightRadius: 6,
    borderWidth: 1,
    maxWidth: "84%",
    padding: 16,
  },
  userText: {
    color: "white",
    fontSize: 17,
    lineHeight: 26,
  },
  evaluationRow: {
    alignItems: "center",
    borderTopColor: "rgba(255,255,255,0.2)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 5,
    marginTop: 9,
    paddingTop: 8,
  },
  evaluationText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: "600",
  },
});
