import { useState } from "react";

type ChatInputProps = {
  onSend: (text: string) => void;
};

const Input = ({ onSend }: ChatInputProps) => {
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) {
      return;
    }

    onSend(inputText);
    setInputText("");
  };

  return (
    <div className="p-5 bg-white border-t border-gray-100">
      <div className="flex items-center bg-gray-100 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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
          className="flex-1 bg-transparent border-none outline-none py-2 px-2 text-[15px]"
          placeholder="메시지를 입력하세요..."
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className={`
            w-8 h-8 rounded-full flex items-center justify-center text-white
            transition-all duration-200
            ${inputText.trim() ? "bg-blue-600 hover:bg-blue-700 cursor-pointer" : "bg-gray-300 cursor-not-allowed"}
          `}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Input;
