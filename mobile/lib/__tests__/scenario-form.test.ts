import {
  findDraftDuplicate,
  normalizeScenarioTargets,
  supportsLocalDeckStorage,
  validateFlashcardDraft,
  validateScenarioInput,
  validateScenarioRecommendationInput,
} from "../scenario-form";

const draft = {
  answer: "买单",
  answer_pinyin: "mǎi dān",
  sentence: "请问在哪里___？",
  sentence_pinyin: "qǐng wèn zài nǎ lǐ mǎi dān",
  context: "吃完饭以后买单。",
  context_pinyin: "chī wán fàn yǐ hòu mǎi dān",
};

it("normalizes, deduplicates, and caps scenario targets", () => {
  const targets = ["  想要  ", "想要", "把   字句", ...Array.from({ length: 12 }, (_, index) => `词${index}`)];
  expect(normalizeScenarioTargets(targets)).toEqual(["想要", "把 字句", "词0", "词1", "词2", "词3", "词4", "词5", "词6", "词7"]);
});

it("requires title, description, and at least one target", () => {
  expect(validateScenarioInput({ title: "", description: "说明", difficulty: "beginner", target_grammar: ["想要"], example_prompt: null })).toContain("名称");
  expect(validateScenarioInput({ title: "花店", description: "", difficulty: "beginner", target_grammar: ["想要"], example_prompt: null })).toContain("说明");
  expect(validateScenarioInput({ title: "花店", description: "说明", difficulty: "beginner", target_grammar: [], example_prompt: null })).toContain("至少");
});

it("validates recommendation limits before calling the backend", () => {
  expect(validateScenarioRecommendationInput({
    title: "花店",
    description: "说".repeat(1001),
    selected_targets: [],
  })).toContain("1000");
  expect(validateScenarioRecommendationInput({
    title: "花店",
    description: "买花",
    selected_targets: ["词".repeat(41)],
  })).toContain("40");
  expect(validateScenarioRecommendationInput({
    title: "花店",
    description: "买花",
    selected_targets: ["鲜花"],
  })).toBeNull();
});

it("does not attempt local deck storage on web", () => {
  expect(supportsLocalDeckStorage("web")).toBe(false);
  expect(supportsLocalDeckStorage("android")).toBe(true);
  expect(supportsLocalDeckStorage("ios")).toBe(true);
});

it("validates draft content and explicit deck choice", () => {
  expect(validateFlashcardDraft(draft, null)).toContain("选择");
  expect(validateFlashcardDraft({ ...draft, sentence: "我想买单" }, "deck-1")).toContain("___");
  expect(validateFlashcardDraft(draft, "deck-1")).toBeNull();
});

it("detects a reasonable duplicate only in the supplied deck cards", () => {
  const cards = [{ answer: "买单", sentence: "另一句话___。" }];
  expect(findDraftDuplicate(cards, draft)).toEqual(cards[0]);
  expect(findDraftDuplicate([{ answer: "菜单", sentence: "请给我___。" }], draft)).toBeUndefined();
});
