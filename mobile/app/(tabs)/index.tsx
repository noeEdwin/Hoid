import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
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
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decks = useVocabularyStore((s) => s.decks);
  const totalCards = useVocabularyStore((s) => s.totalCards);
  const loadLocalData = useVocabularyStore((s) => s.loadLocalData);
  const isDeckReviewedToday = useSettingsStore((s) => s.isDeckReviewedToday);
  const getStreak = useSettingsStore((s) => s.getStreak);
  const streak = getStreak();

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
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
    router.push({ pathname: "/deck/[id]", params: { id: deckId } });
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
      }
      setSyncState(result.status);
      setSyncMessage(result.message);
      setToastState({
        visible: true,
        status: result.status,
        message: result.message,
      });
      resetTimerRef.current = setTimeout(() => {
        setSyncState("idle");
        setSyncMessage("");
        setToastState((current) => ({ ...current, visible: false }));
      }, 3000);
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
          onPress={() => router.push("/modal/create-deck")}
          className="bg-primary rounded-full w-9 h-9 items-center justify-center"
        >
          <Text className="text-white text-xl leading-none">+</Text>
        </Pressable>
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
      />
      <GlassDock />
    </SafeAreaView>
  );
}
