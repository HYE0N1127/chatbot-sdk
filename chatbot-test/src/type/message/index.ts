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

export type ToolCallPart = {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  /**
   * tool-call 요청이 들어오고 외부 함수를 호출 한 결과값을 담을 객체
   */
  output?: Record<string, unknown>;
};

export type MessagePart = TextPart | ReasoningPart | ToolCallPart;

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
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;

      /**
       * LLM이 우리에게 주는 값. LLM이 특정 단어를 인식하면 Tool-Call 요청을 보내고, 이를 통해 우리가 정의한 Properties라는 객체 내부에 들어오게 됨.
       * {
       *   location: '서울',
       * }
       */
      input: Record<string, unknown>;
    };
