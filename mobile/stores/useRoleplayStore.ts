import { create } from "zustand";
import {
  endRoleplaySession,
  archiveRoleplayScenario,
  createRoleplayScenario,
  fetchScenarioRecommendations,
  fetchRoleplayScenarios,
  prepareRoleplayTargets,
  startRoleplaySession,
  updateRoleplayScenario,
  type ApiRoleplayFocusWord,
  type ApiScenarioRecommendations,
  type ApiRoleplayScenario,
  type ApiRoleplaySummary,
  type RoleplayScenarioInput,
  type RoleplayDifficulty,
} from "../lib/api";
import {
  connectRoleplaySocket,
  type GrammarEvaluation,
  type RoleplayServerEvent,
} from "../lib/roleplaySocket";
import { pushPendingReviews } from "../lib/sync";
import { useSettingsStore } from "./useSettingsStore";

export interface RoleplayMessage {
  id: string;
  sender: "user" | "tars";
  text: string;
  pinyin?: string;
  audioB64?: string;
  evaluations?: GrammarEvaluation[];
}

type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type FocusWordProgress = "current" | "passed" | "failed" | "remaining";

export function getFocusWordProgress(
  focusWords: ApiRoleplayFocusWord[],
  messages: RoleplayMessage[]
): FocusWordProgress[] {
  const passedWords = new Set(
    messages.flatMap((message) =>
      (message.evaluations ?? [])
        .filter((evaluation) => evaluation.passed)
        .map((evaluation) => evaluation.target_token)
    )
  );
  const failedAttempts = new Map<string, number>();
  for (const message of messages) {
    for (const evaluation of message.evaluations ?? []) {
      if (!evaluation.passed) {
        failedAttempts.set(
          evaluation.target_token,
          (failedAttempts.get(evaluation.target_token) ?? 0) + 1
        );
      }
    }
  }
  const failedWords = new Set(
    [...failedAttempts.entries()]
      .filter(([, attempts]) => attempts >= 3)
      .map(([word]) => word)
  );
  const firstRemaining = focusWords.findIndex(
    (focusWord) =>
      !passedWords.has(focusWord.word) && !failedWords.has(focusWord.word)
  );
  return focusWords.map((focusWord, index) => {
    if (passedWords.has(focusWord.word)) return "passed";
    if (failedWords.has(focusWord.word)) return "failed";
    return index === firstRemaining ? "current" : "remaining";
  });
}

interface RoleplayState {
  scenarios: ApiRoleplayScenario[];
  selectedScenario: ApiRoleplayScenario | null;
  focusWords: ApiRoleplayFocusWord[];
  preparedScenarioId: string | null;
  sessionId: string | null;
  forcedTokens: string[];
  messages: RoleplayMessage[];
  connectionStatus: ConnectionStatus;
  isLoadingScenarios: boolean;
  isPreparingTargets: boolean;
  isStarting: boolean;
  isProcessing: boolean;
  hint: { text: string; structure: string } | null;
  summary: ApiRoleplaySummary | null;
  error: string | null;
  isMutatingScenario: boolean;
  scenarioMutationError: string | null;
  isLoadingRecommendations: boolean;
  recommendationError: string | null;
  recommendations: ApiScenarioRecommendations | null;
  loadScenarios: () => Promise<void>;
  selectScenario: (scenario: ApiRoleplayScenario | null) => void;
  prepareTargets: (scenarioId: string) => Promise<boolean>;
  startSession: (scenarioId: string) => Promise<boolean>;
  connect: () => void;
  sendSpeech: (audioB64: string, mimeType: string) => boolean;
  requestHint: () => void;
  dismissHint: () => void;
  clearError: () => void;
  clearScenarioMutationError: () => void;
  clearRecommendations: () => void;
  createScenario: (input: RoleplayScenarioInput) => Promise<ApiRoleplayScenario | null>;
  updateScenario: (scenarioId: string, input: RoleplayScenarioInput) => Promise<ApiRoleplayScenario | null>;
  archiveScenario: (scenarioId: string) => Promise<boolean>;
  loadRecommendations: (input: {
    title: string;
    description: string;
    difficulty: RoleplayDifficulty;
    selected_targets: string[];
  }) => Promise<boolean>;
  endSession: () => Promise<ApiRoleplaySummary>;
  reset: () => void;
}

let activeSocket: WebSocket | null = null;
let closingIntentionally = false;
let messageSequence = 0;

function messageId(prefix: string): string {
  messageSequence += 1;
  return `${prefix}-${Date.now()}-${messageSequence}`;
}

function closeSocket(): void {
  if (!activeSocket) return;
  closingIntentionally = true;
  activeSocket.close();
  activeSocket = null;
}

function handleServerEvent(
  event: RoleplayServerEvent,
  set: (partial: Partial<RoleplayState> | ((state: RoleplayState) => Partial<RoleplayState>)) => void
): void {
  if (event.event_type === "tars_response") {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: messageId("user"),
          sender: "user",
          text: event.transcribed_user_text,
          evaluations: event.grammar_evaluations,
        },
        {
          id: messageId("tars"),
          sender: "tars",
          text: event.ai_text_reply,
          pinyin: event.ai_pinyin,
          audioB64: event.ai_audio_b64,
        },
      ],
      isProcessing: false,
      error: null,
    }));
    return;
  }

  if (event.event_type === "hint_response") {
    set({
      hint: { text: event.hint_text, structure: event.suggested_structure },
    });
    return;
  }

  set({
    error: event.message,
    isProcessing: false,
    connectionStatus: event.recoverable ? "connected" : "disconnected",
  });
}

const initialState = {
  scenarios: [] as ApiRoleplayScenario[],
  selectedScenario: null as ApiRoleplayScenario | null,
  focusWords: [] as ApiRoleplayFocusWord[],
  preparedScenarioId: null as string | null,
  sessionId: null as string | null,
  forcedTokens: [] as string[],
  messages: [] as RoleplayMessage[],
  connectionStatus: "disconnected" as ConnectionStatus,
  isLoadingScenarios: false,
  isPreparingTargets: false,
  isStarting: false,
  isProcessing: false,
  hint: null as { text: string; structure: string } | null,
  summary: null as ApiRoleplaySummary | null,
  error: null as string | null,
  isMutatingScenario: false,
  scenarioMutationError: null as string | null,
  isLoadingRecommendations: false,
  recommendationError: null as string | null,
  recommendations: null as ApiScenarioRecommendations | null,
};

export const useRoleplayStore = create<RoleplayState>((set, get) => ({
  ...initialState,

  loadScenarios: async () => {
    set({ isLoadingScenarios: true, error: null });
    try {
      const scenarios = await fetchRoleplayScenarios();
      set({ scenarios, isLoadingScenarios: false });
    } catch {
      set({
        isLoadingScenarios: false,
        error: "无法加载场景，请检查网络后重试。",
      });
    }
  },

  selectScenario: (selectedScenario) => set({
    selectedScenario,
    focusWords: [],
    preparedScenarioId: null,
    isPreparingTargets: false,
    error: null,
  }),

  prepareTargets: async (scenarioId) => {
    if (get().isPreparingTargets) return false;
    set({
      focusWords: [],
      preparedScenarioId: null,
      isPreparingTargets: true,
      error: null,
    });
    try {
      await pushPendingReviews(useSettingsStore.getState().getLastSyncAt());
    } catch {
      set({
        isPreparingTargets: false,
        error: "同步学习记录失败，请检查网络后重试。",
      });
      return false;
    }
    try {
      const focusWords = await prepareRoleplayTargets(scenarioId);
      set({ focusWords, preparedScenarioId: scenarioId, isPreparingTargets: false });
      return true;
    } catch {
      set({
        isPreparingTargets: false,
        error: "无法准备本次重点，请检查网络后重试。",
      });
      return false;
    }
  },

  startSession: async (scenarioId) => {
    if (get().isStarting) return false;
    closeSocket();
    set({ isStarting: true, error: null, summary: null });
    try {
      const focusWords = get().focusWords;
      const targetFlashcardIds = focusWords.flatMap((focusWord) =>
        focusWord.source === "flashcard" && focusWord.flashcard_id
          ? [focusWord.flashcard_id]
          : []
      );
      const scenarioTargetWords = focusWords.flatMap((focusWord) =>
        focusWord.source === "scenario" ? [focusWord.word] : []
      );
      const session = await startRoleplaySession(
        scenarioId,
        targetFlashcardIds,
        scenarioTargetWords
      );
      set({
        selectedScenario: session.scenario,
        sessionId: session.session_id,
        forcedTokens: session.forced_tokens,
        messages: [
          {
            id: messageId("greeting"),
            sender: "tars",
            text: session.initial_greeting.text,
            pinyin: session.initial_greeting.pinyin,
            audioB64: session.initial_greeting.audio_b64,
          },
        ],
        isStarting: false,
        connectionStatus: "disconnected",
        hint: null,
      });
      return true;
    } catch {
      set({
        isStarting: false,
        error: "场景准备失败，请稍后重试。",
      });
      return false;
    }
  },

  connect: () => {
    const { sessionId, connectionStatus } = get();
    if (!sessionId || connectionStatus !== "disconnected") return;
    closeSocket();
    closingIntentionally = false;
    set({ connectionStatus: "connecting", error: null });
    activeSocket = connectRoleplaySocket(sessionId, {
      onOpen: () => set({ connectionStatus: "connected" }),
      onEvent: (event) => handleServerEvent(event, set),
      onClose: () => {
        activeSocket = null;
        set({
          connectionStatus: "disconnected",
          isProcessing: false,
          error: closingIntentionally ? get().error : "会话连接已断开。",
        });
        closingIntentionally = false;
      },
      onError: () => set({ error: "无法连接到对话服务。" }),
    });
  },

  sendSpeech: (audioB64, mimeType) => {
    if (!activeSocket || activeSocket.readyState !== 1 || get().isProcessing) {
      set({ error: "对话尚未连接，请稍后重试。" });
      return false;
    }
    set({ isProcessing: true, error: null, hint: null });
    activeSocket.send(
      JSON.stringify({
        event_type: "user_speech",
        audio_chunk_b64: audioB64,
        audio_mime_type: mimeType,
      })
    );
    return true;
  },

  requestHint: () => {
    if (!activeSocket || activeSocket.readyState !== 1) {
      set({ error: "连接成功后才能请求提示。" });
      return;
    }
    activeSocket.send(JSON.stringify({ event_type: "request_hint" }));
  },

  dismissHint: () => set({ hint: null }),
  clearError: () => set({ error: null }),
  clearScenarioMutationError: () => set({ scenarioMutationError: null }),
  clearRecommendations: () => set({ recommendations: null, recommendationError: null }),

  createScenario: async (input) => {
    if (get().isMutatingScenario) return null;
    set({ isMutatingScenario: true, scenarioMutationError: null });
    try {
      const scenario = await createRoleplayScenario(input);
      set((state) => ({
        scenarios: [...state.scenarios, scenario],
        isMutatingScenario: false,
      }));
      return scenario;
    } catch {
      set({ isMutatingScenario: false, scenarioMutationError: "无法保存场景，请稍后重试。" });
      return null;
    }
  },

  updateScenario: async (scenarioId, input) => {
    if (get().isMutatingScenario) return null;
    set({ isMutatingScenario: true, scenarioMutationError: null });
    try {
      const scenario = await updateRoleplayScenario(scenarioId, input);
      set((state) => ({
        scenarios: state.scenarios.map((item) => item.id === scenarioId ? scenario : item),
        selectedScenario: state.selectedScenario?.id === scenarioId ? scenario : state.selectedScenario,
        focusWords: state.preparedScenarioId === scenarioId ? [] : state.focusWords,
        preparedScenarioId: state.preparedScenarioId === scenarioId ? null : state.preparedScenarioId,
        isMutatingScenario: false,
      }));
      return scenario;
    } catch {
      set({ isMutatingScenario: false, scenarioMutationError: "无法保存场景，请稍后重试。" });
      return null;
    }
  },

  archiveScenario: async (scenarioId) => {
    if (get().isMutatingScenario) return false;
    set({ isMutatingScenario: true, scenarioMutationError: null });
    try {
      await archiveRoleplayScenario(scenarioId);
      set((state) => ({
        scenarios: state.scenarios.filter((item) => item.id !== scenarioId),
        selectedScenario: state.selectedScenario?.id === scenarioId ? null : state.selectedScenario,
        focusWords: state.preparedScenarioId === scenarioId ? [] : state.focusWords,
        preparedScenarioId: state.preparedScenarioId === scenarioId ? null : state.preparedScenarioId,
        isMutatingScenario: false,
      }));
      return true;
    } catch {
      set({ isMutatingScenario: false, scenarioMutationError: "无法归档场景，原场景仍然保留。" });
      return false;
    }
  },

  loadRecommendations: async (input) => {
    if (get().isLoadingRecommendations) return false;
    set({ isLoadingRecommendations: true, recommendationError: null });
    try {
      await pushPendingReviews(useSettingsStore.getState().getLastSyncAt());
      const recommendations = await fetchScenarioRecommendations(input);
      set({ recommendations, isLoadingRecommendations: false });
      return true;
    } catch (error) {
      set({
        isLoadingRecommendations: false,
        recommendationError:
          error && typeof error === "object" && "detail" in error && typeof error.detail === "string"
            ? `无法获取推荐：${error.detail}`
            : "暂时无法获取推荐，你仍可继续手动编辑。",
      });
      return false;
    }
  },

  endSession: async () => {
    const { sessionId, messages, forcedTokens } = get();
    closeSocket();
    const localSummary: ApiRoleplaySummary = {
      total_turns: messages.filter((message) => message.sender === "user").length,
      tokens_forced: forcedTokens,
      tokens_passed: [],
      tokens_failed: [],
    };
    if (!sessionId) {
      set({ summary: localSummary, connectionStatus: "disconnected" });
      return localSummary;
    }
    try {
      const summary = await endRoleplaySession(sessionId);
      set({ summary, connectionStatus: "disconnected" });
      return summary;
    } catch {
      set({
        summary: localSummary,
        connectionStatus: "disconnected",
        error: "会话已在本机结束，但服务器没有确认。",
      });
      return localSummary;
    }
  },

  reset: () => {
    closeSocket();
    set({ ...initialState });
  },
}));
