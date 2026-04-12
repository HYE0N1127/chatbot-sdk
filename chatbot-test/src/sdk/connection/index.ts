import { parseSSEChunk } from "../helpers";
import { Message, MessageChunk } from "../../type/message/index";

export type Role = "system" | "user" | "assistant";

export type PrepareRequestFunction = (options: {
  messages: Message[];
  body: object | undefined;
  headers: Headers | object | undefined;
}) =>
  | Promise<{
      body: object;
      headers?: Headers | object;
    }>
  | {
      body: object;
      headers?: Headers | object;
    };

export type ApiMessage = {
  role: Role;
  content: string;
};

export type ConnectionOptions = {
  messages: Message[];
  body: object | undefined;
  headers: Headers | object | undefined;
};

export type Config<T> = {
  /** API URL */
  url: string;

  /** Headers */
  headers?: Record<string, string>;

  /** Request Body */
  body?: Record<string, unknown>;

  transform: (parsed: T) => MessageChunk;

  prepareRequest?: PrepareRequestFunction;

  /** Retry 횟수 제한 (기본값: 3) */
  limit?: number;
};

export type Connection = (
  options: ConnectionOptions,
  signal?: AbortSignal,
) => Promise<ReadableStream<MessageChunk>>;

/**
 * 주어진 설정을 바탕으로 AI API와의 통신을 담당하는 Connection 함수를 생성합니다.
 * 
 * @param config API 통신에 필요한 URL, 헤더, 데이터 변환 로직 등을 담은 설정 객체
 * @returns 대화 페이로드를 받아 fetch 요청을 수행하는 함수
 * 
 * @example
 * createConnection({
    url: "API_URL",
    headers: {
      "x-goog-api-key": API_KEY,
    },
    formatPayload: (payload) => ({
      contents: payload.messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      })),
    }),
  }
 */
export const createConnection = <T>(config: Config<T>): Connection => {
  return async (
    options: ConnectionOptions,
    signal?: AbortSignal,
  ): Promise<ReadableStream<MessageChunk>> => {
    const { url, transform: transformChunk, prepareRequest } = config;
    let buffer = "";

    const body = { ...config.body, ...options.body };
    const headers = { ...config.headers, ...options.headers };

    const prepared = await prepareRequest?.({
      body,
      headers,
      messages: options.messages,
    });

    const finalBody = prepared?.body ?? body;
    const finalHeaders = prepared?.headers ?? headers;

    const connect = async (): Promise<ReadableStream<MessageChunk>> => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/event-stream",
          ...finalHeaders,
        },
        body: JSON.stringify(finalBody),
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`네트워크 응답 에러: ${response.status}`);
      }

      return response.body.pipeThrough(new TextDecoderStream()).pipeThrough(
        new TransformStream<string, MessageChunk>({
          transform: (chunk, controller) => {
            const { events, pendingBuffer } = parseSSEChunk(chunk, buffer);
            buffer = pendingBuffer;

            for (const event of events) {
              if (event.data) {
                try {
                  const parsed = JSON.parse(event.data) as T;

                  controller.enqueue(transformChunk(parsed));
                } catch (e) {
                  console.warn(`JSON 파싱 에러:`, e);
                }
              }
            }
          },
        }),
      );
    };

    return connect();
  };
};
