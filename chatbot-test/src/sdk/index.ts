import {
  Message,
  MessageChunk,
  MessagePart,
  ReasoningPart,
  TextPart,
} from "../type/message/index";
import { generateId } from "../utils/id/index";
import { ApiMessage, Connection } from "./connection/index";
import { consumeStream } from "../utils/stream/index";

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export class Chat {
  private _messages: Message[] = [];
  private _status: ChatStatus = "ready";
  private _error: Error | undefined;

  private listeners: Set<() => void> = new Set();
  private statusListeners: Set<() => void> = new Set();

  private connect: Connection;
  private abortController: AbortController | null = null;

  /**
   * Chat 인스턴스를 생성합니다.
   *
   * @param options.connection - API 엔드포인트 및 통신 설정
   * @param options.prepareSendMessageRequest -
   */
  constructor({ connection }: { connection: Connection }) {
    this.connect = connection;
  }

  public setStatus = ({
    status,
    error,
  }:
    | { status: Exclude<ChatStatus, "error">; error?: undefined }
    | { status: "error"; error: Error }) => {
    this._status = status;
    this._error = error;
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

  public addToolOutput = async () => {};

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
    if (this.isStreaming) {
      console.warn("이미 스트리밍 중입니다. 완료 후 다시 시도해주세요.");
      return;
    }

    this.abortController = new AbortController();

    // 사용자 질문을 메시지 리스트에 추가합니다.
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      parts: [{ type: "text", content: text }],
    };

    this.pushMessage(userMessage);

    // API 전송을 위한 메시지 포맷으로 가공합니다.
    const apiMessages: ApiMessage[] = this._messages.map((message) => ({
      role: message.role,
      content: message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.content)
        .join("\n"),
    }));

    /**
     * AI의 응답을 담을 빈 메시지를 미리 생성합니다.
     * TODO: 스트림을 재개해야 하는 케이스에서는 assistant 메세지를 새로 생성하지 않고 기존에 생성된 걸 활용해야 함.
     */
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      state: "streaming",
      parts: [],
    };

    const state = {
      message: structuredClone(assistantMessage),
      activeTextParts: {},
      activeReasoningParts: {},
    } as {
      message: Message;
      activeTextParts: Record<string, TextPart>;
      activeReasoningParts: Record<string, ReasoningPart>;
    };

    this.setStatus({ status: "submitted" });

    const write = () => {
      const lastMessage = this.messages[this.messages.length - 1];

      if (lastMessage.id === state.message.id) {
        this.replaceMessage(state.message);
      } else {
        this.pushMessage(state.message);
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
        this.abortController.signal,
      );

      await consumeStream<MessageChunk>({
        stream: response.pipeThrough(
          new TransformStream({
            transform: (chunk, controller) => {
              this.setStatus({ status: "streaming" });

              switch (chunk.type) {
                case "text": {
                  if (state.activeTextParts[chunk.id] == null) {
                    const textPart: TextPart = {
                      type: "text",
                      content: "",
                    };

                    state.activeTextParts[chunk.id] = textPart;
                    state.message.parts.push(textPart);
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
                // case "tool-call": {
                //   // tool-call chunk 를 part 로 만들어서 assistant 메세지에 삽입.
                //   // onToolCall?.(toolCallPart);
                //   break;
                // }
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
    }
  };

  /**
   * 현재 진행 중인 스트리밍 응답을 중단합니다.
   */
  public abort = () => {
    this.abortController?.abort();
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
}
