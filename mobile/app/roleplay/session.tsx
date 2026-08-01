import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import RoleplayChatBubble from "../../components/RoleplayChatBubble";
import RoleplayMicButton from "../../components/RoleplayMicButton";
import { useRoleplayAudio } from "../../lib/useRoleplayAudio";
import {
  getFocusWordProgress,
  useRoleplayStore,
  type RoleplayMessage,
} from "../../stores/useRoleplayStore";
import type { ApiRoleplayFocusWord } from "../../lib/api";

function TypingIndicator() {
  return (
    <View style={styles.typingRow}>
      <View style={styles.smallAvatar}>
        <Ionicons name="sparkles" size={15} color="#005bbd" />
      </View>
      <View style={styles.typingBubble}>
        <View style={[styles.typingDot, { opacity: 0.35 }]} />
        <View style={[styles.typingDot, { opacity: 0.58 }]} />
        <View style={[styles.typingDot, { opacity: 0.85 }]} />
      </View>
    </View>
  );
}

const PROGRESS_LABEL = {
  current: "当前",
  passed: "已完成",
  failed: "待加强",
  remaining: "待练习",
} as const;

function FocusWordPanel({
  focusWords,
  messages,
}: {
  focusWords: ApiRoleplayFocusWord[];
  messages: RoleplayMessage[];
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  if (focusWords.length === 0) return null;
  const progress = getFocusWordProgress(focusWords, messages);

  return (
    <View style={styles.focusPanel}>
      <Pressable
        onPress={() => setIsExpanded((expanded) => !expanded)}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? "收起重点词" : "展开重点词"}
        style={styles.focusPanelHeader}
      >
        <View style={styles.focusPanelTitleRow}>
          <Ionicons name="flag-outline" size={14} color="#005bbd" />
          <Text style={styles.focusPanelTitle}>本次重点</Text>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#737685" />
      </Pressable>
      {isExpanded ? (
        <View style={styles.focusPanelWords}>
          {focusWords.map((focusWord, index) => (
            <View
              key={`${focusWord.source}-${focusWord.flashcard_id ?? focusWord.word}-${index}`}
              style={[
                styles.sessionFocusWord,
                progress[index] === "current" && styles.currentFocusWord,
                progress[index] === "passed" && styles.passedFocusWord,
                progress[index] === "failed" && styles.failedFocusWord,
              ]}
            >
              <View style={styles.sessionFocusCopy}>
                <Text style={styles.sessionFocusText}>{focusWord.word}</Text>
                {focusWord.pinyin ? (
                  <Text style={styles.sessionFocusPinyin}>{focusWord.pinyin}</Text>
                ) : null}
              </View>
              <View style={styles.focusProgressRow}>
                {progress[index] === "passed" ? (
                  <Ionicons name="checkmark-circle" size={13} color="#27734b" />
                ) : null}
                <Text style={[
                  styles.focusProgressText,
                  progress[index] === "current" && styles.currentProgressText,
                  progress[index] === "passed" && styles.passedProgressText,
                  progress[index] === "failed" && styles.failedProgressText,
                ]}>
                  {PROGRESS_LABEL[progress[index]]}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function RoleplaySessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<RoleplayMessage>>(null);
  const playedMessages = useRef(new Set<string>());
  const [isEnding, setIsEnding] = useState(false);
  const {
    selectedScenario,
    focusWords,
    sessionId,
    messages,
    connectionStatus,
    isProcessing,
    hint,
    summary,
    error,
    connect,
    sendSpeech,
    requestHint,
    dismissHint,
    clearError,
    endSession,
    reset,
  } = useRoleplayStore();
  const audio = useRoleplayAudio();

  useEffect(() => {
    if (!sessionId) {
      router.replace("/roleplay");
      return;
    }
    connect();
  }, [connect, router, sessionId]);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (!latest?.audioB64 || playedMessages.current.has(latest.id)) return;
    playedMessages.current.add(latest.id);
    const timer = setTimeout(() => audio.playBase64Audio(latest.id, latest.audioB64!), 220);
    return () => clearTimeout(timer);
  }, [audio.playBase64Audio, messages]);

  const finishSession = useCallback(async () => {
    if (isEnding) return;
    setIsEnding(true);
    audio.stopAudio();
    await endSession();
    setIsEnding(false);
  }, [audio.stopAudio, endSession, isEnding]);

  const confirmExit = useCallback(() => {
    Alert.alert("结束这次对话？", "会保存已经完成的练习记录。", [
      { text: "继续练习", style: "cancel" },
      { text: "结束", style: "destructive", onPress: finishSession },
    ]);
  }, [finishSession]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (summary) return false;
      confirmExit();
      return true;
    });
    return () => subscription.remove();
  }, [confirmExit, summary]);

  const handleMicPress = async () => {
    if (audio.isRecording) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const recording = await audio.stopRecording();
      if (recording) sendSpeech(recording.base64, recording.mimeType);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await audio.startRecording();
  };

  const handleReplay = (message: RoleplayMessage) => {
    if (message.audioB64) audio.playBase64Audio(message.id, message.audioB64);
  };

  const leaveSummary = () => {
    reset();
    router.replace("/roleplay");
  };

  if (summary) {
    const unattemptedTargets = summary.targets?.filter(
      (target) => target.status === "unattempted"
    ) ?? [];
    return (
      <SafeAreaView style={styles.summaryScreen} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View style={styles.summaryGlow} />
        <View style={styles.summaryContent}>
          <LinearGradient colors={["#dfeeff", "#ece4ff"]} style={styles.summaryIcon}>
            <Ionicons name="sparkles" size={34} color="#005bbd" />
          </LinearGradient>
          <Text style={styles.summaryKicker}>SESSION COMPLETE</Text>
          <Text style={styles.summaryTitle}>练习完成</Text>
          <Text style={styles.summarySubtitle}>{selectedScenario?.title}</Text>

          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{summary.total_turns}</Text>
              <Text style={styles.statLabel}>对话轮次</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{summary.tokens_passed.length}</Text>
              <Text style={styles.statLabel}>已掌握目标</Text>
            </View>
          </View>

          {summary.tokens_passed.length > 0 ? (
            <View style={styles.resultGroup}>
              <Text style={styles.resultLabel}>成功使用</Text>
              <View style={styles.resultTokens}>
                {summary.tokens_passed.map((token) => (
                  <View key={token} style={styles.passedToken}>
                    <Ionicons name="checkmark" size={14} color="#166534" />
                    <Text style={styles.passedTokenText}>{token}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {summary.tokens_failed.length > 0 ? (
            <View style={styles.resultGroup}>
              <Text style={styles.resultLabel}>继续练习</Text>
              <View style={styles.resultTokens}>
                {summary.tokens_failed.map((token) => (
                  <View key={token} style={styles.failedToken}>
                    <Text style={styles.failedTokenText}>{token}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {unattemptedTargets.length > 0 ? (
            <View style={styles.resultGroup}>
              <Text style={styles.resultLabel}>本次未轮到</Text>
              <View style={styles.resultTokens}>
                {unattemptedTargets.map((target) => (
                  <View key={target.id} style={styles.unattemptedToken}>
                    <Text style={styles.unattemptedTokenText}>{target.word}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Pressable onPress={leaveSummary} style={styles.summaryButton}>
            <Text style={styles.summaryButtonText}>选择新场景</Text>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <StatusBar style="dark" />
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />

      <View style={styles.header}>
        <Pressable onPress={confirmExit} style={styles.headerButton} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#005bbd" />
        </Pressable>
        <View style={styles.headerIdentity}>
          <LinearGradient colors={["#2376d2", "#7622e5"]} style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>{selectedScenario?.title ?? "角色扮演"}</Text>
            <View style={styles.connectionRow}>
              <View
                style={[
                  styles.connectionDot,
                  connectionStatus === "connected" && styles.connectionDotActive,
                ]}
              />
              <Text style={styles.connectionText}>
                {connectionStatus === "connected" ? "对话已就绪" : "正在连接"}
              </Text>
            </View>
          </View>
        </View>
        <Pressable onPress={finishSession} disabled={isEnding} style={styles.endButton}>
          <Text style={styles.endButtonText}>{isEnding ? "保存中" : "结束"}</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RoleplayChatBubble message={item} onReplay={handleReplay} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>今天 · 沉浸模式</Text>
            </View>
            <FocusWordPanel focusWords={focusWords} messages={messages} />
          </View>
        }
        ListFooterComponent={isProcessing ? <TypingIndicator /> : <View style={{ height: 8 }} />}
        contentContainerStyle={[styles.chatContent, { paddingBottom: 200 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {(error || audio.error) ? (
        <Pressable
          onPress={() => {
            clearError();
            audio.clearError();
          }}
          style={[styles.errorToast, { bottom: 164 + insets.bottom }]}
        >
          <Ionicons name="alert-circle-outline" size={18} color="#93000a" />
          <Text style={styles.errorText}>{audio.error ?? error}</Text>
          <Ionicons name="close" size={17} color="#93000a" />
        </Pressable>
      ) : null}

      {hint ? (
        <View style={[styles.hintCard, { bottom: 166 + insets.bottom }]}> 
          <View style={styles.hintIcon}>
            <Ionicons name="bulb-outline" size={19} color="#6d29bd" />
          </View>
          <View style={styles.hintCopy}>
            <Text style={styles.hintText}>{hint.text}</Text>
            <Text style={styles.hintStructure}>{hint.structure}</Text>
          </View>
          <Pressable onPress={dismissHint} hitSlop={10}>
            <Ionicons name="close" size={18} color="#797582" />
          </Pressable>
        </View>
      ) : null}

      <LinearGradient
        colors={["rgba(249,249,255,0)", "rgba(249,249,255,0.92)", "#f9f9ff"]}
        pointerEvents="none"
        style={[styles.bottomFade, { height: 190 + insets.bottom }]}
      />
      <View style={[styles.bottomControls, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
        <Pressable
          onPress={requestHint}
          disabled={connectionStatus !== "connected" || isProcessing || audio.isRecording}
          style={styles.hintButton}
        >
          <Ionicons name="bulb-outline" size={18} color="#6d29bd" />
          <Text style={styles.hintButtonText}>提示</Text>
        </Pressable>
        <RoleplayMicButton
          isRecording={audio.isRecording}
          isProcessing={isProcessing}
          isConnected={connectionStatus === "connected"}
          durationMillis={audio.durationMillis}
          onPress={handleMicPress}
        />
        <View style={styles.controlSpacer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#f9f9ff", flex: 1 },
  orbOne: { backgroundColor: "rgba(118,34,229,0.09)", borderRadius: 180, height: 360, left: -180, position: "absolute", top: -170, width: 360 },
  orbTwo: { backgroundColor: "rgba(0,91,189,0.08)", borderRadius: 170, bottom: 60, height: 340, position: "absolute", right: -210, width: 340 },
  header: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.58)", borderBottomColor: "rgba(255,255,255,0.8)", borderBottomWidth: 1, flexDirection: "row", height: 64, justifyContent: "space-between", paddingHorizontal: 16, zIndex: 4 },
  headerButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  headerIdentity: { alignItems: "center", flexDirection: "row", gap: 9 },
  aiBadge: { alignItems: "center", borderRadius: 16, height: 34, justifyContent: "center", width: 34 },
  aiBadgeText: { color: "white", fontSize: 10, fontWeight: "800" },
  headerTitle: { color: "#263246", fontSize: 15, fontWeight: "700" },
  connectionRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 2 },
  connectionDot: { backgroundColor: "#d3a92b", borderRadius: 3, height: 6, width: 6 },
  connectionDotActive: { backgroundColor: "#36a269" },
  connectionText: { color: "#838694", fontSize: 9, fontWeight: "600" },
  endButton: { backgroundColor: "#edf3fc", borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  endButtonText: { color: "#005bbd", fontSize: 12, fontWeight: "700" },
  chatContent: { flexGrow: 1, paddingHorizontal: 17, paddingTop: 18 },
  datePill: { alignSelf: "center", backgroundColor: "rgba(255,255,255,0.7)", borderColor: "white", borderRadius: 99, borderWidth: 1, marginBottom: 25, paddingHorizontal: 13, paddingVertical: 6 },
  dateText: { color: "#777b89", fontSize: 10, fontWeight: "600" },
  focusPanel: { backgroundColor: "rgba(255,255,255,0.82)", borderColor: "white", borderRadius: 16, borderWidth: 1, marginBottom: 22, padding: 11 },
  focusPanelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  focusPanelTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  focusPanelTitle: { color: "#344052", fontSize: 12, fontWeight: "800" },
  focusPanelWords: { gap: 6, marginTop: 9 },
  sessionFocusWord: { alignItems: "center", backgroundColor: "#f4f5f9", borderRadius: 10, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 7 },
  currentFocusWord: { backgroundColor: "#e6f1ff" },
  passedFocusWord: { backgroundColor: "#e8f7ee" },
  failedFocusWord: { backgroundColor: "#fff1e7" },
  sessionFocusCopy: { alignItems: "baseline", flexDirection: "row", gap: 7 },
  sessionFocusText: { color: "#263245", fontSize: 13, fontWeight: "800" },
  sessionFocusPinyin: { color: "#7b7e8c", fontSize: 9 },
  focusProgressRow: { alignItems: "center", flexDirection: "row", gap: 3 },
  focusProgressText: { color: "#858895", fontSize: 9, fontWeight: "700" },
  currentProgressText: { color: "#005bbd" },
  passedProgressText: { color: "#27734b" },
  failedProgressText: { color: "#9a4d16" },
  typingRow: { alignItems: "flex-end", flexDirection: "row", gap: 10, marginTop: 20 },
  smallAvatar: { alignItems: "center", backgroundColor: "rgba(0,91,189,0.08)", borderRadius: 15, height: 30, justifyContent: "center", width: 30 },
  typingBubble: { backgroundColor: "rgba(255,255,255,0.76)", borderRadius: 18, flexDirection: "row", gap: 5, paddingHorizontal: 16, paddingVertical: 13 },
  typingDot: { backgroundColor: "#005bbd", borderRadius: 4, height: 7, width: 7 },
  bottomFade: { bottom: 0, left: 0, position: "absolute", right: 0 },
  bottomControls: { alignItems: "flex-end", bottom: 0, flexDirection: "row", justifyContent: "space-around", left: 0, paddingHorizontal: 18, position: "absolute", right: 0 },
  hintButton: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.82)", borderColor: "white", borderRadius: 17, borderWidth: 1, flexDirection: "row", gap: 5, marginBottom: 48, paddingHorizontal: 12, paddingVertical: 9, width: 72 },
  hintButtonText: { color: "#6d29bd", fontSize: 11, fontWeight: "700" },
  controlSpacer: { width: 72 },
  errorToast: { alignItems: "center", alignSelf: "center", backgroundColor: "#ffdad6", borderRadius: 14, flexDirection: "row", gap: 8, left: 20, paddingHorizontal: 13, paddingVertical: 11, position: "absolute", right: 20, zIndex: 7 },
  errorText: { color: "#93000a", flex: 1, fontSize: 12, fontWeight: "600" },
  hintCard: { alignItems: "center", backgroundColor: "#f5edff", borderColor: "white", borderRadius: 16, borderWidth: 1, flexDirection: "row", left: 20, padding: 12, position: "absolute", right: 20, zIndex: 6 },
  hintIcon: { alignItems: "center", backgroundColor: "white", borderRadius: 14, height: 36, justifyContent: "center", width: 36 },
  hintCopy: { flex: 1, marginHorizontal: 10 },
  hintText: { color: "#4f356c", fontSize: 12, fontWeight: "700" },
  hintStructure: { color: "#7d668f", fontSize: 10, marginTop: 3 },
  summaryScreen: { backgroundColor: "#f9f9ff", flex: 1 },
  summaryGlow: { alignSelf: "center", backgroundColor: "rgba(118,34,229,0.08)", borderRadius: 190, height: 380, position: "absolute", top: -170, width: 380 },
  summaryContent: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 25 },
  summaryIcon: { alignItems: "center", borderRadius: 26, height: 76, justifyContent: "center", width: 76 },
  summaryKicker: { color: "#005bbd", fontSize: 9, fontWeight: "800", letterSpacing: 1.7, marginTop: 22 },
  summaryTitle: { color: "#172438", fontSize: 31, fontWeight: "700", marginTop: 5 },
  summarySubtitle: { color: "#747785", fontSize: 14, marginTop: 6 },
  summaryStats: { backgroundColor: "white", borderRadius: 22, flexDirection: "row", marginTop: 28, paddingVertical: 18, width: "100%" },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { color: "#005bbd", fontSize: 27, fontWeight: "800" },
  statLabel: { color: "#777b88", fontSize: 11, marginTop: 4 },
  statDivider: { backgroundColor: "#e5e7ee", width: 1 },
  resultGroup: { alignSelf: "stretch", marginTop: 20 },
  resultLabel: { color: "#6e7180", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  resultTokens: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
  passedToken: { alignItems: "center", backgroundColor: "#dcfce7", borderRadius: 99, flexDirection: "row", gap: 4, paddingHorizontal: 11, paddingVertical: 7 },
  passedTokenText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  failedToken: { backgroundColor: "#fff1e7", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  failedTokenText: { color: "#9a4d16", fontSize: 12, fontWeight: "700" },
  unattemptedToken: { backgroundColor: "#eef0f5", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  unattemptedTokenText: { color: "#6e7180", fontSize: 12, fontWeight: "700" },
  summaryButton: { alignItems: "center", backgroundColor: "#005bbd", borderRadius: 17, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 30, minHeight: 54, width: "100%" },
  summaryButtonText: { color: "white", fontSize: 15, fontWeight: "700" },
});
