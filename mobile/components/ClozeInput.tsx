import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { normalize, Dimens } from "../lib/dimens";

interface ClozeInputProps {
  sentence: string;
  sentencePinyin: string;
  answer: string;
  answerPinyin: string;
  imagePath?: string | null;
  onSubmit: (isCorrect: boolean) => void;
  onSpeak: () => void;
}

function hideAnswerPinyin(fullPinyin: string, answerPinyin: string): string {
  const words = fullPinyin.split(/\s+/);
  const answerWords = answerPinyin.split(/\s+/);
  if (answerWords.length === 1) {
    const idx = words.indexOf(answerWords[0]);
    if (idx !== -1) {
      words[idx] = "___";
      return words.join(" ");
    }
  }
  const cleaned = fullPinyin.replace(answerPinyin, "___");
  return cleaned.replace(/\s+/g, " ").trim();
}

export default function ClozeInput({
  sentence,
  sentencePinyin,
  answer,
  answerPinyin,
  imagePath,
  onSubmit,
  onSpeak,
}: ClozeInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const isCorrect = trimmed === answer;
    Haptics.impactAsync(
      isCorrect
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy
    );
    onSubmit(isCorrect);
    setInput("");
  };

  const parts = sentence.split("___");
  const hiddenPinyin = hideAnswerPinyin(sentencePinyin, answerPinyin);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {imagePath ? (
          <Text style={styles.emoji}>{imagePath}</Text>
        ) : null}

        <View style={styles.sentenceRow}>
          {parts.map((part, i) => (
            <Text key={i} style={styles.sentenceText}>
              {part}
              {i < parts.length - 1 && (
                <Text style={styles.blank}>{input || "___"}</Text>
              )}
            </Text>
          ))}
        </View>

        <Text style={styles.pinyin}>{hiddenPinyin}</Text>

        <Pressable style={styles.speakBtn} onPress={onSpeak}>
          <Text style={styles.speakIcon}>🔊</Text>
        </Pressable>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          placeholder="Type the missing word in hanzi..."
          placeholderTextColor="#bdbdbd"
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
        >
          <Text style={styles.submitText}>Submit</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: Dimens.padding,
  },
  card: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: Dimens.borderRadius,
    padding: Dimens.padding * 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
    alignItems: "center",
  },
  emoji: {
    fontSize: normalize(64),
    marginBottom: 16,
  },
  sentenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 12,
  },
  sentenceText: {
    fontSize: normalize(28),
    fontWeight: "600",
    color: "#1b1b1f",
    lineHeight: normalize(40),
  },
  blank: {
    color: "#005bbd",
    borderBottomWidth: 2,
    borderBottomColor: "#005bbd",
    minWidth: normalize(40),
  },
  pinyin: {
    fontSize: normalize(16),
    color: "#757575",
    textAlign: "center",
    marginBottom: 8,
  },
  speakBtn: {
    backgroundColor: "#f0f3ff",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  speakIcon: {
    fontSize: 22,
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: normalize(20),
    color: "#1b1b1f",
    textAlign: "center",
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  submitBtn: {
    width: "100%",
    backgroundColor: "#005bbd",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: {
    backgroundColor: "#bdbdbd",
  },
  submitText: {
    color: "white",
    fontSize: normalize(16),
    fontWeight: "600",
  },
});
