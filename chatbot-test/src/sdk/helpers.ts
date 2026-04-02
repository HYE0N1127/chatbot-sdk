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

  const messages: string[] = [];

  for (const part of parts) {
    // 이벤트 블록 안에서 'data: ' 로 시작하는 줄을 찾아서, 그 뒤에 오는 실제 내용만 추출합니다.
    // (?:^|\n) : 문자열 시작이거나 줄바꿈 직후
    // data: ? : 'data:' 뒤에 공백이 0개 또는 1개
    // (.*) : 그 뒤의 모든 문자 (이 부분이 캡처 그룹 1이 됩니다)
    const dataLines = Array.from(part.matchAll(/(?:^|\n)data: ?(.*)/g)).map(
      (match) => match[1],
    );

    // 'data:' 줄이 없으면 의미 없는 이벤트이기에, 무시하고 다음으로 넘어갑니다
    if (dataLines.length === 0) {
      continue;
    }

    // 한 이벤트 안에 여러 'data: ' 줄이 오는 것을 방지하고, 줄바꿈을 통해 하나의 문자열로 변환합니다.
    const joined = dataLines.join("\n");

    if (!joined || joined === "[DONE]") {
      continue;
    }

    messages.push(joined);
  }

  return { messages, pendingBuffer };
};
