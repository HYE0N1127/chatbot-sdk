import { Chunk, Message } from "../type/message/index";
import { generateId } from "../utils/id/index";
import { Connection } from "./connection/index";
import { parseSSEChunk } from "./helpers";

/**
 * 서버에서 파싱된 JSON 객체에서 실제 텍스트 콘텐츠를 추출하는 함수의 타입입니다.
 * @template T - API 응답 객체의 타입
 */
export type ExtractChunk<T> = (parsed: T) => string;

/**
 * AI 모델과의 스트리밍 대화를 관리하는 코어 클래스입니다.
 * @template T - API가 반환하는 개별 JSON 데이터의 구조
 */
export class Chat<T = unknown> {
  private _messages: Message[] = [];
  private listeners: Set<() => void> = new Set();

  private connect: Connection;
  private extractChunk: ExtractChunk<T>;
  private abortController: AbortController | null = null;

  /**
   * Chat 인스턴스를 생성합니다.
   *
   * @param options.connection - API 엔드포인트 및 통신 설정
   * @param options.extractChunk - 응답 데이터에서 텍스트를 추출하는 함수
   */
  constructor(options: {
    connection: Connection;
    extractChunk: ExtractChunk<T>;
  }) {
    this.connect = options.connection;
    this.extractChunk = options.extractChunk;
  }

  /**
   * 사용자 메시지를 전송하고 AI의 스트리밍 응답을 수신합니다.
   * @param prompt - 사용자가 입력한 질문 텍스트
   */
  public sendMessages = async (prompt: string) => {
    this.abortController = new AbortController();

    // 사용자 질문을 메시지 리스트에 추가합니다.
    const promptId = generateId();
    const promptMessage: Message = {
      id: promptId,
      role: "user",
      content: prompt,
    };

    this.messages = [...this.messages, promptMessage];

    // API 전송을 위한 메시지 포맷으로 가공
    const apiMessages = this.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // AI의 응답을 담을 빈 메시지를 미리 생성합니다.
    const replyId = generateId();
    const pendingReply: Message = {
      id: replyId,
      role: "assistant",
      state: "streaming",
      content: "",
    };
    this.messages = [...this.messages, pendingReply];

    try {
      const response = await this.connect(
        { messages: apiMessages },
        this.abortController.signal,
      );

      if (!response.ok || !response.body) {
        throw new Error("네트워크 응답이 올바르지 않습니다.");
      }

      await this.parse(response, replyId, this.abortController.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // 사용자가 직접 중단한 경우 — state를 "done"으로 처리합니다.
        this.messages = this.messages.map((message) =>
          message.id === replyId ? { ...message, state: "done" } : message,
        );
        return;
      }

      console.error(`Send message Error: ${error}`);
      this.messages = this.messages.map((message) =>
        message.id === replyId ? { ...message, state: "error" } : message,
      );
    }
  };

  /**
   * 현재 진행 중인 스트리밍 응답을 중단합니다.
   */
  public abort = () => {
    this.abortController?.abort();
  };

  /**
   * ReadableStream를 읽어 실시간으로 메시지 상태를 업데이트합니다.
   *
   * @param response - Fetch 응답 객체
   * @param targetId - 업데이트할 대상 메시지의 ID (assistant 메시지)
   */
  private parse = async (
    response: Response,
    targetId: string,
    signal?: AbortSignal,
  ) => {
    if (response.body == null) {
      return;
    }

    let buffer = "";

    const reader = response.body
      .pipeThrough(new TextDecoderStream()) // 바이트를 문자열로 변환
      .pipeThrough(
        new TransformStream<string, Chunk>({
          transform: (chunk, controller) => {
            console.log(`Chunk: ${chunk}`);

            // SSE 규격에 맞춰 메시지를 분리하고 불완전한 끝부분은 버퍼에 저장합니다.
            const { messages, pendingBuffer } = parseSSEChunk(chunk, buffer);

            buffer = pendingBuffer;

            for (const cleanPart of messages) {
              try {
                const parsed = JSON.parse(cleanPart) as T;
                const textContent = this.extractChunk(parsed);

                if (textContent) {
                  // 추출된 텍스트를 다음 스트림 단계로 전달합니다.
                  controller.enqueue({ id: targetId, content: textContent });
                }
              } catch (e) {
                console.error(`파싱 에러: ${cleanPart}`, e);
              }
            }
          },
        }),
      )
      .getReader();

    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        // 스트림 종료 시 해당 메시지 상태를 'done'으로 변경합니다.
        this.messages = this.messages.map((message) =>
          message.id === targetId ? { ...message, state: "done" } : message,
        );
        break;
      }

      if (value && value.content) {
        this.messages = this.messages.map((message) =>
          message.id === targetId
            ? { ...message, content: message.content + value.content }
            : message,
        );
      }
    }
  };

  private set messages(value: Message[]) {
    this._messages = value;
    this.notify();
  }

  public get messages(): Message[] {
    return this._messages;
  }

  public get isStreaming(): boolean {
    return this._messages.at(-1)?.state === "streaming";
  }

  /**
   * 메시지 상태 변화를 감지하기 위한 구독 함수입니다.
   *
   * @param listener - 상태 변경 시 실행될 콜백 함수
   * @returns 구독 해제를 위한 unsubscribe 함수
   */
  public subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
