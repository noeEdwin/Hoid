import { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useDeckDetailStore } from "../../stores/useDeckDetailStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { normalize, Dimens } from "../../lib/dimens";

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    deckName,
    deckDescription,
    flashcards,
    isLoading,
    isImporting,
    loadDeck,
    removeFlashcard,
    removeDeck,
    bulkImportCards,
  } = useDeckDetailStore();
  const isDeckReviewedToday = useSettingsStore((s) => s.isDeckReviewedToday);
  const resetDeckReviewed = useSettingsStore((s) => s.resetDeckReviewed);

  const alreadyReviewedToday = id ? isDeckReviewedToday(id) : false;

  useFocusEffect(
    useCallback(() => {
      if (id) loadDeck(id);
    }, [id])
  );

  const handleDeleteCard = (flashcardId: string, answer: string) => {
    Alert.alert("Delete Card", `Delete flashcard "${answer}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeFlashcard(flashcardId),
      },
    ]);
  };

  const handleDeleteDeck = () => {
    Alert.alert("Delete Deck", `Delete "${deckName}" and all its cards?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeDeck();
          router.back();
        },
      },
    ]);
  };

  const handleEditDeck = () => {
    router.push({
      pathname: "/modal/create-deck",
      params: { deckId: id },
    });
  };

  const handleStartReview = () => {
    if (!id || alreadyReviewedToday) return;
    router.push({ pathname: "/review", params: { deckId: id } });
  };

  const handleResetReview = () => {
    if (!id) return;
    Alert.alert("Reset Review", "Allow reviewing this deck again today?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        onPress: () => resetDeckReviewed(id),
      },
    ]);
  };

  const handleImport = async () => {
    try {
      const result = await bulkImportCards();
      if (result) {
        Alert.alert(
          "Import Complete",
          `Created ${result.created} card${result.created !== 1 ? "s" : ""}.`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Import Unavailable",
          "File picker requires a development build. Run: npx expo run:android",
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      console.warn("Import failed:", e);
      Alert.alert("Import Failed", "Could not import cards. Check the file format.", [
        { text: "OK" },
      ]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={handleEditDeck} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Edit</Text>
          </Pressable>
          <Pressable onPress={handleDeleteDeck} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
          <Pressable onPress={handleImport} style={styles.importBtn} disabled={isImporting}>
            <Text style={styles.importBtnText}>{isImporting ? "..." : "Import"}</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/modal/create-flashcard",
                params: { deckId: id },
              })
            }
            style={styles.addBtn}
          >
            <Text style={styles.addBtnText}>+ Card</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.titleSection}>
        <Text style={styles.deckName}>{deckName}</Text>
        {deckDescription && (
          <Text style={styles.deckDescription}>{deckDescription}</Text>
        )}
        <Text style={styles.cardCount}>
          {flashcards.length} {flashcards.length === 1 ? "card" : "cards"}
        </Text>
      </View>

      {flashcards.length > 0 && (
        alreadyReviewedToday ? (
          <View style={styles.completedBanner}>
            <Text style={styles.completedIcon}>✅</Text>
            <Text style={styles.completedText}>Reviewed for today</Text>
            <Text style={styles.completedSubtext}>Come back tomorrow!</Text>
            <Pressable onPress={handleResetReview} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Review again</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.reviewBtn} onPress={handleStartReview}>
            <Text style={styles.reviewBtnText}>Start Review</Text>
          </Pressable>
        )
      )}

      <FlatList
        data={flashcards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.cardItem}
            onPress={() =>
              router.push({
                pathname: "/modal/create-flashcard",
                params: { deckId: id, flashcardId: item.id },
              })
            }
            onLongPress={() => handleDeleteCard(item.id, item.answer)}
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardSentence} numberOfLines={2}>
                {item.sentence}
              </Text>
              <Text style={styles.cardAnswer}>{item.answer}</Text>
              {item.answerPinyin && (
                <Text style={styles.cardPinyin}>{item.answerPinyin}</Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No cards yet</Text>
              <Text style={styles.emptySubtext}>
                Tap "+ Card" to create your first flashcard
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Dimens.padding,
    paddingTop: Dimens.gap,
  },
  backBtn: {
    paddingVertical: 8,
  },
  backText: {
    fontSize: normalize(16),
    color: "#005bbd",
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: {
    color: "#424242",
    fontSize: normalize(13),
    fontWeight: "600",
  },
  deleteBtn: {
    backgroundColor: "#fbe9e7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteBtnText: {
    color: "#f44336",
    fontSize: normalize(13),
    fontWeight: "600",
  },
  addBtn: {
    backgroundColor: "#005bbd",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: "white",
    fontSize: normalize(13),
    fontWeight: "600",
  },
  importBtn: {
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  importBtnText: {
    color: "#2e7d32",
    fontSize: normalize(13),
    fontWeight: "600",
  },
  titleSection: {
    paddingHorizontal: Dimens.padding,
    paddingTop: Dimens.gap,
    paddingBottom: Dimens.gap,
  },
  deckName: {
    fontSize: normalize(26),
    fontWeight: "700",
    color: "#1b1b1f",
    marginBottom: 4,
  },
  deckDescription: {
    fontSize: normalize(14),
    color: "#757575",
    marginBottom: 8,
  },
  cardCount: {
    fontSize: normalize(13),
    color: "#9e9e9e",
  },
  reviewBtn: {
    marginHorizontal: Dimens.padding,
    marginBottom: Dimens.gap,
    backgroundColor: "#005bbd",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  reviewBtnText: {
    color: "white",
    fontSize: normalize(16),
    fontWeight: "600",
  },
  completedBanner: {
    marginHorizontal: Dimens.padding,
    marginBottom: Dimens.gap,
    backgroundColor: "#e8f5e9",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#c8e6c9",
  },
  completedIcon: {
    fontSize: normalize(24),
    marginBottom: 4,
  },
  completedText: {
    fontSize: normalize(16),
    fontWeight: "600",
    color: "#2e7d32",
  },
  completedSubtext: {
    fontSize: normalize(13),
    color: "#4caf50",
    marginTop: 2,
  },
  resetBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#c8e6c9",
    borderRadius: 8,
  },
  resetBtnText: {
    fontSize: normalize(13),
    fontWeight: "600",
    color: "#2e7d32",
  },
  list: {
    paddingHorizontal: Dimens.padding,
    paddingBottom: 120,
  },
  cardItem: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: Dimens.gap,
    marginBottom: Dimens.gap,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    gap: 4,
  },
  cardSentence: {
    fontSize: normalize(17),
    fontWeight: "600",
    color: "#1b1b1f",
    marginBottom: 4,
  },
  cardAnswer: {
    fontSize: normalize(20),
    fontWeight: "700",
    color: "#005bbd",
  },
  cardPinyin: {
    fontSize: normalize(13),
    color: "#9e9e9e",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    fontSize: normalize(16),
    color: "#9e9e9e",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: normalize(13),
    color: "#bdbdbd",
  },
});
