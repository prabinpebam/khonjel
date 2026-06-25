import type { ChatService, ChatTokenEvent, ChatSendRequest } from "@services/ports";

/**
 * Mock chat — simulates streamed token generation in the browser preview: a canned reply is emitted
 * word-by-word on a timer (token events), then a final `done`. `stop` cancels mid-stream and emits a
 * `done` with whatever was accumulated, exactly as the real main-process streamer will.
 */
const REPLY =
  "Here is a simulated streaming reply. The real model fills this in token by token; the mock " +
  "drives the same lifecycle so the UI can be built and tested without a backend.";

interface Active {
  timer: ReturnType<typeof setInterval>;
  threadId: string;
  full: string;
}

const listeners = new Set<(event: ChatTokenEvent) => void>();
const active = new Map<string, Active>();

function emit(event: ChatTokenEvent): void {
  for (const cb of listeners) cb(event);
}

export const mockChatService: ChatService = {
  send: async (req: ChatSendRequest) => {
    const words = REPLY.split(" ");
    let i = 0;
    const state: Active = {
      threadId: req.threadId,
      full: "",
      timer: setInterval(() => {
        if (i >= words.length) {
          clearInterval(state.timer);
          active.delete(req.requestId);
          emit({ requestId: req.requestId, threadId: req.threadId, kind: "done", delta: "", fullText: state.full });
          return;
        }
        const word = words[i++] ?? "";
        state.full = state.full ? `${state.full} ${word}` : word;
        emit({ requestId: req.requestId, threadId: req.threadId, kind: "token", delta: word, fullText: state.full });
      }, 35),
    };
    active.set(req.requestId, state);
  },
  stop: (requestId) => {
    const a = active.get(requestId);
    if (!a) return;
    clearInterval(a.timer);
    active.delete(requestId);
    emit({ requestId, threadId: a.threadId, kind: "done", delta: "", fullText: a.full });
  },
  onToken: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
