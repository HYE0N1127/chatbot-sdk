import {
  Message,
  MessageChunk,
  MessagePart,
  ReasoningPart,
  TextPart,
  ToolCallPart,
} from "../type/message/index";
import { generateId } from "../utils/id/index";
import { Connection } from "./connection/index";
import { consumeStream } from "../utils/stream/index";
import {
  createStreamingMessageState,
  StreamingMessageState,
} from "./create-streaming-message-state";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ActiveResponse = {
  state: StreamingMessageState;
  abortController: AbortController;
};

export class Chat {
  private _messages: Message[] = [];
  private _status: ChatStatus = "ready";
  private _error: Error | undefined;

  private listeners: Set<() => void> = new Set();
  private statusListeners: Set<() => void> = new Set();

  private onToolCall?: (part: ToolCallPart) => Promise<void> | void;

  private connect: Connection;
  private activeResponse: ActiveResponse | undefined;

  private queue: (() => Promise<void>)[] = [];

  /**
   * Chat 인스턴스를 생성합니다.
   *
   * @param options.connection - API 엔드포인트 및 통신 설정
   * @param options.prepareSendMessageRequest -
   */
  constructor({
    connection,
    onToolCall,
    messages,
  }: {
    connection: Connection;
    onToolCall?: (part: ToolCallPart) => void;
    messages: Message[];
  }) {
    this.onToolCall = onToolCall;
    this.connect = connection;
    this._messages = messages;
  }

  public setStatus = ({
    status,
    error,
  }:
    | { status: Exclude<ChatStatus, "error">; error?: undefined }
    | { status: "error"; error: Error }) => {
    this._status = status;
    this._error = error;
    this.notifyStatus();
  };

  private pushMessage = (message: Message) => {
    this._messages.push(message);
    this.notify();
  };

  private replaceMessage = (message: Message) => {
    const index = this.messages.findIndex((msg) => msg.id === message.id);

    this._messages = [
      ...this.messages.slice(0, index),
      structuredClone(message),
      ...this.messages.slice(index + 1),
    ];

    this.notify();
  };

  /**
   * Tool-Call로 받은 요청을 LLM에 전달하는 함수
   */
  public addToolOutput = async ({ toolCallId, output }: ToolCallPart) => {
    const lastMessage = this._messages[this._messages.length - 1];

    if (lastMessage == null) {
      return;
    }

    if (!lastMessage.parts.find((part) => part.type === "tool-call")) {
      return;
    }

    const updatedParts: MessagePart[] = lastMessage.parts.map((part) => {
      if (part.type === "tool-call" && part.toolCallId === toolCallId) {
        return {
          ...part,
          output,
        };
      }
      return part;
    });

    if (this.activeResponse != null) {
      this.activeResponse.state.message = {
        ...this.activeResponse.state.message,
        parts: updatedParts,
      };
    }

    const updatedMessage: Message = {
      ...lastMessage,
      parts: updatedParts,
    };

    this.replaceMessage(updatedMessage);

    const job = async (): Promise<void> => {
      await this.request();
    };

    if (this.status !== "submitted" && this.status !== "streaming") {
      job();
    } else {
      this.queue.push(job);
    }
  };

  public resumeStream = async ({
    body,
    headers,
  }: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}) => {
    // 현재 상태가 submitted, streaming 이라면 ai와 통신 중을 의미하기에, 실행을 막습니다.
    if (this.status === "submitted" || this.status === "streaming") {
      return;
    }

    const lastMessage = this._messages[this._messages.length - 1];

    if (
      lastMessage &&
      lastMessage.role !== "user" &&
      lastMessage.state !== "done"
    ) {
      await this.request({ body, headers });
    }
  };

  /**
   * 사용자 메시지를 전송하고 AI의 스트리밍 응답을 수신합니다.
   * @param input - 사용자가 입력한 질문 텍스트
   */
  public sendMessage = async ({
    text,
    body,
    headers,
  }: {
    text: string;
    body?: object;
    headers?: Headers | object;
  }) => {
    // 사용자 질문을 메시지 리스트에 추가합니다.
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      parts: [{ type: "text", content: text }],
    };

    this.pushMessage(userMessage);
    this.request({ body, headers });
  };

  private request = async ({
    body,
    headers,
  }: {
    body?: object;
    headers?: Headers | object;
  } = {}) => {
    this.setStatus({ status: "submitted" });

    this.activeResponse = {
      state: createStreamingMessageState({
        lastMessage: this.messages[this.messages.length - 1],
      }),
      abortController: new AbortController(),
    };

    const write = () => {
      if (this.activeResponse == null) {
        return;
      }

      const lastMessage = this.messages[this.messages.length - 1];

      if (lastMessage.id === this.activeResponse.state.message.id) {
        this.replaceMessage(this.activeResponse.state.message);
      } else {
        this.pushMessage(this.activeResponse.state.message);
      }
    };

    write();

    try {
      const response = await this.connect(
        {
          messages: this.messages,
          body,
          headers,
        },
        this.activeResponse.abortController.signal,
      );

      const { state } = this.activeResponse;

      await consumeStream<MessageChunk>({
        stream: response.pipeThrough(
          new TransformStream({
            transform: async (chunk, controller) => {
              this.setStatus({ status: "streaming" });

              switch (chunk.type) {
                case "text": {
                  if (state.activeTextParts[chunk.id] == null) {
                    const lastPart =
                      state.message.parts[state.message.parts.length - 1];

                    if (lastPart && lastPart.type === "text") {
                      state.activeTextParts[chunk.id] = lastPart as TextPart;
                    } else {
                      const textPart: TextPart = {
                        type: "text",
                        content: "",
                      };

                      state.activeTextParts[chunk.id] = textPart;
                      state.message.parts.push(textPart);
                    }
                  }

                  const textPart = state.activeTextParts[chunk.id];

                  textPart.content += chunk.content;
                  write();

                  break;
                }
                case "reasoning": {
                  if (state.activeReasoningParts[chunk.id] == null) {
                    const reasoningPart: ReasoningPart = {
                      type: "reasoning",
                      content: "",
                    };

                    state.activeReasoningParts[chunk.id] = reasoningPart;
                    state.message.parts.push(reasoningPart);
                  }

                  const reasoningPart = state.activeReasoningParts[chunk.id];

                  reasoningPart.content += chunk.content;
                  write();

                  break;
                }
                case "tool-call": {
                  const toolCallPart: ToolCallPart = {
                    type: "tool-call",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    input: chunk.input,
                  };

                  state.message.parts.push(toolCallPart);

                  write();

                  await this.onToolCall?.(toolCallPart);
                  break;
                }
                default:
                  return;
              }

              controller.enqueue(chunk);
            },
            flush: () => {
              state.message.state = "done";
              write();
            },
          }),
        ),
      });

      this.setStatus({ status: "ready" });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // 사용자가 직접 중단한 경우 state를 "done"으로 처리합니다.
        return;
      }

      if (error instanceof Error) {
        this.setStatus({ status: "error", error });
      }
    } finally {
      this.activeResponse = undefined;
    }

    while (this.queue.length > 0) {
      const job = this.queue.shift();

      await job?.();
    }
  };

  /**
   * 현재 진행 중인 스트리밍 응답을 중단합니다.
   */
  public abort = () => {
    this.activeResponse?.abortController?.abort();
  };

  public get messages(): Message[] {
    return this._messages;
  }

  public get isStreaming(): boolean {
    return this._messages.some((message) => message.state === "streaming");
  }

  public get status() {
    return this._status;
  }

  /**
   * 메시지 상태 변화를 감지하기 위한 구독 함수입니다.
   *
   * @param listener - 상태 변경 시 실행될 콜백 함수
   * @returns 구독 해제를 위한 unsubscribe 함수
   */
  public subscribeMessages = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public subscribeStatus = (listener: () => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private notifyStatus() {
    this.statusListeners.forEach((listener) => listener());
  }
}
