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

  /** Retry 이벤트를 받아온 경우 호출되는 CallBack 함수 */
  onReconnecting?: (retryDelay: number, attempt: number) => void;

  /** Retry 횟수 제한 (기본값: 3) */
  limit?: number;
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
    const { limit = 5, url, headers, body, formatPayload, transform } = config;
    let lastEventId: string | null = null;
    let retryDelay = 0;
    let attempt = 0;
    let buffer = "";

    const formatted = formatPayload
      ? formatPayload(payload)
      : { ...body, ...payload, stream: true };

    /**
     * 스트림은 일회성 이기에, ReadableStream을 생성하여 내부 스트림과 외부에 전달될 스트림을 다르게 처리합니다.
     * 서버 통신으로 스트림이 끊어지는 경우에도 현재 스트림은 스트리밍이 해제되지 않고 재연결 요청을 진행합니다.
     */
    return new ReadableStream<Chunk>({
      async start(controller) {
        const targetId = generateId();

        const connect = async (): Promise<void> => {
          try {
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(lastEventId && { "Last-Event-ID": lastEventId }),
                ...headers,
              },
              body: JSON.stringify(formatted),
              signal,
            });

            if (!response.ok || !response.body) {
              throw new Error(`네트워크 응답 에러: ${response.status}`);
            }

            attempt = 0;

            const reader = response.body
              .pipeThrough(new TextDecoderStream())
              .getReader();

            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                break;
              }

              const { events, pendingBuffer } = parseSSEChunk(value, buffer);
              buffer = pendingBuffer;

              for (const event of events) {
                if (event.id) {
                  lastEventId = event.id;
                }

                if (event.retry) {
                  retryDelay = parseInt(event.retry, 10);
                }

                if (event.data) {
                  try {
                    const parsed = JSON.parse(event.data) as T;
                    const textContent = transform(parsed);

                    if (textContent) {
                      controller.enqueue({
                        id: targetId,
                        content: textContent,
                      });
                    }
                  } catch (error) {
                    console.warn(`JSON 파싱 에러:`, error);
                  }
                }
              }
            }

            controller.close();
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              controller.close();
              return;
            }

            if (attempt < limit) {
              attempt++;

              config.onReconnecting?.(retryDelay, attempt);
              await new Promise((resolve) => setTimeout(resolve, retryDelay));

              return connect();
            } else {
              controller.error(error);
            }
          }
        };

        connect();
      },
    });
  };
};
