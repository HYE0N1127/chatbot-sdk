import { useState } from "react";
import { useChat } from "./hooks/hooks";
import { GeminiResponse } from "./type/fetch/response/index";
import { MessageChunk, ToolCallPart } from "./type/message/index";
import { GeminiContent, GeminiPart } from "./type/fetch/request/index";

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
              /**
               * Gemini는 Function-Call 사용 시 user Role에서 functionResponse 필드를, model Role에서 functionCall 필드를 갖고 있어야 하기에
               * 이를 partOutput이 존재하는지 여부를 거쳐 userRole로 추가합니다.
               */
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

      sendMessage({});
    },
  });

  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) {
      return;
    }

    sendMessage({ text: inputText });
    setInputText("");
  };

  const getWeatherInfo = async (): Promise<Record<string, unknown>> => {
    return {
      temperature: 24,
      location: "Seoul",
      chancePrecipitation: "56%",
      cloudConditions: "partlyCloudy",
    };
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <div
        style={{
          border: "1px solid #ccc",
          padding: "10px",
          minHeight: "400px",
          marginBottom: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((message) => (
          <div key={message.id}>
            {message.parts.map((part, index) => {
              switch (part.type) {
                case "text":
                  return <p key={index}>{part.content}</p>;
                case "reasoning":
                  return (
                    <details key={index}>
                      <summary>사고 과정</summary>
                      <div style={{ color: "gray", fontSize: "12px" }}>
                        {part.content}
                      </div>
                    </details>
                  );
                case "tool-call": {
                  if (part.toolName === "get_current_temperature") {
                    if (part.output) {
                      return null;
                    }

                    return (
                      <div key={index}>
                        날씨를 조회해도 되겠읍니까?
                        <button
                          onClick={async () => {
                            const weather = await getWeatherInfo();

                            await addToolOutput({
                              ...part,
                              output: weather,
                            });

                            sendMessage({});
                          }}
                        >
                          네
                        </button>
                        <button>네니오</button>
                      </div>
                    );
                  }
                  break;
                }

                default:
                  return null;
              }
            })}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") handleSend();
          }}
          style={{ flex: 1, padding: "10px" }}
          placeholder="메시지를 입력하세요..."
        />
        <button onClick={handleSend} style={{ padding: "10px 20px" }}>
          전송
        </button>
      </div>
    </div>
  );
}

export default App;

/**
 * 미친듯이 긴 답변이 날라오는 프롬프트
 * "React의 핵심 동작 원리인 Virtual DOM의 탄생 배경부터, 브라우저의 실제 DOM과 비교하는 Reconcilation(재조정) 알고리즘의 작동 방식, 그리고 React 16부터 도입된 Fiber 아키텍처가 렌더링 최적화를 어떻게 이뤄냈는지 밑바닥부터 딥다이브해서 아주 길고 상세하게 논문처럼 설명해줘. 각 단계별로 내부 동작을 보여주는 의사 코드(Pseudo-code)나 자바스크립트 예시 코드를 듬뿍 섞어서 작성해줘."
 */
