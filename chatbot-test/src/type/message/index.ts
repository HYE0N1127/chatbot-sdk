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

// export type ToolCallPart = {
//   type: "tool-call";
//   toolCallId: string;
//   toolName: string;
//   input: Record<string, unknown>;
//   output?: Record<string, unknown>;
// };

export type MessagePart = TextPart | ReasoningPart;
// export type MessagePart = TextPart | ReasoningPart | ToolCallPart;

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
// | {
//     type: "tool-call";
//     toolCallId: string;
//     toolName: string;

//     /**
//      * {
//      *   location: '서울',
//      * }
//      */
//     input: Record<string, unknown>;
//   };
