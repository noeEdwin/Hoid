import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect } from "expo-router";
import UserHeader from "../../components/UserHeader";
import DeckCarousel from "../../components/DeckCarousel";
import GlassDock from "../../components/GlassDock";
import ToastPopup from "../../components/ToastPopup";
import { useVocabularyStore } from "../../stores/useVocabularyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { performSync, type SyncStatus } from "../../lib/sync";
import { getTomorrowDueCards } from "../../lib/database";
import { useNavigateOnce } from "../../lib/useNavigateOnce";

type DashboardSyncState = "idle" | "syncing" | SyncStatus;
type ToastState = { visible: boolean; status: SyncStatus; message: string };

export default function DashboardScreen() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncState, setSyncState] = useState<DashboardSyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    status: "success",
    message: "",
  });
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigateOnce = useNavigateOnce();
  const decks = useVocabularyStore((s) => s.decks);
  const totalCards = useVocabularyStore((s) => s.totalCards);
  const loadLocalData = useVocabularyStore((s) => s.loadLocalData);
  const isDeckReviewedToday = useSettingsStore((s) => s.isDeckReviewedToday);
  const getStreak = useSettingsStore((s) => s.getStreak);
  const streak = getStreak();
  const [tomorrowCount, setTomorrowCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
      setTomorrowCount(getTomorrowDueCards().length);
    }, [])
  );

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleStartReview = (deckId: string) => {
    navigateOnce(() => router.push({ pathname: "/deck/[id]", params: { id: deckId } }));
  };

  const handleSync = useCallback(async () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    setToastState((current) => ({ ...current, visible: false }));
    setIsSyncing(true);
    setSyncState("syncing");
    setSyncMessage("正在同步...");
    try {
      const result = await performSync();
      if (result.pullOk || result.status === "success") {
        loadLocalData();
        setTomorrowCount(getTomorrowDueCards().length);
      }
      setSyncState(result.status);
      setSyncMessage(result.message);
      setToastState({
        visible: true,
        status: result.status,
        message: result.message,
      });
      const messageDurationMs = result.status === "success" ? 3000 : 15000;
      resetTimerRef.current = setTimeout(() => {
        setSyncState("idle");
        setSyncMessage("");
        setToastState((current) => ({ ...current, visible: false }));
      }, messageDurationMs);
    } finally {
      setIsSyncing(false);
    }
  }, [loadLocalData]);

  const decksWithStatus = decks
    .map((d) => ({
      ...d,
      isReviewedToday: isDeckReviewedToday(d.id),
    }))
    .sort((a, b) => (a.isReviewedToday ? 1 : b.isReviewedToday ? -1 : 0));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />
      <UserHeader
        totalCards={totalCards}
        streak={streak}
        isSyncing={isSyncing}
        onSync={handleSync}
        syncStatus={syncState}
        syncMessage={syncMessage}
      />

      <View className="flex-row items-center justify-between px-6 mb-3">
        <Text className="text-xl font-medium text-neutral-900">
          Your Decks
        </Text>
        <Pressable
          onPress={() => navigateOnce(() => router.push("/modal/create-deck"))}
          className="bg-primary rounded-full w-9 h-9 items-center justify-center"
        >
          <Text className="text-white text-xl leading-none">+</Text>
        </Pressable>
      </View>

      <View className="mx-6 mb-4 bg-blue-50 rounded-2xl px-4 py-3">
        <Text className="text-blue-900 font-semibold">明日预览</Text>
        <Text className="text-blue-700 mt-1">
          预计有 {tomorrowCount} 张卡片需要复习。困难卡片会优先出现。
        </Text>
      </View>

      {decks.length > 0 ? (
        <DeckCarousel decks={decksWithStatus} onStartReview={handleStartReview} />
      ) : (
        <View className="px-6 py-12 items-center">
          <Text className="text-neutral-600 text-sm">
            No decks yet. Create one or sync with backend.
          </Text>
        </View>
      )}
      <ToastPopup
        visible={toastState.visible}
        status={toastState.status}
        message={toastState.message}
        onPress={
          toastState.status === "success"
            ? undefined
            : () => setErrorDetails(toastState.message)
        }
      />
      <Modal
        visible={errorDetails !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorDetails(null)}
      >
        <View className="flex-1 bg-black/45 items-center justify-center px-6">
          <View className="w-full max-h-[75%] rounded-2xl bg-white p-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-neutral-900">同步错误</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭错误详情"
                onPress={() => setErrorDetails(null)}
                className="rounded-full bg-neutral-100 px-3 py-1"
              >
                <Text className="text-neutral-700">关闭</Text>
              </Pressable>
            </View>
            <ScrollView>
              <Text selectable className="text-sm leading-5 text-neutral-700">
                {errorDetails}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <GlassDock />
    </SafeAreaView>
  );
}
