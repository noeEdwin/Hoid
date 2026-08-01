import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { generateScenarioCardDraft } from "../../lib/api";
import { getAllDecks, getFlashcardsByDeck } from "../../lib/database";
import { saveScenarioCardLocally } from "../../lib/scenario-card";
import {
  findDraftDuplicate,
  supportsLocalDeckStorage,
  validateFlashcardDraft,
  type EditableFlashcardDraft,
} from "../../lib/scenario-form";
import type { Deck } from "../../lib/schema";

const EMPTY_DRAFT: EditableFlashcardDraft = {
  answer: "", answer_pinyin: "", sentence: "", sentence_pinyin: "", context: "", context_pinyin: "",
};

export default function ScenarioCardDraftModal() {
  const { scenarioTitle = "", scenarioDescription = "", word = "", pinyin = "" } = useLocalSearchParams<{
    scenarioTitle?: string; scenarioDescription?: string; word?: string; pinyin?: string;
  }>();
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditableFlashcardDraft>(EMPTY_DRAFT);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      setDraft(await generateScenarioCardDraft({
        scenario_title: scenarioTitle,
        scenario_description: scenarioDescription,
        word,
        pinyin,
      }));
    } catch (caught) {
      setDraft((current) => ({ ...current, answer: current.answer || word, answer_pinyin: current.answer_pinyin || pinyin }));
      setError(
        caught && typeof caught === "object" && "detail" in caught && typeof caught.detail === "string"
          ? `无法生成草稿：${caught.detail}`
          : "无法生成草稿，请手动补全后保存。当前编辑内容不会丢失。"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    generate();
    if (!supportsLocalDeckStorage(Platform.OS)) {
      setDeckError("网页版暂不支持本地卡组。请在 Android 或 iOS 应用中保存卡片。");
      return;
    }
    try {
      setDecks(getAllDecks());
    } catch {
      setDeckError("无法读取本地卡组。卡片草稿仍可继续编辑。请重启应用后再试。");
    }
  }, []);

  const update = (key: keyof EditableFlashcardDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const save = () => {
    if (deckError) return setError(deckError);
    const validationError = validateFlashcardDraft(draft, selectedDeckId);
    if (validationError) return setError(validationError);
    const selectedDeck = decks.find((deck) => deck.id === selectedDeckId)!;
    const duplicate = findDraftDuplicate(getFlashcardsByDeck(selectedDeck.id), draft);
    if (duplicate) {
      Alert.alert("可能已有相同卡片", `“${duplicate.answer ?? draft.answer}”已存在于“${selectedDeck.name}”。请先检查现有卡片。`, [{ text: "知道了" }]);
      return;
    }
    Alert.alert("保存到本地？", `确认把“${draft.answer.trim()}”保存到“${selectedDeck.name}”？`, [
      { text: "取消", style: "cancel" },
      { text: "确认保存", onPress: async () => {
        setIsSaving(true);
        setError(null);
        try {
          const result = await saveScenarioCardLocally(selectedDeck.id, draft);
          const notice = !result.audioSaved || !result.synced
            ? "卡片已保存在本机。音频或云端同步稍后可重试。"
            : "卡片、音频和云端同步均已完成。";
          Alert.alert("保存成功", notice, [{ text: "完成", onPress: () => router.back() }]);
        } catch {
          setError("本地保存失败，请检查卡片内容后重试。");
        } finally {
          setIsSaving(false);
        }
      } },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} disabled={isSaving}><Text style={styles.cancel}>取消</Text></Pressable>
          <Text style={styles.title}>检查卡片草稿</Text>
          <Pressable onPress={save} disabled={isSaving || isGenerating || !!deckError} style={[styles.saveButton, deckError && styles.disabledButton]}>
            {isSaving ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveText}>保存</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.sourceBox}>
            <Text style={styles.sourceLabel}>来自场景</Text>
            <Text style={styles.sourceTitle}>{scenarioTitle} · {word}</Text>
          </View>
          {isGenerating ? (
            <View style={styles.loading}><ActivityIndicator color="#005bbd" /><Text style={styles.loadingText}>正在生成可编辑草稿…</Text></View>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!isGenerating && error?.startsWith("无法生成") ? (
            <Pressable onPress={generate} style={styles.retry}><Ionicons name="refresh" size={16} color="#005bbd" /><Text style={styles.retryText}>重新生成</Text></Pressable>
          ) : null}

          <Field label="答案" value={draft.answer} onChangeText={(value) => update("answer", value)} placeholder="汉字答案" />
          <Field label="答案拼音" value={draft.answer_pinyin} onChangeText={(value) => update("answer_pinyin", value)} placeholder="例如：mǎi dān" />
          <Field label="挖空例句（必须包含 ___）" value={draft.sentence} onChangeText={(value) => update("sentence", value)} placeholder="例如：请问在哪里___？" />
          <Field label="例句拼音" value={draft.sentence_pinyin} onChangeText={(value) => update("sentence_pinyin", value)} placeholder="例句完整拼音" />
          <Field label="语境" value={draft.context} onChangeText={(value) => update("context", value)} placeholder="补充用法或例句" multiline />
          <Field label="语境拼音" value={draft.context_pinyin} onChangeText={(value) => update("context_pinyin", value)} placeholder="语境拼音" multiline />

          <Text style={styles.deckHeading}>选择卡组</Text>
          <Text style={styles.deckHelp}>必须明确选择一个现有本地卡组，不会自动创建或默认选择卡组。</Text>
          {deckError ? <Text style={styles.deckError}>{deckError}</Text> : null}
          {!deckError && decks.length === 0 ? <Text style={styles.empty}>目前没有本地卡组，请先创建卡组。</Text> : null}
          {decks.map((deck) => (
            <Pressable key={deck.id} onPress={() => setSelectedDeckId(deck.id)} style={[styles.deck, selectedDeckId === deck.id && styles.deckSelected]}>
              <View style={styles.radio}>{selectedDeckId === deck.id ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.flex}><Text style={styles.deckName}>{deck.name}</Text><Text style={styles.deckDescription}>{deck.description || "无说明"}</Text></View>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} textAlignVertical={multiline ? "top" : "center"} placeholderTextColor="#9ca1ad" style={[styles.input, multiline && styles.multiline]} /></>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { backgroundColor: "#f7f9fd", flex: 1 },
  header: { alignItems: "center", borderBottomColor: "#e4e9f0", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 11 }, cancel: { color: "#5f6572", fontSize: 16 }, title: { color: "#172438", fontSize: 18, fontWeight: "700" }, saveButton: { alignItems: "center", backgroundColor: "#005bbd", borderRadius: 10, minWidth: 58, paddingVertical: 8 }, disabledButton: { opacity: 0.45 }, saveText: { color: "white", fontWeight: "700" },
  content: { paddingBottom: 60, paddingHorizontal: 22 }, sourceBox: { backgroundColor: "#e8f2ff", borderRadius: 14, marginTop: 18, padding: 14 }, sourceLabel: { color: "#63768a", fontSize: 11, fontWeight: "700" }, sourceTitle: { color: "#005bbd", fontSize: 16, fontWeight: "800", marginTop: 4 }, loading: { alignItems: "center", flexDirection: "row", gap: 9, justifyContent: "center", paddingVertical: 22 }, loadingText: { color: "#526174" }, error: { color: "#b3261e", fontSize: 13, lineHeight: 19, marginTop: 12 }, retry: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 9 }, retryText: { color: "#005bbd", fontWeight: "700" },
  label: { color: "#303b4c", fontSize: 14, fontWeight: "700", marginBottom: 7, marginTop: 17 }, input: { backgroundColor: "white", borderColor: "#dfe5ed", borderRadius: 13, borderWidth: 1, color: "#172438", fontSize: 15, paddingHorizontal: 14, paddingVertical: 13 }, multiline: { minHeight: 72 },
  deckHeading: { color: "#253247", fontSize: 17, fontWeight: "800", marginTop: 27 }, deckHelp: { color: "#737d8c", fontSize: 12, lineHeight: 18, marginBottom: 10, marginTop: 5 }, empty: { color: "#b3261e", marginTop: 12 }, deck: { alignItems: "center", backgroundColor: "white", borderColor: "#e0e6ee", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, marginTop: 9, padding: 13 }, deckSelected: { backgroundColor: "#edf6ff", borderColor: "#5a9ddd" }, radio: { alignItems: "center", borderColor: "#7c8796", borderRadius: 9, borderWidth: 1.5, height: 18, justifyContent: "center", width: 18 }, radioDot: { backgroundColor: "#005bbd", borderRadius: 5, height: 10, width: 10 }, deckName: { color: "#253247", fontSize: 15, fontWeight: "700" }, deckDescription: { color: "#7b8390", fontSize: 11, marginTop: 2 },
  deckError: { backgroundColor: "#fff1e7", borderRadius: 10, color: "#9a4d16", fontSize: 12, lineHeight: 18, padding: 10 },
});
