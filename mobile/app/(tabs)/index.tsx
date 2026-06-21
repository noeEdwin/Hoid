import { useEffect } from "react";
import { ScrollView, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import UserHeader from "../../components/UserHeader";
import DeckCarousel from "../../components/DeckCarousel";
import GlassDock from "../../components/GlassDock";
import { useVocabularyStore } from "../../stores/useVocabularyStore";
import { initDatabase, seedLocalDeck } from "../../lib/database";

export default function DashboardScreen() {
  const router = useRouter();
  const decks = useVocabularyStore((s) => s.decks);
  const totalCards = useVocabularyStore((s) => s.totalCards);
  const loadLocalData = useVocabularyStore((s) => s.loadLocalData);

  useEffect(() => {
    initDatabase().then(() => {
      seedLocalDeck();
      loadLocalData();
    });
  }, []);

  const handleStartReview = (deckId: string) => {
    router.push({ pathname: "/review", params: { deckId } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <UserHeader totalCards={totalCards} streak={3} />

        <View className="px-6 mb-3">
          <Text className="text-xl font-medium text-neutral-900">
            Your Decks
          </Text>
        </View>

        {decks.length > 0 ? (
          <DeckCarousel decks={decks} onStartReview={handleStartReview} />
        ) : (
          <View className="px-6 py-12 items-center">
            <Text className="text-neutral-600 text-sm">
              No decks yet. Sync with backend to get started.
            </Text>
          </View>
        )}
      </ScrollView>
      <GlassDock />
    </SafeAreaView>
  );
}
