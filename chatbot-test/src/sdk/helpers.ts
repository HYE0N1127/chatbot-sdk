export type SSEEvent = {
  event?: string;
  id?: string;
  retry?: string;
  data?: string;
};

/**
 * 들어온 청크와 기존 버퍼를 조합하여, 완전한 SSE 메시지 배열과 남은 버퍼를 반환합니다.
 */
export const parseSSEChunk = (chunk: string, currentBuffer: string) => {
  // Windows(\r\n)나 구형 Mac(\r)에서 오는 줄바꿈 기호를 모두 표준인 \n으로 정규화합니다.
  const normalized = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 이전 청크에서 처리하지 못하고 넘겨진 Buffer와 방금 들어온 데이터를 합칩니다.
  const combinedBuffer = currentBuffer + normalized;

  // 두 개의 줄바꿈(\n\n)을 기준으로 데이터를 쪼갭니다.
  const parts = combinedBuffer.split("\n\n");

  /**
   * \n\n 을 기준으로 자른 데이터를 배열로 만들었을 경우, 마지막 데이터는 종료가 완전히 되지 않았을 경우가 높기에
   * 배열의 마지막 Data를 Pop을 통해 빼서 다음 함수 호출때 처리되도록 저장합니다.
   */
  const pendingBuffer = parts.pop() ?? "";

  const events: SSEEvent[] = [];

  for (const part of parts) {
    events.push(extract(part));
  }

  // 배열 반환
  return { events, pendingBuffer };
};

const extract = (part: string): SSEEvent => {
  const lines = part.split("\n");

  let eventType = "";
  let eventId = "";
  let retryTime = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case "event":
        eventType = value;
        break;
      case "id":
        eventId = value;
        break;
      case "retry":
        retryTime = value;
        break;
      case "data":
        dataLines.push(value);
        break;
    }
  }

  const joinedData = dataLines.join("\n");

  return {
    ...(eventType && { event: eventType }),
    ...(eventId && { id: eventId }),
    ...(retryTime && { retry: retryTime }),
    ...(joinedData && { data: joinedData }),
  };
};
