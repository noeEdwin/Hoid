import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Speech from "expo-speech";
import ProgressBar from "../components/ProgressBar";
import ClozeInput from "../components/ClozeInput";
import ReviewResult from "../components/ReviewResult";
import { useReviewStore } from "../stores/useReviewStore";

export default function ReviewScreen() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const {
    isComplete,
    showResult,
    lastResultCorrect,
    loadQueue,
    submitAnswer,
    dismissResult,
    getCurrentCard,
    getProgress,
  } = useReviewStore();

  const card = getCurrentCard();
  const progress = getProgress();

  useEffect(() => {
    if (deckId) {
      loadQueue(deckId);
    }
  }, [deckId]);

  const speakFullSentence = () => {
    if (!card) return;
    const full = card.sentence.replace("___", card.answer);
    Speech.speak(full, { language: "zh-CN", rate: 0.8 });
  };

  if (isComplete) {
    return (
      <GestureHandlerRootView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">🎉</Text>
          <Text className="text-3xl font-bold text-neutral-900 mb-2">
            Session Complete
          </Text>
          <Text className="text-lg text-neutral-600 mb-8">
            You reviewed {progress.total} cards
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-primary rounded-2xl px-8 py-4"
          >
            <Text className="text-white text-lg font-semibold">Back to Dashboard</Text>
          </Pressable>
        </View>
      </GestureHandlerRootView>
    );
  }

  if (!card) {
    return (
      <GestureHandlerRootView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-600">Loading cards...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1 bg-surface">
      <Pressable
        onPress={() => router.back()}
        style={{ position: "absolute", top: 70, left: 24, zIndex: 10 }}
      >
        <Text className="text-primary text-lg">← Exit</Text>
      </Pressable>

      <ProgressBar current={progress.current + 1} total={progress.total} />

      <View className="flex-1 items-center justify-center">
        {!showResult ? (
          <ClozeInput
            sentence={card.sentence}
            sentencePinyin={card.sentencePinyin}
            answer={card.answer}
            answerPinyin={card.answerPinyin}
            imagePath={card.imagePath}
            onSubmit={submitAnswer}
            onSpeak={speakFullSentence}
          />
        ) : (
          <ReviewResult
            isCorrect={lastResultCorrect}
            answer={card.answer}
            answerPinyin={card.answerPinyin}
            onDismiss={dismissResult}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}
