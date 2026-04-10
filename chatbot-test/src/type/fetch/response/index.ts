export type GeminiResponse = {
  candidates: {
    content: {
      parts: {
        text: string;
        thought?: boolean;
        functionCall?: string;
      }[];
    };
  }[];
  responseId: string;
};
