import { useEffect, useRef, useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { createAudioPlayer } from "expo-audio";
import * as Speech from "expo-speech";
import ProgressBar from "../components/ProgressBar";
import ClozeInput from "../components/ClozeInput";
import { fillClozeSentence } from "../lib/cloze";
import { useReviewStore, type ReviewCard } from "../stores/useReviewStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { formatReviewInterval } from "../lib/srs";

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function stopAllAudio(playerRef: React.RefObject<ReturnType<typeof createAudioPlayer> | null>) {
  Speech.stop();
  if (playerRef.current) {
    try {
      playerRef.current.pause();
    } catch {}
    try {
      playerRef.current.remove();
    } catch {}
    playerRef.current = null;
  }
}

export default function ReviewScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { deckId, mode } = useLocalSearchParams<{ deckId: string; mode?: string }>();
  const reviewMode = mode === "practice" ? "practice" : "srs";
  const {
    isComplete,
    showResult,
    lastResultCorrect,
    completed,
    failedCards,
    answeredCount,
    deckExhaustedToday,
    resultMessage,
    resultSchedule,
    loadQueue,
    submitAnswer,
    dismissResult,
    getCurrentCard,
    getProgress,
    saveSession,
    clearSession,
    reviewMode: activeReviewMode,
  } = useReviewStore();
  const markDeckReviewed = useSettingsStore((s) => s.markDeckReviewed);
  const isDeckReviewedToday = useSettingsStore((s) => s.isDeckReviewedToday);

  const card = getCurrentCard();
  const progress = getProgress();
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [resultCard, setResultCard] = useState<ReviewCard | null>(null);
  const submittedCardRef = useRef<string | null>(null);
  const visibleCard = showResult ? resultCard : card;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (deckId) {
      loadQueue(deckId, reviewMode);
    }
  }, [deckId, reviewMode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      stopAllAudio(playerRef);
      if (deckId) {
        const state = useReviewStore.getState();
        if (state.reviewMode === "srs" && !state.isComplete) {
          state.saveSession();
        }
      }
    });
    return () => {
      unsubscribe();
      stopAllAudio(playerRef);
    };
  }, [navigation, deckId]);

  useEffect(() => {
    if (!deckId) return;

    const state = useReviewStore.getState();
    if (!state.isComplete || state.deckId !== deckId || state.answeredCount === 0) return;

    clearSession(deckId);
    if (state.reviewMode === "practice") return;
    markDeckReviewed(
      deckId,
      [...state.completed, ...state.failedCards].map((reviewedCard) => reviewedCard.id),
      state.deckExhaustedToday,
    );
  }, [isComplete, deckId, clearSession, markDeckReviewed]);

  useEffect(() => {
    if (reviewMode === "srs" && deckId && isDeckReviewedToday(deckId) && !isComplete) {
      const state = useReviewStore.getState();
      if (state.remaining.length === 0) {
        router.replace("/(tabs)");
      }
    }
  }, [deckId, isComplete, reviewMode]);

  const playAudio = useCallback(async (audioPath: string | null, sentence: string, answer: string) => {
    stopAllAudio(playerRef);

    const fullSentence = fillClozeSentence(sentence, answer);

    if (audioPath) {
      try {
        const player = createAudioPlayer({ uri: audioPath });
        playerRef.current = player;
        player.play();
        return;
      } catch (error) {
        console.warn("Stored audio playback failed, falling back to speech:", error);
        // fall through to speech
      }
    }

    Speech.speak(fullSentence, {
      language: "zh-CN",
      rate: 0.8,
    });
  }, []);

  const handleSubmit = (isCorrect: boolean) => {
    if (!card) return;
    if (submittedCardRef.current === card.id) return;

    submittedCardRef.current = card.id;
    setResultCard(card);
    submitAnswer(isCorrect);
    playAudio(card.audioPath, card.sentence, card.answer);
  };

  const handleNext = () => {
    setResultCard(null);
    submittedCardRef.current = null;
    dismissResult();
  };

  if (isComplete && answeredCount === 0) {
    return (
      <GestureHandlerRootView className="flex-1 bg-surface">
        <SafeAreaView className="flex-1 items-center justify-center px-6" edges={["top", "bottom"]}>
          <Text className="text-5xl mb-4">✓</Text>
          <Text className="text-3xl font-bold text-neutral-900 mb-2">No Cards Due</Text>
          <Text className="text-base text-neutral-500 text-center mb-8">
            This deck has no scheduled reviews right now.
          </Text>
          {deckId ? (
            <Pressable
              onPress={() => router.replace({ pathname: "/review", params: { deckId, mode: "practice" } })}
              className="w-full bg-primary rounded-2xl px-8 py-4 items-center mb-3"
            >
              <Text className="text-white text-lg font-semibold">Practice Anyway</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.back()}
            className="w-full bg-neutral-100 rounded-2xl px-8 py-4 items-center"
          >
            <Text className="text-neutral-700 text-lg font-semibold">Back to Deck</Text>
          </Pressable>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  if (isComplete) {
    return (
      <GestureHandlerRootView className="flex-1 bg-surface">
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
          <View className="px-6 pt-2 pb-3">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="self-start rounded-full bg-white px-4 py-2"
            >
              <Text className="text-primary text-base font-semibold">← Back</Text>
            </Pressable>
          </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-8">
            <Text className="text-6xl mb-4">🎉</Text>
            <Text className="text-3xl font-bold text-neutral-900 mb-1">
              {activeReviewMode === "practice" ? "Practice Complete" : "Great Job!"}
            </Text>
            <Text className="text-base text-neutral-500">
              {activeReviewMode === "practice"
                ? "No review schedule was changed"
                : "You completed your review session"}
            </Text>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-green-50 rounded-2xl p-4 items-center">
              <Text className="text-3xl font-bold text-green-600 mb-1">
                {progress.completedCount}
              </Text>
              <Text className="text-sm text-green-700">Correct</Text>
            </View>
            <View className="flex-1 bg-red-50 rounded-2xl p-4 items-center">
              <Text className="text-3xl font-bold text-red-500 mb-1">
                {progress.failedCount}
              </Text>
              <Text className="text-sm text-red-600">Abandoned</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-amber-50 rounded-2xl p-4 items-center">
              <Text className="text-3xl font-bold text-amber-600 mb-1">
                {progress.missedCount}
              </Text>
              <Text className="text-sm text-amber-700">Missed</Text>
            </View>
            <View className="flex-1 bg-blue-50 rounded-2xl p-4 items-center">
              <Text className="text-2xl font-bold text-blue-600 mb-1">
                {progress.accuracy}%
              </Text>
              <Text className="text-sm text-blue-700">Accuracy</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-8">
            <View className="flex-1 bg-purple-50 rounded-2xl p-4 items-center">
              <Text className="text-2xl font-bold text-purple-600 mb-1">
                {formatTime(progress.elapsedSeconds)}
              </Text>
              <Text className="text-sm text-purple-700">Time</Text>
            </View>
            <View className="flex-1" />
          </View>

          {failedCards.length > 0 && (
            <View className="mb-8">
              <Text className="text-sm font-semibold text-neutral-700 mb-3 px-1">
                Cards to review
              </Text>
              <View className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                {failedCards.map((fc, i) => (
                  <View
                    key={fc.id}
                    className={`px-4 py-3 ${i < failedCards.length - 1 ? "border-b border-neutral-100" : ""}`}
                  >
                    <Text className="text-neutral-900 text-base" numberOfLines={2}>
                      {fc.sentence}
                    </Text>
                    <Text className="text-neutral-400 text-sm mt-0.5">
                      {fc.answerPinyin}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeReviewMode === "srs" && completed.length > 0 && (
            <View className="mb-8">
              <Text className="text-sm font-semibold text-neutral-700 mb-3 px-1">
                Upcoming reviews
              </Text>
              <View className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                {completed.map((reviewedCard, index) => (
                  <View
                    key={reviewedCard.id}
                    className={`px-4 py-3 ${index < completed.length - 1 ? "border-b border-neutral-100" : ""}`}
                  >
                    <Text className="text-neutral-900 text-base" numberOfLines={1}>
                      {reviewedCard.answer}
                    </Text>
                    <Text className="text-neutral-500 text-sm mt-0.5">
                      Next review in {formatReviewInterval(reviewedCard.srsInterval)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View className="gap-3">
            {failedCards.length > 0 && (
              <Pressable
                onPress={() => {
                  if (deckId) {
                    clearSession(deckId);
                    router.replace({ pathname: "/deck/[id]", params: { id: deckId } });
                  }
                }}
                className="bg-primary rounded-2xl px-8 py-4 items-center"
              >
                <Text className="text-white text-lg font-semibold">
                  Practice Failed Cards
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.back()}
              className="bg-neutral-100 rounded-2xl px-8 py-4 items-center"
            >
              <Text className="text-neutral-700 text-lg font-semibold">
                Back to Dashboard
              </Text>
            </Pressable>
          </View>
        </ScrollView>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  if (!visibleCard) {
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
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ position: "absolute", top: 70, left: 24, zIndex: 10 }}
        >
          <Text className="text-primary text-lg">← Exit</Text>
        </Pressable>

        <ProgressBar current={progress.current + 1} total={progress.total} />

        <View className={`flex-1 items-center ${keyboardVisible ? "pt-8" : "justify-center"}`}>
          {visibleCard ? (
            <ClozeInput
              sentence={visibleCard.sentence}
              sentencePinyin={visibleCard.sentencePinyin}
              answer={visibleCard.answer}
              answerPinyin={visibleCard.answerPinyin}
              imagePath={visibleCard.imagePath}
              isResultVisible={showResult}
              isCorrect={lastResultCorrect}
              resultMessage={resultMessage}
              resultSchedule={resultSchedule}
              onSubmit={handleSubmit}
              onSpeak={() => playAudio(visibleCard.audioPath, visibleCard.sentence, visibleCard.answer)}
              onNext={handleNext}
            />
          ) : (
            null
          )}
        </View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}
