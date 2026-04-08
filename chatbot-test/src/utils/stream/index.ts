export const consumeStream = async <T>({
  stream,
  onError,
  onDone,
}: {
  stream: ReadableStream<T>;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}): Promise<void> => {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done } = await reader.read();

      if (done) {
        onDone?.();
        break;
      }
    }
  } catch (error) {
    onError?.(error);
  }
};
