import { getApiBase } from "./api";

export interface GrammarEvaluation {
  target_token: string;
  passed: boolean;
  feedback_explanation: string | null;
}

export type RoleplayServerEvent =
  | {
      event_type: "tars_response";
      transcribed_user_text: string;
      grammar_evaluations: GrammarEvaluation[];
      ai_text_reply: string;
      ai_pinyin: string;
      ai_audio_b64: string;
      difficulty_adjusted: string | null;
    }
  | {
      event_type: "hint_response";
      hint_text: string;
      suggested_structure: string;
    }
  | {
      event_type: "error";
      message: string;
      recoverable: boolean;
      error_code?: string;
    };

export interface RoleplaySocketHandlers {
  onOpen: () => void;
  onEvent: (event: RoleplayServerEvent) => void;
  onClose: () => void;
  onError: () => void;
}

export function getRoleplaySocketUrl(sessionId: string): string {
  const base = getApiBase().replace(/\/$/, "").replace(/^http/, "ws");
  return `${base}/api/roleplay/stream/${sessionId}`;
}

export function connectRoleplaySocket(
  sessionId: string,
  handlers: RoleplaySocketHandlers
): WebSocket {
  const socket = new WebSocket(getRoleplaySocketUrl(sessionId));
  socket.onopen = handlers.onOpen;
  socket.onclose = handlers.onClose;
  socket.onerror = handlers.onError;
  socket.onmessage = (message) => {
    try {
      const parsed = JSON.parse(String(message.data)) as RoleplayServerEvent;
      if (
        parsed.event_type === "tars_response" ||
        parsed.event_type === "hint_response" ||
        parsed.event_type === "error"
      ) {
        handlers.onEvent(parsed);
      }
    } catch {
      handlers.onEvent({
        event_type: "error",
        message: "收到无法识别的回复。",
        recoverable: true,
        error_code: "INVALID_SERVER_EVENT",
      });
    }
  };
  return socket;
}
