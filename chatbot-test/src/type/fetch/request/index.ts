export type GeminiPart =
  | { text: string }
  | { functionCall: { id?: string; name: string; args: object } }
  | { functionResponse: { id?: string; name: string; response: object } };

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};
