const CLOZE_MARKER = "___";
const ELLIPSIS_PATTERN = /(?:\.{3,}|…+|。{3,})/gu;

function splitEllipsis(value: string): string[] {
  return value
    .split(ELLIPSIS_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function countClozeBlanks(sentence: string): number {
  return sentence.split(CLOZE_MARKER).length - 1;
}

export function getClozeAnswers(answer: string, blankCount: number): string[] {
  if (blankCount <= 0) return [];

  const orderedAnswers = splitEllipsis(answer);
  if (orderedAnswers.length === blankCount && blankCount > 1) {
    return orderedAnswers;
  }

  return Array(blankCount).fill(answer);
}

export function fillClozeSentence(sentence: string, answer: string): string {
  const parts = sentence.split(CLOZE_MARKER);
  const answers = getClozeAnswers(answer, parts.length - 1);

  return parts.reduce(
    (result, part, index) => result + part + (answers[index] ?? ""),
    ""
  );
}

export function normalizeClozeAnswer(answer: string): string {
  return answer
    .trim()
    .replace(ELLIPSIS_PATTERN, "...")
    .replace(/\s*\.\.\.\s*/gu, "...");
}

export function formatClozeAnswer(answer: string): string {
  return splitEllipsis(answer).join(" … ") || answer;
}

function answerPattern(answer: string): RegExp | null {
  const words = answer.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return null;

  const escapedWords = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  );
  return new RegExp(escapedWords.join("\\s+"), "iu");
}

export function hideClozePinyin(
  fullPinyin: string,
  answerPinyin: string,
  blankCount: number
): string {
  if (!fullPinyin.trim() || blankCount <= 0) return CLOZE_MARKER;

  const answers = getClozeAnswers(answerPinyin, blankCount);
  let hiddenPinyin = fullPinyin.trim();

  for (const answer of answers) {
    const pattern = answerPattern(answer);
    if (!pattern || !pattern.test(hiddenPinyin)) return CLOZE_MARKER;
    hiddenPinyin = hiddenPinyin.replace(pattern, CLOZE_MARKER);
  }

  return hiddenPinyin;
}
