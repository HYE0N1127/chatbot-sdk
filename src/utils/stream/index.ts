export const consumeStream = async <T>({
  stream,
  onError,
}: {
  stream: ReadableStream<T>;
  onError?: (error: unknown) => void;
}): Promise<void> => {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done } = await reader.read();

      if (done) {
        break;
      }
    }
  } catch (error) {
    onError?.(error);
  }
};
