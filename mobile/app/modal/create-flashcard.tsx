import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDeckDetailStore } from "../../stores/useDeckDetailStore";
import { useReviewStore } from "../../stores/useReviewStore";
import { getFlashcardById } from "../../lib/database";
import { normalize, Dimens } from "../../lib/dimens";

export default function CreateFlashcardModal() {
  const { deckId, flashcardId } = useLocalSearchParams<{
    deckId: string;
    flashcardId?: string;
  }>();
  const router = useRouter();
  const { addFlashcard, editFlashcard, isGeneratingAudio } = useDeckDetailStore();
  const injectCard = useReviewStore((s) => s.injectCard);

  const isEditing = !!flashcardId;

  const [sentence, setSentence] = useState("");
  const [sentencePinyin, setSentencePinyin] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerPinyin, setAnswerPinyin] = useState("");
  const [context, setContext] = useState("");
  const [contextPinyin, setContextPinyin] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (flashcardId) {
      const card = getFlashcardById(flashcardId);
      if (card) {
        setSentence(card.sentence ?? "");
        setSentencePinyin(card.sentencePinyin ?? "");
        setAnswer(card.answer ?? "");
        setAnswerPinyin(card.answerPinyin ?? "");
        setContext(card.context ?? "");
        setContextPinyin(card.contextPinyin ?? "");
      }
    }
  }, [flashcardId]);

  const handleSave = async () => {
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer || !deckId || isSaving) return;

    const data = {
      sentence: sentence.trim() || `___${trimmedAnswer}`,
      sentencePinyin: sentencePinyin.trim() || undefined,
      answer: trimmedAnswer,
      answerPinyin: answerPinyin.trim() || undefined,
      context: context.trim() || undefined,
      contextPinyin: contextPinyin.trim() || undefined,
    };

    setIsSaving(true);

    if (isEditing && flashcardId) {
      editFlashcard(flashcardId, data);
      setIsSaving(false);
      router.back();
    } else {
      await addFlashcard(data);

      const { flashcards } = useDeckDetailStore.getState();
      const newCard = flashcards[flashcards.length - 1];
      if (newCard && deckId) {
        injectCard({
          id: newCard.id,
          deckId,
          cardType: newCard.cardType,
          sentence: newCard.sentence,
          sentencePinyin: newCard.sentencePinyin,
          answer: newCard.answer,
          answerPinyin: newCard.answerPinyin,
          context: newCard.context,
          contextPinyin: newCard.contextPinyin,
          imagePath: null,
          audioPath: newCard.audioPath,
          srsInterval: 0,
          easeFactor: 2.5,
          difficultyScore: 0,
          totalReviews: 0,
          totalFailures: 0,
          consecutiveFailures: 0,
          consecutiveCorrect: 0,
        });
      }

      setIsSaving(false);
      router.back();
    }
  };

  const canSave = answer.trim().length > 0 && !isSaving;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9ff" }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>
            {isEditing ? "Edit Card" : "New Card"}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text
                style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        {isSaving && (
          <View style={styles.generatingContainer}>
            <ActivityIndicator size="small" color="#005bbd" />
            <Text style={styles.generatingText}>Generating audio...</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Sentence (use ___ for blank)</Text>
          <TextInput
            style={styles.input}
            value={sentence}
            onChangeText={setSentence}
            placeholder='e.g. 我___你'
            placeholderTextColor="#bdbdbd"
            returnKeyType="next"
          />

          <Text style={styles.label}>Sentence Pinyin</Text>
          <TextInput
            style={styles.input}
            value={sentencePinyin}
            onChangeText={setSentencePinyin}
            placeholder="e.g. wǒ ài nǐ"
            placeholderTextColor="#bdbdbd"
            returnKeyType="next"
          />

          <Text style={styles.label}>Answer (required)</Text>
          <TextInput
            style={styles.input}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Missing word in hanzi"
            placeholderTextColor="#bdbdbd"
            returnKeyType="next"
          />

          <Text style={styles.label}>Answer Pinyin</Text>
          <TextInput
            style={styles.input}
            value={answerPinyin}
            onChangeText={setAnswerPinyin}
            placeholder="e.g. ài"
            placeholderTextColor="#bdbdbd"
            returnKeyType="next"
          />

          <Text style={styles.label}>Context (optional)</Text>
          <TextInput
            style={styles.input}
            value={context}
            onChangeText={setContext}
            placeholder="Example usage"
            placeholderTextColor="#bdbdbd"
            returnKeyType="next"
          />

          <Text style={styles.label}>Context Pinyin</Text>
          <TextInput
            style={styles.input}
            value={contextPinyin}
            onChangeText={setContextPinyin}
            placeholder="Pinyin for context"
            placeholderTextColor="#bdbdbd"
            returnKeyType="done"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Dimens.padding,
    paddingVertical: Dimens.gap,
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: normalize(16),
    color: "#757575",
  },
  title: {
    fontSize: normalize(17),
    fontWeight: "600",
    color: "#1b1b1f",
  },
  saveBtn: {
    backgroundColor: "#005bbd",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnDisabled: {
    backgroundColor: "#e0e0e0",
  },
  saveBtnText: {
    color: "white",
    fontSize: normalize(15),
    fontWeight: "600",
  },
  saveBtnTextDisabled: {
    color: "#9e9e9e",
  },
  generatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  generatingText: {
    fontSize: normalize(13),
    color: "#005bbd",
  },
  form: {
    paddingHorizontal: Dimens.padding,
    paddingBottom: 40,
  },
  label: {
    fontSize: normalize(14),
    fontWeight: "600",
    color: "#424242",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: normalize(16),
    color: "#1b1b1f",
  },
});
