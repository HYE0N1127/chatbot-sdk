import {
  Message,
  ReasoningPart,
  TextPart,
  ToolCallPart,
} from "../type/message/index";
import { generateId } from "../utils/id/index";

export type StreamingMessageState = {
  message: Message;
  activeTextParts: Record<string, TextPart>;
  activeReasoningParts: Record<string, ReasoningPart>;
};

export const createStreamingMessageState = ({
  lastMessage,
}: {
  lastMessage: Message;
}): StreamingMessageState => {
  return {
    message:
      lastMessage.role === "assistant"
        ? structuredClone(lastMessage)
        : {
            id: generateId(),
            role: "assistant",
            state: "streaming",
            parts: [],
          },
    activeTextParts: {},
    activeReasoningParts: {},
  };
};
