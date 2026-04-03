import { parseSSEChunk } from "../helpers";
import { Chunk } from "../index";
import { generateId } from "../../utils/id/index";

export type Role = "system" | "user" | "assistant";

type ApiMessage = {
  role: Role;
  content: string;
};

export type Payload = {
  /** 사용할 AI 모델명 */
  model?: string;

  /** 대화 내역 배열 */
  messages: ApiMessage[];

  /** 스트리밍 여부 */
  stream?: boolean;

  /** 답변의 창의성 */
  temperature?: number;
};

export type Config<T> = {
  /** API URL */
  url: string;

  /** Headers */
  headers?: Record<string, string>;

  /** Request Body */
  body?: Record<string, unknown>;

  /** 원하는 api에 맞는 규격으로 format하는 함수를 전달받습니다. */
  formatPayload?: (payload: Payload) => unknown;

  transform: (parsed: T) => string;
};

export type Connection = (
  payload: Payload,
  signal?: AbortSignal,
) => Promise<ReadableStream<Chunk>>;

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
    payload: Payload,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Chunk>> => {
    /**
     * formatPayload가 존재하는 경우, 이에 맞는 payload로 변경하는 작업을 진행합니다.
     */
    const body = config.formatPayload
      ? config.formatPayload(payload)
      : { ...config.body, ...payload, stream: true };

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error("네트워크 응답이 올바르지 않습니다.");
    }

    const targetId = generateId();
    let buffer = "";

    return response.body
      .pipeThrough(new TextDecoderStream()) // 바이트를 문자열로 변환
      .pipeThrough(
        new TransformStream<string, Chunk>({
          transform: (chunk, controller) => {
            // SSE 규격에 맞춰 메시지를 분리하고 불완전한 끝부분은 버퍼에 저장합니다.
            const { messages, pendingBuffer } = parseSSEChunk(chunk, buffer);

            buffer = pendingBuffer;

            for (const jsonString of messages) {
              try {
                const parsed = JSON.parse(jsonString) as T;
                const textContent = config.transform(parsed);

                if (textContent) {
                  // 추출된 텍스트를 다음 스트림 단계로 전달합니다.
                  controller.enqueue({ id: targetId, content: textContent });
                }
              } catch (e) {
                console.error(`파싱 에러: ${jsonString}`, e);
              }
            }
          },
        }),
      );
  };
};
