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

/**
 data: {
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "get_current_temperature",
              "args": {
                "location": "서울"
              }
            },
            "thoughtSignature": "CiQBvj72+6HI8+eJU+HjXyUghM3MM47797x9IOCmyx0odxqx3BsKcQG+Pvb7Y1SKCAiwM3iWJpdHAx+Mx6Bii6Geb4gF9hAYRZQLUVQA3+410bGytrXucc7LkgA9oPgFgGIxOWcEOZNVUm93hhWXuRLO2zaduEtb+Uai2LHiwgK7MiSUcm9x2WaDQRGBmcAHnqxkfUhblLL2Cn8Bvj72+9rcvBHAh9Dz6+dPIECIBheD078daXnWa1+DnqqZTJevaxRKoYDQhlT0vpSP02RPovBrh+TBtwLliB9ngM5SP4qZVzt6bDp+sHnG9taRmBKLp5Se3T9NxUTrSDp739VILeRMXqcs6r0p42e46w/loB1LuqLqx5aEvATg"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "finishMessage": "Model generated function call(s)."
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 61,
    "candidatesTokenCount": 16,
    "totalTokenCount": 116,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 61
      }
    ],
    "thoughtsTokenCount": 39
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "EEXaacWqN_Ge0-kP-YCFeQ"
}
 */
