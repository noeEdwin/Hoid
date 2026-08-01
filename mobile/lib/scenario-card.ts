import { Directory, File, Paths } from "expo-file-system";
import { createFlashcard, updateFlashcardAudioPath } from "./database";
import { generateTTS } from "./api";
import { fillClozeSentence } from "./cloze";
import { pushPendingReviews } from "./sync";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { EditableFlashcardDraft } from "./scenario-form";

async function writeCardAudio(cardId: string, blob: Blob): Promise<void> {
  const directory = new Directory(Paths.document, "audio");
  if (!directory.exists) directory.create();
  const file = new File(directory, `${cardId}.mp3`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const base64 = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
  await file.write(base64, { encoding: "base64" });
  updateFlashcardAudioPath(cardId, file.uri);
}

export async function saveScenarioCardLocally(
  deckId: string,
  draft: EditableFlashcardDraft
): Promise<{ cardId: string; audioSaved: boolean; synced: boolean }> {
  const card = createFlashcard({
    deckId,
    sentence: draft.sentence.trim(),
    sentencePinyin: draft.sentence_pinyin.trim(),
    answer: draft.answer.trim(),
    answerPinyin: draft.answer_pinyin.trim(),
    context: draft.context.trim(),
    contextPinyin: draft.context_pinyin.trim(),
  });
  if (!card) throw new Error("Local card creation failed");
  let audioSaved = false;
  try {
    const text = fillClozeSentence(draft.sentence, draft.answer);
    await writeCardAudio(card.id, await generateTTS(text));
    audioSaved = true;
  } catch (error) {
    console.warn("Scenario card TTS failed; local card was retained:", error);
  }

  let synced = false;
  try {
    await pushPendingReviews(useSettingsStore.getState().getLastSyncAt());
    synced = true;
  } catch (error) {
    console.warn("Scenario card sync failed; local card was retained:", error);
  }
  return { cardId: card.id, audioSaved, synced };
}
