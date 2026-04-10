export type GeminiResponse = {
  candidates: {
    content: {
      parts: {
        text: string;
        thought?: boolean;
      }[];
    };
  }[];
  responseId: string;
};
