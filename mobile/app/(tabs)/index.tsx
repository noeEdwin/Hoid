import { useCallback } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useFocusEffect } from "expo-router";
import UserHeader from "../../components/UserHeader";
import DeckCarousel from "../../components/DeckCarousel";
import GlassDock from "../../components/GlassDock";
import { useVocabularyStore } from "../../stores/useVocabularyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";

export default function DashboardScreen() {
  const router = useRouter();
  const decks = useVocabularyStore((s) => s.decks);
  const totalCards = useVocabularyStore((s) => s.totalCards);
  const loadLocalData = useVocabularyStore((s) => s.loadLocalData);
  const isDeckReviewedToday = useSettingsStore((s) => s.isDeckReviewedToday);

  useFocusEffect(
    useCallback(() => {
      loadLocalData();
    }, [])
  );

  const handleStartReview = (deckId: string) => {
    router.push({ pathname: "/deck/[id]", params: { id: deckId } });
  };

  const decksWithStatus = decks.map((d) => ({
    ...d,
    isReviewedToday: isDeckReviewedToday(d.id),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <UserHeader totalCards={totalCards} streak={3} />

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
      </ScrollView>
      <GlassDock />
    </SafeAreaView>
  );
}
