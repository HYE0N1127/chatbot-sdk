import { useState } from "react";
import { useChat, useMessages } from "./component/chat/hooks";

function App() {
  const chat = useChat();
  const messages = useMessages();
  const [inputText, setInputText] = useState("");

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
