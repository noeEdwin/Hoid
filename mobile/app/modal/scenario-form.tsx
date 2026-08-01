import { useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { RoleplayDifficulty, RoleplayScenarioInput } from "../../lib/api";
import {
  normalizeScenarioTargets,
  validateScenarioInput,
  validateScenarioRecommendationInput,
} from "../../lib/scenario-form";
import { useRoleplayStore } from "../../stores/useRoleplayStore";

const DIFFICULTIES: Array<{ value: RoleplayDifficulty; label: string }> = [
  { value: "beginner", label: "入门" },
  { value: "intermediate", label: "进阶" },
  { value: "advanced", label: "挑战" },
];

export default function ScenarioFormModal() {
  const { scenarioId } = useLocalSearchParams<{ scenarioId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const scenario = useRoleplayStore((state) => state.scenarios.find((item) => item.id === scenarioId));
  const {
    createScenario,
    updateScenario,
    isMutatingScenario,
    scenarioMutationError,
    recommendations,
    isLoadingRecommendations,
    recommendationError,
    loadRecommendations,
    clearRecommendations,
    clearScenarioMutationError,
  } = useRoleplayStore();
  const [title, setTitle] = useState(scenario?.title ?? "");
  const [description, setDescription] = useState(scenario?.description ?? "");
  const [difficulty, setDifficulty] = useState<RoleplayDifficulty>(scenario?.difficulty ?? "beginner");
  const [targets, setTargets] = useState(() => scenario?.target_grammar ?? []);
  const [targetInput, setTargetInput] = useState("");
  const [examplePrompt, setExamplePrompt] = useState(scenario?.example_prompt ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const allowClose = useRef(false);
  const initialValue = useRef(JSON.stringify({
    title: scenario?.title ?? "",
    description: scenario?.description ?? "",
    difficulty: scenario?.difficulty ?? "beginner",
    targets: scenario?.target_grammar ?? [],
    examplePrompt: scenario?.example_prompt ?? "",
  }));
  const currentValue = JSON.stringify({ title, description, difficulty, targets, examplePrompt });
  const isDirty = currentValue !== initialValue.current;

  useEffect(() => {
    clearRecommendations();
    clearScenarioMutationError();
  }, [clearRecommendations, clearScenarioMutationError]);

  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (allowClose.current || !isDirty || isMutatingScenario) return;
    event.preventDefault();
    Alert.alert("放弃修改？", "尚未保存的内容将会丢失。", [
      { text: "继续编辑", style: "cancel" },
      { text: "放弃", style: "destructive", onPress: () => {
        allowClose.current = true;
        navigation.dispatch(event.data.action);
      } },
    ]);
  }), [navigation, isDirty, isMutatingScenario]);

  const addTarget = (value: string) => {
    const next = normalizeScenarioTargets([...targets, value]);
    if (next.length === targets.length) return;
    setTargets(next);
    setTargetInput("");
    setValidationError(null);
  };

  const getInput = (): RoleplayScenarioInput => ({
    title: title.trim(),
    description: description.trim(),
    difficulty,
    target_grammar: normalizeScenarioTargets(targets),
    example_prompt: examplePrompt.trim() || null,
  });

  const save = async () => {
    const input = getInput();
    const error = validateScenarioInput(input);
    if (error) return setValidationError(error);
    const saved = scenarioId
      ? await updateScenario(scenarioId, input)
      : await createScenario(input);
    if (saved) {
      allowClose.current = true;
      router.back();
    }
  };

  const recommend = async () => {
    const input = {
      title: title.trim(),
      description: description.trim(),
      difficulty,
      selected_targets: normalizeScenarioTargets(targets),
    };
    const error = validateScenarioRecommendationInput(input);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    await loadRecommendations(input);
  };

  const openDraft = (word: string, pinyin: string) => router.push({
    pathname: "/modal/scenario-card-draft",
    params: { scenarioTitle: title.trim(), scenarioDescription: description.trim(), word, pinyin },
  });

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} disabled={isMutatingScenario} hitSlop={10}>
            <Text style={styles.cancel}>取消</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{scenarioId ? "编辑场景" : "新建场景"}</Text>
          <Pressable onPress={save} disabled={isMutatingScenario} style={styles.saveButton}>
            {isMutatingScenario ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.saveText}>保存</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>场景名称</Text>
          <TextInput value={title} onChangeText={setTitle} maxLength={80} style={styles.input} placeholder="例如：在花店买花" placeholderTextColor="#9ca1ad" />
          <Text style={styles.label}>场景说明</Text>
          <TextInput value={description} onChangeText={setDescription} maxLength={1000} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" placeholder="说明人物、地点和对话目标" placeholderTextColor="#9ca1ad" />
          <Text style={styles.characterCount}>{description.length}/1000</Text>

          <Text style={styles.label}>难度</Text>
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((item) => (
              <Pressable key={item.value} onPress={() => setDifficulty(item.value)} style={[styles.choiceChip, difficulty === item.value && styles.choiceChipActive]}>
                <Text style={[styles.choiceText, difficulty === item.value && styles.choiceTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.label}>练习目标</Text>
            <Text style={styles.counter}>{targets.length}/10</Text>
          </View>
          <View style={styles.targetWrap}>
            {targets.map((target) => (
              <View key={target} style={styles.targetChip}>
                <Text style={styles.targetText}>{target}</Text>
                <Pressable onPress={() => setTargets(targets.filter((item) => item !== target))} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#456484" />
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput value={targetInput} onChangeText={setTargetInput} maxLength={40} style={[styles.input, styles.addInput]} placeholder="输入词语或语法结构" placeholderTextColor="#9ca1ad" onSubmitEditing={() => addTarget(targetInput)} />
            <Pressable onPress={() => addTarget(targetInput)} disabled={!targetInput.trim() || targets.length >= 10} style={styles.addButton}>
              <Text style={styles.addText}>添加</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>开场白（可选）</Text>
          <TextInput value={examplePrompt} onChangeText={setExamplePrompt} maxLength={300} style={styles.input} placeholder="例如：您好，想买什么花？" placeholderTextColor="#9ca1ad" />

          <Pressable onPress={recommend} disabled={!title.trim() || !description.trim() || isLoadingRecommendations} style={[styles.recommendButton, (!title.trim() || !description.trim()) && styles.disabled]}>
            {isLoadingRecommendations ? <ActivityIndicator color="#005bbd" /> : <Ionicons name="sparkles-outline" size={19} color="#005bbd" />}
            <Text style={styles.recommendText}>{isLoadingRecommendations ? "正在分析本地学习记录…" : "推荐练习目标"}</Text>
          </Pressable>
          {recommendationError ? <Text style={styles.error}>{recommendationError}</Text> : null}

          {recommendations ? (
            <View style={styles.recommendations}>
              <Text style={styles.recommendTitle}>现有困难卡片</Text>
              <Text style={styles.help}>仅作动态预览；轻点可把词语加入目标，不会保存卡片 ID。</Text>
              {recommendations.existing_cards.map((card) => (
                <Pressable key={card.flashcard_id} onPress={() => addTarget(card.word)} style={styles.recommendCard}>
                  <View style={styles.flex}>
                    <Text style={styles.word}>{card.word} <Text style={styles.pinyin}>{card.pinyin}</Text></Text>
                    <Text style={styles.sentence}>{card.sentence}</Text>
                  </View>
                  <Text style={styles.score}>{Math.round(card.difficulty_score * 100)}%</Text>
                </Pressable>
              ))}
              <Text style={styles.recommendTitle}>新词建议</Text>
              {recommendations.suggested_new.map((suggestion) => (
                <View key={`${suggestion.word}-${suggestion.pinyin}`} style={styles.suggestionCard}>
                  <Text style={styles.word}>{suggestion.word} <Text style={styles.pinyin}>{suggestion.pinyin}</Text></Text>
                  <Text style={styles.sentence}>{suggestion.reason}</Text>
                  <Text style={styles.structure}>{suggestion.suggested_structure}</Text>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => addTarget(suggestion.word)} style={styles.smallAction}><Text style={styles.smallActionText}>加入目标</Text></Pressable>
                    <Pressable onPress={() => openDraft(suggestion.word, suggestion.pinyin)} style={styles.primarySmallAction}><Text style={styles.primarySmallText}>制作卡片</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {validationError || scenarioMutationError ? <Text style={styles.error}>{validationError ?? scenarioMutationError}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, screen: { backgroundColor: "#f7f9fd", flex: 1 },
  header: { alignItems: "center", borderBottomColor: "#e5e9f0", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 11 },
  cancel: { color: "#5f6572", fontSize: 16 }, headerTitle: { color: "#172438", fontSize: 18, fontWeight: "700" },
  saveButton: { alignItems: "center", backgroundColor: "#005bbd", borderRadius: 10, minWidth: 58, paddingHorizontal: 14, paddingVertical: 8 }, saveText: { color: "white", fontWeight: "700" },
  content: { paddingBottom: 60, paddingHorizontal: 22 }, label: { color: "#303b4c", fontSize: 14, fontWeight: "700", marginBottom: 7, marginTop: 18 },
  input: { backgroundColor: "white", borderColor: "#dfe5ed", borderRadius: 13, borderWidth: 1, color: "#172438", fontSize: 15, paddingHorizontal: 14, paddingVertical: 13 }, multiline: { minHeight: 92 },
  characterCount: { color: "#858c98", fontSize: 11, marginTop: 5, textAlign: "right" },
  chipRow: { flexDirection: "row", gap: 9 }, choiceChip: { backgroundColor: "#edf1f6", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 }, choiceChipActive: { backgroundColor: "#005bbd" }, choiceText: { color: "#566071", fontWeight: "700" }, choiceTextActive: { color: "white" },
  sectionHeading: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" }, counter: { color: "#77808f", fontSize: 12, marginBottom: 7 }, targetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, targetChip: { alignItems: "center", backgroundColor: "#e5f1ff", borderRadius: 18, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 7 }, targetText: { color: "#005bbd", fontWeight: "700" },
  addRow: { flexDirection: "row", gap: 9, marginTop: 10 }, addInput: { flex: 1 }, addButton: { alignItems: "center", backgroundColor: "#dcecff", borderRadius: 12, justifyContent: "center", paddingHorizontal: 17 }, addText: { color: "#005bbd", fontWeight: "700" },
  recommendButton: { alignItems: "center", backgroundColor: "#e8f2ff", borderColor: "#c6def9", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 24, minHeight: 50 }, recommendText: { color: "#005bbd", fontWeight: "700" }, disabled: { opacity: 0.45 },
  error: { color: "#b3261e", fontSize: 13, lineHeight: 19, marginTop: 12 }, recommendations: { marginTop: 24 }, recommendTitle: { color: "#253247", fontSize: 16, fontWeight: "800", marginBottom: 8, marginTop: 10 }, help: { color: "#747d8b", fontSize: 12, lineHeight: 18, marginBottom: 8 },
  recommendCard: { alignItems: "center", backgroundColor: "white", borderColor: "#e2e8f0", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginBottom: 8, padding: 13 }, word: { color: "#172438", fontSize: 16, fontWeight: "800" }, pinyin: { color: "#707989", fontSize: 12, fontWeight: "500" }, sentence: { color: "#687283", fontSize: 12, lineHeight: 18, marginTop: 4 }, score: { color: "#a14b00", fontSize: 12, fontWeight: "800" },
  suggestionCard: { backgroundColor: "white", borderColor: "#e2e8f0", borderRadius: 16, borderWidth: 1, marginBottom: 10, padding: 14 }, structure: { color: "#6941a5", fontSize: 12, marginTop: 6 }, actionRow: { flexDirection: "row", gap: 9, justifyContent: "flex-end", marginTop: 12 }, smallAction: { borderColor: "#b8c8da", borderRadius: 9, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, smallActionText: { color: "#3e5875", fontSize: 12, fontWeight: "700" }, primarySmallAction: { backgroundColor: "#005bbd", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 }, primarySmallText: { color: "white", fontSize: 12, fontWeight: "700" },
});
