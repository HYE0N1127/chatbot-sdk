export type GeminiResponse = {
  candidates: {
    content: {
      parts: {
        text: string;
        thought?: boolean;
        functionCall?: {
          name: string;
          args: Record<string, unknown>;
          id?: string;
        };
      }[];
    };
  }[];
  responseId: string;
};
