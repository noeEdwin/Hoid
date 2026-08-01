import type { ApiFlashcardDraft, RoleplayScenarioInput } from "./api";

export interface EditableFlashcardDraft extends ApiFlashcardDraft {}

export function normalizeScenarioTargets(targets: string[]): string[] {
  const seen = new Set<string>();
  return targets.flatMap((target) => {
    const normalized = target.trim().replace(/\s+/g, " ");
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key) || seen.size >= 10) return [];
    seen.add(key);
    return [normalized];
  });
}

export function validateScenarioInput(input: RoleplayScenarioInput): string | null {
  if (!input.title.trim()) return "请输入场景名称。";
  if (input.title.trim().length > 80) return "场景名称不能超过 80 个字符。";
  if (!input.description.trim()) return "请输入场景说明。";
  if (input.description.trim().length > 1000) return "场景说明不能超过 1000 个字符。";
  const targetCount = normalizeScenarioTargets(input.target_grammar).length;
  if (targetCount < 1) return "请至少添加一个练习目标。";
  if (targetCount > 10) return "练习目标最多为 10 个。";
  if (input.target_grammar.some((target) => target.trim().length > 40)) {
    return "每个练习目标不能超过 40 个字符。";
  }
  if ((input.example_prompt?.trim().length ?? 0) > 300) {
    return "开场白不能超过 300 个字符。";
  }
  return null;
}

export function validateScenarioRecommendationInput(input: {
  title: string;
  description: string;
  selected_targets: string[];
}): string | null {
  if (!input.title.trim()) return "请输入场景名称后再获取推荐。";
  if (input.title.trim().length > 80) return "场景名称不能超过 80 个字符。";
  if (!input.description.trim()) return "请输入场景说明后再获取推荐。";
  if (input.description.trim().length > 1000) return "场景说明不能超过 1000 个字符。";
  if (input.selected_targets.length > 10) return "练习目标最多为 10 个。";
  if (input.selected_targets.some((target) => target.trim().length > 40)) {
    return "每个练习目标不能超过 40 个字符。";
  }
  return null;
}

export function supportsLocalDeckStorage(platform: string): boolean {
  return platform !== "web";
}

export function validateFlashcardDraft(
  draft: EditableFlashcardDraft,
  deckId: string | null
): string | null {
  if (!deckId) return "请选择要保存到的卡组。";
  if (!draft.answer.trim()) return "答案不能为空。";
  if (!draft.sentence.trim()) return "例句不能为空。";
  if (!draft.sentence.includes("___")) return "例句必须包含空格标记 ___。";
  return null;
}

export function findDraftDuplicate<T extends { answer: string | null; sentence: string | null }>(
  cards: T[],
  draft: EditableFlashcardDraft
): T | undefined {
  const answer = draft.answer.trim().toLocaleLowerCase();
  const sentence = draft.sentence.trim().replace(/\s+/g, "").toLocaleLowerCase();
  return cards.find((card) => {
    const cardAnswer = (card.answer ?? "").trim().toLocaleLowerCase();
    const cardSentence = (card.sentence ?? "").trim().replace(/\s+/g, "").toLocaleLowerCase();
    return cardAnswer === answer || (!!sentence && cardSentence === sentence);
  });
}
