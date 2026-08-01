import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File, Paths } from "expo-file-system";

interface RecordedAudio {
  base64: string;
  mimeType: string;
}

function removePlayer(
  playerRef: React.MutableRefObject<ReturnType<typeof createAudioPlayer> | null>
): void {
  if (!playerRef.current) return;
  try {
    playerRef.current.pause();
    playerRef.current.remove();
  } catch {
    // The native player may already have been released.
  }
  playerRef.current = null;
}

export function useRoleplayAudio() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const temporaryFilesRef = useRef<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    removePlayer(playerRef);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError("需要麦克风权限才能开始对话。");
      return false;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return true;
    } catch {
      setError("无法启动录音，请重试。");
      return false;
    }
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<RecordedAudio | null> => {
    try {
      const durationMillis = recorder.getStatus().durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (durationMillis < 350) {
        setError("录音太短，请再说一次。");
        return null;
      }
      if (!recorder.uri) {
        setError("没有找到录音文件，请重试。");
        return null;
      }
      const recording = new File(recorder.uri);
      const mimeType = recording.extension === ".webm" ? "audio/webm" : "audio/mp4";
      return { base64: await recording.base64(), mimeType };
    } catch {
      setError("录音处理失败，请重试。");
      return null;
    }
  }, [recorder]);

  const playBase64Audio = useCallback(async (id: string, audioB64: string): Promise<void> => {
    try {
      removePlayer(playerRef);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const file = new File(Paths.cache, `roleplay-${id}.mp3`);
      if (file.exists) file.delete();
      file.write(audioB64, { encoding: "base64" });
      temporaryFilesRef.current.push(file);
      const player = createAudioPlayer({ uri: file.uri });
      playerRef.current = player;
      player.play();
    } catch {
      setError("语音播放失败，可以继续文字对话。");
    }
  }, []);

  const stopAudio = useCallback(() => removePlayer(playerRef), []);

  useEffect(() => {
    return () => {
      removePlayer(playerRef);
      for (const file of temporaryFilesRef.current) {
        try {
          if (file.exists) file.delete();
        } catch {
          // Cache cleanup should not block navigation.
        }
      }
    };
  }, []);

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    error,
    clearError: () => setError(null),
    startRecording,
    stopRecording,
    playBase64Audio,
    stopAudio,
  };
}
