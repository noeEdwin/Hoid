import type { ApiRoleplayFocusWord, ApiRoleplayScenario } from "../../lib/api";

jest.mock("../../lib/api", () => ({
  fetchRoleplayScenarios: jest.fn(),
  prepareRoleplayTargets: jest.fn(),
  startRoleplaySession: jest.fn(),
  endRoleplaySession: jest.fn(),
  createRoleplayScenario: jest.fn(),
  updateRoleplayScenario: jest.fn(),
  archiveRoleplayScenario: jest.fn(),
  fetchScenarioRecommendations: jest.fn(),
}));

jest.mock("../../lib/sync", () => ({
  pushPendingReviews: jest.fn(),
}));

jest.mock("../useSettingsStore", () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({
      getLastSyncAt: jest.fn(() => "2026-07-17T20:00:00.000Z"),
    })),
  },
}));

jest.mock("../../lib/roleplaySocket", () => ({
  connectRoleplaySocket: jest.fn(),
}));

import {
  endRoleplaySession,
  fetchRoleplayScenarios,
  prepareRoleplayTargets,
  startRoleplaySession,
  createRoleplayScenario,
  updateRoleplayScenario,
  archiveRoleplayScenario,
  fetchScenarioRecommendations,
} from "../../lib/api";
import { pushPendingReviews } from "../../lib/sync";
import { connectRoleplaySocket } from "../../lib/roleplaySocket";
import { getFocusWordProgress, useRoleplayStore } from "../useRoleplayStore";

const scenario: ApiRoleplayScenario = {
  id: "scenario-1",
  title: "在餐馆点菜",
  description: "测试场景",
  difficulty: "beginner",
  target_grammar: ["想要", "菜单"],
  example_prompt: "您好",
};

const mockedFetchScenarios = fetchRoleplayScenarios as jest.MockedFunction<typeof fetchRoleplayScenarios>;
const mockedPrepareTargets = prepareRoleplayTargets as jest.MockedFunction<typeof prepareRoleplayTargets>;
const mockedStartSession = startRoleplaySession as jest.MockedFunction<typeof startRoleplaySession>;
const mockedEndSession = endRoleplaySession as jest.MockedFunction<typeof endRoleplaySession>;
const mockedConnect = connectRoleplaySocket as jest.MockedFunction<typeof connectRoleplaySocket>;
const mockedPushPendingReviews = pushPendingReviews as jest.MockedFunction<typeof pushPendingReviews>;
const mockedCreateScenario = createRoleplayScenario as jest.MockedFunction<typeof createRoleplayScenario>;
const mockedUpdateScenario = updateRoleplayScenario as jest.MockedFunction<typeof updateRoleplayScenario>;
const mockedArchiveScenario = archiveRoleplayScenario as jest.MockedFunction<typeof archiveRoleplayScenario>;
const mockedRecommendations = fetchScenarioRecommendations as jest.MockedFunction<typeof fetchScenarioRecommendations>;

const focusWords: ApiRoleplayFocusWord[] = [
  {
    flashcard_id: "flashcard-1",
    word: "菜单",
    pinyin: "cài dān",
    sentence: "请给我菜单。",
    source: "flashcard",
  },
  {
    flashcard_id: null,
    word: "买单",
    pinyin: "mǎi dān",
    sentence: null,
    source: "scenario",
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  useRoleplayStore.getState().reset();
});

it("pushes local changes before preparing targets", async () => {
  mockedPushPendingReviews.mockResolvedValue({
    processedPendingReviewIds: [],
    changesApplied: 0,
  });
  mockedPrepareTargets.mockResolvedValue(focusWords);

  const prepared = await useRoleplayStore.getState().prepareTargets(scenario.id);

  expect(prepared).toBe(true);
  expect(mockedPushPendingReviews).toHaveBeenCalledWith("2026-07-17T20:00:00.000Z");
  expect(mockedPrepareTargets).toHaveBeenCalledWith(scenario.id);
  expect(useRoleplayStore.getState().focusWords).toEqual(focusWords);
  expect(useRoleplayStore.getState().preparedScenarioId).toBe(scenario.id);
  expect(useRoleplayStore.getState().isPreparingTargets).toBe(false);
});

it("fails preparation visibly when the push fails", async () => {
  mockedPushPendingReviews.mockRejectedValue(new Error("offline"));

  const prepared = await useRoleplayStore.getState().prepareTargets(scenario.id);

  expect(prepared).toBe(false);
  expect(mockedPrepareTargets).not.toHaveBeenCalled();
  expect(useRoleplayStore.getState().focusWords).toEqual([]);
  expect(useRoleplayStore.getState().error).toContain("同步学习记录失败");
});

it("loads predefined scenarios", async () => {
  mockedFetchScenarios.mockResolvedValue([scenario]);

  await useRoleplayStore.getState().loadScenarios();

  expect(useRoleplayStore.getState().scenarios).toEqual([scenario]);
  expect(useRoleplayStore.getState().isLoadingScenarios).toBe(false);
});

it("adds created scenarios and replaces edited scenarios without reloading", async () => {
  const created = { ...scenario, id: "scenario-2", title: "问路" };
  mockedCreateScenario.mockResolvedValue(created);
  await useRoleplayStore.getState().createScenario({
    title: created.title, description: created.description, difficulty: created.difficulty,
    target_grammar: created.target_grammar, example_prompt: created.example_prompt,
  });
  expect(useRoleplayStore.getState().scenarios).toEqual([created]);

  useRoleplayStore.setState({ focusWords, preparedScenarioId: created.id, selectedScenario: created });
  const edited = { ...created, title: "在街上问路" };
  mockedUpdateScenario.mockResolvedValue(edited);
  await useRoleplayStore.getState().updateScenario(created.id, {
    title: edited.title, description: edited.description, difficulty: edited.difficulty,
    target_grammar: edited.target_grammar, example_prompt: edited.example_prompt,
  });
  expect(useRoleplayStore.getState().scenarios).toEqual([edited]);
  expect(useRoleplayStore.getState().selectedScenario).toEqual(edited);
  expect(useRoleplayStore.getState().preparedScenarioId).toBeNull();
  expect(useRoleplayStore.getState().focusWords).toEqual([]);
});

it("removes and closes an archived selected scenario", async () => {
  useRoleplayStore.setState({ scenarios: [scenario], selectedScenario: scenario });
  mockedArchiveScenario.mockResolvedValue({ status: "archived", scenario_id: scenario.id });
  await expect(useRoleplayStore.getState().archiveScenario(scenario.id)).resolves.toBe(true);
  expect(useRoleplayStore.getState().scenarios).toEqual([]);
  expect(useRoleplayStore.getState().selectedScenario).toBeNull();
});

it("keeps the scenario in the list when archive fails", async () => {
  useRoleplayStore.setState({ scenarios: [scenario], selectedScenario: scenario });
  mockedArchiveScenario.mockRejectedValue(new Error("offline"));
  await expect(useRoleplayStore.getState().archiveScenario(scenario.id)).resolves.toBe(false);
  expect(useRoleplayStore.getState().scenarios).toEqual([scenario]);
  expect(useRoleplayStore.getState().selectedScenario).toEqual(scenario);
  expect(useRoleplayStore.getState().scenarioMutationError).toContain("仍然保留");
  expect(useRoleplayStore.getState().error).toBeNull();
});

it("pushes local changes before recommendations and preserves prior results on failure", async () => {
  const recommendations = { existing_cards: [], suggested_new: [{ word: "鲜花", pinyin: "xiān huā", reason: "场景相关", suggested_structure: "我想买___" }] };
  mockedPushPendingReviews.mockResolvedValue({ processedPendingReviewIds: [], changesApplied: 0 });
  mockedRecommendations.mockResolvedValueOnce(recommendations).mockRejectedValueOnce(new Error("offline"));
  const input = { title: "花店", description: "买花", difficulty: "beginner" as const, selected_targets: ["想要"] };
  await expect(useRoleplayStore.getState().loadRecommendations(input)).resolves.toBe(true);
  await expect(useRoleplayStore.getState().loadRecommendations(input)).resolves.toBe(false);
  expect(mockedPushPendingReviews).toHaveBeenCalledTimes(2);
  expect(useRoleplayStore.getState().recommendations).toEqual(recommendations);
  expect(useRoleplayStore.getState().recommendationError).toContain("手动编辑");
  expect(useRoleplayStore.getState().error).toBeNull();
});

it("starts a session with the initial greeting", async () => {
  useRoleplayStore.setState({ focusWords, preparedScenarioId: scenario.id });
  mockedStartSession.mockResolvedValue({
    session_id: "session-1",
    websocket_url: "ws://unused",
    scenario,
    forced_tokens: ["菜单"],
    initial_greeting: {
      text: "您好，请看菜单。",
      pinyin: "nín hǎo",
      audio_b64: "YXVkaW8=",
    },
  });

  const started = await useRoleplayStore.getState().startSession(scenario.id);

  expect(started).toBe(true);
  expect(mockedStartSession).toHaveBeenCalledWith(
    scenario.id,
    ["flashcard-1"],
    ["买单"]
  );
  expect(useRoleplayStore.getState().sessionId).toBe("session-1");
  expect(useRoleplayStore.getState().messages[0].text).toBe("您好，请看菜单。");
});

it("adds the transcript and response from a socket turn", async () => {
  useRoleplayStore.setState({ focusWords, preparedScenarioId: scenario.id });
  mockedStartSession.mockResolvedValue({
    session_id: "session-1",
    websocket_url: "ws://unused",
    scenario,
    forced_tokens: ["菜单"],
    initial_greeting: { text: "您好", pinyin: "nín hǎo", audio_b64: "YQ==" },
  });
  await useRoleplayStore.getState().startSession(scenario.id);

  let handlers: Parameters<typeof connectRoleplaySocket>[1] | undefined;
  const socket = {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
  } as unknown as WebSocket;
  mockedConnect.mockImplementation((_sessionId, suppliedHandlers) => {
    handlers = suppliedHandlers;
    return socket;
  });

  useRoleplayStore.getState().connect();
  handlers!.onOpen();
  expect(useRoleplayStore.getState().sendSpeech("YXVkaW8=", "audio/mp4")).toBe(true);
  expect(useRoleplayStore.getState().isProcessing).toBe(true);

  handlers!.onEvent({
    event_type: "tars_response",
    transcribed_user_text: "我想要菜单",
    grammar_evaluations: [
      { target_token: "菜单", passed: true, feedback_explanation: null },
    ],
    ai_text_reply: "好的，给您菜单。",
    ai_pinyin: "hǎo de",
    ai_audio_b64: "YQ==",
    difficulty_adjusted: null,
  });

  expect(useRoleplayStore.getState().messages).toHaveLength(3);
  expect(useRoleplayStore.getState().messages[1].sender).toBe("user");
  expect(useRoleplayStore.getState().messages[2].text).toBe("好的，给您菜单。");
  expect(useRoleplayStore.getState().isProcessing).toBe(false);
  const state = useRoleplayStore.getState();
  expect(getFocusWordProgress(state.focusWords, state.messages)).toEqual(["passed", "current"]);
});

it("stores the server session summary", async () => {
  useRoleplayStore.setState({ sessionId: "session-1", forcedTokens: ["菜单"] });
  mockedEndSession.mockResolvedValue({
    total_turns: 2,
    tokens_forced: ["菜单"],
    tokens_passed: ["菜单"],
    tokens_failed: [],
  });

  const summary = await useRoleplayStore.getState().endSession();

  expect(summary.total_turns).toBe(2);
  expect(useRoleplayStore.getState().summary?.tokens_passed).toEqual(["菜单"]);
});

it("advances focus progress after three failed attempts", () => {
  const messages = Array.from({ length: 3 }, (_, index) => ({
    id: `user-${index}`,
    sender: "user" as const,
    text: "我不知道",
    evaluations: [
      { target_token: "菜单", passed: false, feedback_explanation: "再试一次" },
    ],
  }));

  expect(getFocusWordProgress(focusWords, messages)).toEqual(["failed", "current"]);
});
