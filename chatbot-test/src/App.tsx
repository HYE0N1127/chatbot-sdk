import { useEffect, useMemo, useState } from "react";
import { createConnection } from "./sdk/connection";
import { Chat } from "./sdk/index";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

// type OpenAIRepresentation = {
//   choices: Array<{
//     delta: {
//       content?: string;
//     };
//     finish_reason?: string | null;
//   }>;
// };

// type ClaudeRepresentation = {
//   type: string;
//   delta?: {
//     text?: string;
//   };
// };

function App() {
  const [inputText, setInputText] = useState("");
  const [, setTick] = useState(0);

  const chat = useMemo(() => {
    return new Chat<GeminiResponse>({
      connection: createConnection({
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
        headers: {
          "x-goog-api-key": process.env.REACT_APP_GEMINI_API_KEY || "",
        },
        formatPayload: (payload) => ({
          contents: payload.messages.map((msg) => ({
            role: msg.role === "assistant" ? "model" : msg.role,
            parts: [{ text: msg.content }],
          })),
        }),
      }),
      extractChunk: (parsed) => {
        return parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
      },
    });
  }, []);

  // const chat = new Chat<OpenAIRepresentation>({
  //   connection: createConnection({
  //     url: "https://api.openai.com/v1/chat/completions",
  //     headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  //     formatPayload: (payload) => ({
  //       model: "gpt-4o",
  //       messages: payload.messages,
  //       stream: true,
  //     }),
  //   }),
  //   extractChunk: (parsed) => {
  //     return parsed.choices[0]?.delta?.content || "";
  //   },
  // });

  // const chat = new Chat<ClaudeRepresentation>({
  //   connection: createConnection({
  //     url: "https://api.anthropic.com/v1/messages",
  //     headers: {
  //       "x-api-key": CLAUDE_API_KEY,
  //       "anthropic-version": "2023-06-01",
  //     },
  //     formatPayload: (payload) => ({
  //       model: "claude-3-5-sonnet-20240620",
  //       max_tokens: 1024,
  //       messages: payload.messages,
  //       stream: true,
  //     }),
  //   }),
  //   extractChunk: (parsed) => {
  //     return parsed.type === "content_block_delta"
  //       ? parsed.delta?.text || ""
  //       : "";
  //   },
  // });

  useEffect(() => {
    const unsubscribe = chat.subscribe(() => {
      setTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, [chat]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    chat.sendMessage(inputText);
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
        {chat.messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              textAlign: msg.role === "user" ? "right" : "left",
              color: msg.role === "user" ? "blue" : "black",
            }}
          >
            <strong>{msg.role === "user" ? "나: " : "AI: "}</strong>
            {msg.content}
            {msg.state === "streaming" && <span> █</span>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) {
              return;
            }

            if (e.key === "Enter") {
              handleSend();
            }
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
