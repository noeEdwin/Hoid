import { useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRoleplayStore } from "../../stores/useRoleplayStore";
import type { ApiRoleplayScenario, RoleplayDifficulty } from "../../lib/api";

const DIFFICULTY_LABEL: Record<RoleplayDifficulty, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "挑战",
};

const SCENARIO_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  在咖啡店: "cafe-outline",
  在餐馆点菜: "restaurant-outline",
  问路: "navigate-outline",
  酒店入住: "bed-outline",
  看医生: "medkit-outline",
};

function ScenarioCard({
  scenario,
  onPress,
}: {
  scenario: ApiRoleplayScenario;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`选择${scenario.title}`}
      style={({ pressed }) => [styles.scenarioCard, pressed && styles.cardPressed]}
    >
      <View style={styles.scenarioIcon}>
        <Ionicons
          name={SCENARIO_ICON[scenario.title] ?? "chatbubble-ellipses-outline"}
          color="#005bbd"
          size={25}
        />
      </View>
      <View style={styles.scenarioCopy}>
        <View style={styles.scenarioTitleRow}>
          <Text style={styles.scenarioTitle}>{scenario.title}</Text>
          <View style={styles.difficultyBadge}>
            <Text style={styles.difficultyText}>{DIFFICULTY_LABEL[scenario.difficulty]}</Text>
          </View>
        </View>
        <Text style={styles.scenarioDescription} numberOfLines={2}>
          {scenario.description}
        </Text>
        <View style={styles.tokenRow}>
          {scenario.target_grammar.slice(0, 3).map((token) => (
            <Text key={token} style={styles.token}>{token}</Text>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" color="#9598a6" size={20} />
    </Pressable>
  );
}

export default function ScenarioListScreen() {
  const router = useRouter();
  const {
    scenarios,
    selectedScenario,
    isLoadingScenarios,
    isPreparingTargets,
    isStarting,
    isMutatingScenario,
    scenarioMutationError,
    focusWords,
    preparedScenarioId,
    error,
    loadScenarios,
    selectScenario,
    prepareTargets,
    startSession,
    clearError,
    archiveScenario,
    clearScenarioMutationError,
  } = useRoleplayStore();
  const isPrepared = selectedScenario?.id === preparedScenarioId;

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  const handleStart = async () => {
    if (!selectedScenario) return;
    const started = await startSession(selectedScenario.id);
    if (started) router.push("/roleplay/session");
  };

  const handlePrepare = async () => {
    if (!selectedScenario) return;
    await prepareTargets(selectedScenario.id);
  };

  const handleArchive = () => {
    if (!selectedScenario) return;
    const scenario = selectedScenario;
    Alert.alert(
      "归档这个场景？",
      `“${scenario.title}”将从场景列表中移除，过去的对话记录会保留。`,
      [
        { text: "取消", style: "cancel" },
        { text: "归档", style: "destructive", onPress: () => archiveScenario(scenario.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.orb} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={23} color="#005bbd" />
        </Pressable>
        <View>
          <Text style={styles.headerKicker}>ROLEPLAY</Text>
          <Text style={styles.headerTitle}>选择场景</Text>
        </View>
        <Pressable
          onPress={() => router.push("/modal/scenario-form")}
          disabled={isMutatingScenario}
          accessibilityLabel="新建场景"
          style={styles.headerButton}
        >
          <Ionicons name="add" size={25} color="#005bbd" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>选一个你今天想进入的世界。困难词会自动融入对话。</Text>

        {isLoadingScenarios && scenarios.length === 0 ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#005bbd" />
            <Text style={styles.stateText}>正在加载场景…</Text>
          </View>
        ) : null}

        {!isLoadingScenarios && error && scenarios.length === 0 ? (
          <View style={styles.centerState}>
            <View style={styles.stateIcon}>
              <Ionicons name="cloud-offline-outline" size={28} color="#626575" />
            </View>
            <Text style={styles.stateTitle}>暂时无法连接</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable
              onPress={() => {
                clearError();
                loadScenarios();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>重新加载</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoadingScenarios && !error && scenarios.length === 0 ? (
          <View style={styles.centerState}>
            <View style={styles.stateIcon}><Ionicons name="planet-outline" size={29} color="#005bbd" /></View>
            <Text style={styles.stateTitle}>还没有场景</Text>
            <Text style={styles.stateText}>创建一个生活情境，设置你想练习的词语和语法。</Text>
            <Pressable onPress={() => router.push("/modal/scenario-form")} style={styles.retryButton}>
              <Text style={styles.retryText}>新建场景</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onPress={() => selectScenario(scenario)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={selectedScenario !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !isStarting && !isPreparingTargets && !isMutatingScenario && selectScenario(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !isStarting && !isPreparingTargets && !isMutatingScenario && selectScenario(null)}
          />
          <View style={styles.previewSheet}>
            <View style={styles.sheetHandle} />
            {selectedScenario ? (
              <>
                <LinearGradient
                  colors={["#e3f1ff", "#eee8ff"]}
                  style={styles.previewIcon}
                >
                  <Ionicons
                    name={SCENARIO_ICON[selectedScenario.title] ?? "chatbubble-ellipses-outline"}
                    color="#005bbd"
                    size={34}
                  />
                </LinearGradient>
                <Text style={styles.previewTitle}>{selectedScenario.title}</Text>
                <Text style={styles.previewDescription}>{selectedScenario.description}</Text>
                <View style={styles.managementRow}>
                  <Pressable
                    onPress={() => {
                      clearScenarioMutationError();
                      router.push({ pathname: "/modal/scenario-form", params: { scenarioId: selectedScenario.id } });
                    }}
                    disabled={isMutatingScenario || isStarting || isPreparingTargets}
                    style={styles.managementButton}
                  >
                    <Ionicons name="create-outline" size={17} color="#315475" />
                    <Text style={styles.managementText}>编辑</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleArchive}
                    disabled={isMutatingScenario || isStarting || isPreparingTargets}
                    style={[styles.managementButton, styles.archiveButton]}
                  >
                    {isMutatingScenario ? <ActivityIndicator size="small" color="#a33932" /> : <Ionicons name="archive-outline" size={17} color="#a33932" />}
                    <Text style={styles.archiveText}>归档</Text>
                  </Pressable>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>你的角色</Text>
                    <Text style={styles.detailValue}>对话参与者</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>难度</Text>
                    <Text style={styles.detailValue}>
                      {DIFFICULTY_LABEL[selectedScenario.difficulty]}
                    </Text>
                  </View>
                </View>

                {isPrepared ? (
                  <>
                    <Text style={styles.targetsLabel}>本次重点</Text>
                    <View style={styles.focusList}>
                      {focusWords.map((focusWord, index) => (
                        <View
                          key={`${focusWord.source}-${focusWord.flashcard_id ?? focusWord.word}-${index}`}
                          style={[
                            styles.focusWord,
                            focusWord.source === "scenario" && styles.scenarioFocusWord,
                          ]}
                        >
                          <View style={styles.focusWordCopy}>
                            <Text style={[
                              styles.focusWordText,
                              focusWord.source === "scenario" && styles.scenarioFocusWordText,
                            ]}>
                              {focusWord.word}
                            </Text>
                            {focusWord.pinyin ? (
                              <Text style={styles.focusWordPinyin}>{focusWord.pinyin}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.focusWordSource}>
                            {focusWord.source === "flashcard" ? "复习词" : "场景词"}
                          </Text>
                        </View>
                      ))}
                      {focusWords.length === 0 ? (
                        <Text style={styles.emptyTargets}>本次没有额外重点词，可以直接开始。</Text>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.targetsLabel}>场景目标</Text>
                    <View style={styles.previewTokens}>
                      {selectedScenario.target_grammar.map((token) => (
                        <View key={token} style={styles.previewToken}>
                          <Text style={styles.previewTokenText}>{token}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {error ? <Text style={styles.startError}>{error}</Text> : null}
                {scenarioMutationError ? <Text style={styles.startError}>{scenarioMutationError}</Text> : null}
                <Pressable
                  onPress={isPrepared ? handleStart : handlePrepare}
                  disabled={isStarting || isPreparingTargets || isMutatingScenario}
                  style={[
                    styles.startButton,
                    (isStarting || isPreparingTargets || isMutatingScenario) && styles.startButtonDisabled,
                  ]}
                >
                  {isStarting || isPreparingTargets ? (
                    <>
                      <ActivityIndicator color="white" />
                      <Text style={styles.startText}>
                        {isStarting ? "正在开始对话…" : "正在同步并准备…"}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={19} color="white" />
                      <Text style={styles.startText}>
                        {isPrepared ? "开始对话" : error ? "重试准备" : "准备对话"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f9f9ff", flex: 1 },
  orb: { backgroundColor: "rgba(118,34,229,0.07)", borderRadius: 170, height: 340, position: "absolute", right: -180, top: -100, width: 340 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 10 },
  headerButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.72)", borderRadius: 20, height: 40, justifyContent: "center", width: 40 },
  headerKicker: { color: "#005bbd", fontSize: 9, fontWeight: "800", letterSpacing: 1.5, textAlign: "center" },
  headerTitle: { color: "#172438", fontSize: 20, fontWeight: "700", marginTop: 2 },
  content: { paddingBottom: 36, paddingHorizontal: 22, paddingTop: 26 },
  intro: { color: "#646879", fontSize: 15, lineHeight: 23, marginBottom: 22, maxWidth: 330 },
  list: { gap: 12 },
  scenarioCard: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.82)", borderColor: "white", borderRadius: 22, borderWidth: 1, elevation: 2, flexDirection: "row", padding: 16, shadowColor: "#33445e", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14 },
  cardPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  scenarioIcon: { alignItems: "center", backgroundColor: "#edf5ff", borderRadius: 16, height: 52, justifyContent: "center", width: 52 },
  scenarioCopy: { flex: 1, marginHorizontal: 13 },
  scenarioTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  scenarioTitle: { color: "#202c3d", fontSize: 17, fontWeight: "700" },
  difficultyBadge: { backgroundColor: "#eeeaff", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  difficultyText: { color: "#6543bc", fontSize: 9, fontWeight: "800" },
  scenarioDescription: { color: "#737685", fontSize: 12, lineHeight: 18, marginTop: 5 },
  tokenRow: { flexDirection: "row", gap: 5, marginTop: 8 },
  token: { color: "#005bbd", fontSize: 11, fontWeight: "600" },
  centerState: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 70 },
  stateIcon: { alignItems: "center", backgroundColor: "#eef0f5", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  stateTitle: { color: "#242c38", fontSize: 18, fontWeight: "700", marginTop: 14 },
  stateText: { color: "#747785", fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: "center" },
  retryButton: { backgroundColor: "#005bbd", borderRadius: 12, marginTop: 18, paddingHorizontal: 20, paddingVertical: 11 },
  retryText: { color: "white", fontSize: 13, fontWeight: "700" },
  modalBackdrop: { backgroundColor: "rgba(14,22,36,0.35)", flex: 1, justifyContent: "flex-end" },
  previewSheet: { backgroundColor: "#fbfbff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 28, paddingHorizontal: 24, paddingTop: 12 },
  sheetHandle: { alignSelf: "center", backgroundColor: "#d8d9e0", borderRadius: 3, height: 5, marginBottom: 18, width: 42 },
  previewIcon: { alignItems: "center", borderRadius: 20, height: 64, justifyContent: "center", width: 64 },
  previewTitle: { color: "#172438", fontSize: 27, fontWeight: "700", marginTop: 16 },
  previewDescription: { color: "#686b79", fontSize: 14, lineHeight: 22, marginTop: 7 },
  managementRow: { flexDirection: "row", gap: 9, marginTop: 14 },
  managementButton: { alignItems: "center", backgroundColor: "#edf2f7", borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 13, paddingVertical: 8 },
  managementText: { color: "#315475", fontSize: 12, fontWeight: "700" },
  archiveButton: { backgroundColor: "#fff0ee" },
  archiveText: { color: "#a33932", fontSize: 12, fontWeight: "700" },
  detailGrid: { flexDirection: "row", gap: 10, marginTop: 20 },
  detailItem: { backgroundColor: "#f0f4fb", borderRadius: 15, flex: 1, padding: 13 },
  detailLabel: { color: "#858895", fontSize: 10, fontWeight: "700" },
  detailValue: { color: "#263245", fontSize: 14, fontWeight: "700", marginTop: 4 },
  targetsLabel: { color: "#5f6370", fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 20 },
  previewTokens: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
  previewToken: { backgroundColor: "#e6f1ff", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  previewTokenText: { color: "#005bbd", fontSize: 13, fontWeight: "700" },
  focusList: { gap: 8, marginTop: 9 },
  focusWord: { alignItems: "center", backgroundColor: "#e6f1ff", borderColor: "#c9e1fb", borderRadius: 14, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 13, paddingVertical: 9 },
  scenarioFocusWord: { backgroundColor: "#f2ebff", borderColor: "#e1d3f8" },
  focusWordCopy: { alignItems: "baseline", flexDirection: "row", gap: 8 },
  focusWordText: { color: "#005bbd", fontSize: 16, fontWeight: "800" },
  scenarioFocusWordText: { color: "#6d29bd" },
  focusWordPinyin: { color: "#747785", fontSize: 11 },
  focusWordSource: { color: "#777b89", fontSize: 9, fontWeight: "700" },
  emptyTargets: { color: "#747785", fontSize: 12, lineHeight: 18 },
  startError: { color: "#ba1a1a", fontSize: 12, marginTop: 14, textAlign: "center" },
  startButton: { alignItems: "center", backgroundColor: "#005bbd", borderRadius: 17, flexDirection: "row", gap: 9, justifyContent: "center", marginTop: 24, minHeight: 54 },
  startButtonDisabled: { opacity: 0.72 },
  startText: { color: "white", fontSize: 16, fontWeight: "700" },
});
