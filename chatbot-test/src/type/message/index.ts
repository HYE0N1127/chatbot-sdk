export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  state?: "streaming" | "done";
  parts: MessagePart[];
};

export type TextPart = {
  type: "text";
  content: string;
};

export type ReasoningPart = {
  type: "reasoning";
  content: string;
};

export type MessagePart = TextPart | ReasoningPart;

export type MessageChunk =
  | {
      type: "text";
      id: string;
      content: string;
    }
  | {
      type: "reasoning";
      id: string;
      content: string;
    };
