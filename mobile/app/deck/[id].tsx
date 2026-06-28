import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useDeckDetailStore } from "../../stores/useDeckDetailStore";
import { normalize, Dimens } from "../../lib/dimens";

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    deckName,
    deckDescription,
    flashcards,
    isLoading,
    loadDeck,
    removeFlashcard,
  } = useDeckDetailStore();

  useEffect(() => {
    if (id) loadDeck(id);
  }, [id]);

  const handleDelete = (flashcardId: string, answer: string) => {
    Alert.alert("Delete Card", `Delete flashcard "${answer}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeFlashcard(flashcardId),
      },
    ]);
  };

  const handleStartReview = () => {
    if (!id) return;
    router.push({ pathname: "/review", params: { deckId: id } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
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
          <Text style={styles.addBtnText}>+ Add Card</Text>
        </Pressable>
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
        <Pressable style={styles.reviewBtn} onPress={handleStartReview}>
          <Text style={styles.reviewBtnText}>Start Review</Text>
        </Pressable>
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
            onLongPress={() => handleDelete(item.id, item.answer)}
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
                Tap "+ Add Card" to create your first flashcard
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
  addBtn: {
    backgroundColor: "#005bbd",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnText: {
    color: "white",
    fontSize: normalize(14),
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
