import { useState } from "react";
import { useChat } from "./hooks/hooks";
import { GeminiResponse } from "./type/fetch/response/index";

function App() {
  const { messages, sendMessage, addToolOutput } = useChat<GeminiResponse>({
    config: {
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
      headers: {
        "x-goog-api-key": process.env.REACT_APP_GEMINI_API_KEY || "",
      },
      body: {
        functionDeclarations: [
          {
            name: "get_current_temperature",
            description: "Gets the current temperature for a given location.",
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
          {
            name: "reservation_motel",
            description: "Reserves a motel for a given location.",
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
      prepareRequest: ({ messages }) => {
        return {
          body: {
            contents: messages.map((message) => ({
              role: message.role === "assistant" ? "model" : message.role,
              parts: message.parts
                .filter((part) => part.type === "text")
                .map((part) => ({ text: part.content })),
            })),
            generationConfig: {
              thinkingConfig: {
                includeThoughts: true,
              },
            },
          },
        };
      },
      transform: (data) => {
        const part = data.candidates?.[0]?.content?.parts?.[0];

        return {
          type: part.thought === true ? "reasoning" : "text",
          id: data.responseId,
          content: part.text,
        };
      },
    },
    // onToolCall: async (part) => {
    //   const weather = await getWeatherInfo();

    //   // addToolOutput({
    //   //   toolCallId: part.toolCallId,
    //   //   output: weather,
    //   // });
    // },
  });

  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage({ text: inputText });
    setInputText("");
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
                // case "tool-call": {
                //   if (part.toolName === "get_current_temperature") {
                //     return (
                //       <div>
                //         날씨를 조회해도 되겠읍니까?
                //         <button
                //           onClick={async () => {
                //             // chat.~ 메서드를 호출해서, weather 를 전달하면, tool-call part 에 그 데이터가 output 이라는 필드명으로 삽입됨.
                //           }}
                //         >
                //           네
                //         </button>
                //         <button>네니오</button>
                //       </div>
                //     );
                //   }
                //   break;
                // }

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
