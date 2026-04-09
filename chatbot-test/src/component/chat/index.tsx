import { PropsWithChildren, useMemo } from "react";
import { Chat } from "../../sdk/index";
import { createConnection } from "../../sdk/connection/index";
import { ChatContext } from "./contexts";

type GeminiResponse = {
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

export const ChatProvider = ({ children }: PropsWithChildren) => {
  const value = useMemo(
    () =>
      new Chat({
        connection: createConnection<GeminiResponse>({
          url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
          headers: {
            "x-goog-api-key": process.env.REACT_APP_GEMINI_API_KEY || "",
          },
          formatPayload: (payload) => ({
            contents: payload.messages.map((msg) => ({
              role: msg.role === "assistant" ? "model" : msg.role,
              parts: [{ text: msg.content }],
            })),
            generationConfig: {
              thinkingConfig: {
                includeThoughts: true,
              },
            },
          }),
          transform: (data) => {
            const part = data.candidates?.[0]?.content?.parts?.[0];

            return {
              type: part.thought === true ? "reasoning" : "text",
              id: data.responseId,
              content: part.text,
            };
          },
        }),
      }),
    [],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
