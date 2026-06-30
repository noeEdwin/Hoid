import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDeck, getDeckById } from "../../lib/database";
import { useVocabularyStore } from "../../stores/useVocabularyStore";
import { normalize, Dimens } from "../../lib/dimens";

export default function CreateDeckModal() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const loadLocalData = useVocabularyStore((s) => s.loadLocalData);

  const isEditing = !!deckId;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (deckId) {
      const deck = getDeckById(deckId);
      if (deck) {
        setName(deck.name);
        setDescription(deck.description ?? "");
      }
    }
  }, [deckId]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (isEditing && deckId) {
      const { updateDeck } = require("../../stores/useVocabularyStore").useVocabularyStore.getState();
      updateDeck(deckId, trimmed, description.trim() || undefined);
    } else {
      createDeck(trimmed, description.trim() || undefined);
    }
    loadLocalData();
    router.back();
  };

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
            {isEditing ? "Edit Deck" : "New Deck"}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!name.trim()}
            style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
          >
            <Text
              style={[
                styles.createBtnText,
                !name.trim() && styles.createBtnTextDisabled,
              ]}
            >
              {isEditing ? "Save" : "Create"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. HSK 1, Travel Phrases"
            placeholderTextColor="#bdbdbd"
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this deck about?"
            placeholderTextColor="#bdbdbd"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
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
  createBtn: {
    backgroundColor: "#005bbd",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createBtnDisabled: {
    backgroundColor: "#e0e0e0",
  },
  createBtnText: {
    color: "white",
    fontSize: normalize(15),
    fontWeight: "600",
  },
  createBtnTextDisabled: {
    color: "#9e9e9e",
  },
  form: {
    paddingHorizontal: Dimens.padding,
    paddingTop: Dimens.gap,
  },
  label: {
    fontSize: normalize(14),
    fontWeight: "600",
    color: "#424242",
    marginBottom: 6,
    marginTop: 12,
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
  inputMultiline: {
    minHeight: 80,
  },
});
