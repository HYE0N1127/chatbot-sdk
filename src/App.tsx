import { useEffect, useRef } from "react";
import { useChat } from "./hooks/hooks";
import { GeminiResponse } from "./type/fetch/response/index";
import { MessageChunk, ToolCallPart } from "./type/message/index";
import { GeminiContent, GeminiPart } from "./type/fetch/request/index";
import Input from "./components/input/index";
import Bubble from "./components/bubble/index";

function App() {
  const { messages, sendMessage, addToolOutput } = useChat<GeminiResponse>({
    config: {
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
      headers: {
        "x-goog-api-key": process.env.REACT_APP_GEMINI_API_KEY || "",
      },
      body: {
        tools: [
          {
            functionDeclarations: [
              {
                name: "get_current_temperature",
                description:
                  "Gets the current temperature for a given location.",
                parameters: {
                  type: "object",
                  properties: {
                    location: {
                      type: "string",
                      description: "The city name, e.g. Seoul",
                    },
                  },
                  required: ["location"],
                },
              },
            ],
          },
        ],
      },
      prepareRequest: ({ messages, body }) => {
        const contents: GeminiContent[] = [];

        messages.forEach((message) => {
          switch (message.role) {
            case "user": {
              const userParts = message.parts
                .map((part): GeminiPart | null => {
                  if (part.type === "text") {
                    return { text: part.content || "" };
                  }
                  return null;
                })
                .filter((part): part is GeminiPart => part !== null);

              if (userParts.length > 0) {
                contents.push({
                  role: "user",
                  parts: userParts,
                });
              }
              break;
            }

            case "assistant": {
              const modelParts: GeminiPart[] = [];
              const userResponseParts: GeminiPart[] = [];

              message.parts.forEach((part) => {
                if (part.type === "text") {
                  modelParts.push({ text: part.content });
                } else if (part.type === "tool-call") {
                  modelParts.push({
                    functionCall: {
                      id: part.toolCallId,
                      name: part.toolName,
                      args: part.input,
                    },
                  });

                  if (part.output) {
                    userResponseParts.push({
                      functionResponse: {
                        id: part.toolCallId,
                        name: part.toolName,
                        response: part.output,
                      },
                    });
                  }
                }
              });

              // 한 청크에 여러 Parts의 데이터가 존재하는 경우를 대비합니다.
              if (modelParts.length > 0) {
                contents.push({ role: "model", parts: modelParts });
              }
              if (userResponseParts.length > 0) {
                contents.push({ role: "user", parts: userResponseParts });
              }
              break;
            }
          }
        });

        return {
          body: {
            ...body,
            contents: contents,
            generationConfig: {
              thinkingConfig: { includeThoughts: true },
            },
          },
        };
      },
      transform: (data) => {
        const part = data.candidates?.[0]?.content?.parts?.[0];

        if (part.functionCall) {
          return {
            type: "tool-call",
            toolCallId: data.responseId,
            toolName: part.functionCall.name,
            input: part.functionCall.args,
          } as MessageChunk;
        } else {
          return {
            type: part.thought ? "reasoning" : "text",
            id: data.responseId,
            content: part.text,
          };
        }
      },
    },
    onToolCall: async (part: ToolCallPart) => {
      /**
       * onToolCall은 유저의 승인을 받을 때 사용하는 것이 아닌, 유저의 경험을 위해 자동적으로 LLM의 데이터를 인터셉트하는 과정에서 사용되는 함수.
       */
      switch (part.toolName) {
        case "get_current_temperature": {
          const weather = await getWeatherInfo();

          await addToolOutput({
            ...part,
            output: weather,
          });
          break;
        }

        default: {
          console.log("default");
          break;
        }
      }
    },
  });

  const getWeatherInfo = async (): Promise<Record<string, unknown>> => {
    return {
      temperature: 24,
      location: "Seoul",
      chancePrecipitation: "56%",
      cloudConditions: "흐림",
    };
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (text: string) => {
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto font-sans bg-white shadow-sm">
      <header className="px-6 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-800 m-0">ChatBot</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-white scroll-smooth">
        {messages.map((message) => (
          <Bubble key={message.id} role={message.role} parts={message.parts} />
        ))}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* 입력 영역 */}
      <Input onSend={handleSendMessage} />
    </div>
  );
}

export default App;
