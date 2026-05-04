type Props = {
  role: string;
  parts: any[];
};

const Bubble = ({ role, parts }: Props) => {
  const isUser = role === "user";

  return (
    <div
      className={`flex w-full gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* 모델 아바타 */}
      {!isUser && <div className="text-2xl mt-1">✨</div>}

      <div
        className={`
          max-w-[85%] md:max-w-[70%] text-[15px] text-gray-800
          ${isUser ? "bg-blue-50 px-4 py-3" : "bg-transparent py-2"}
          rounded-2xl 
          ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}
        `}
      >
        <div className="flex flex-col gap-2">
          {parts.map((part, index) => {
            switch (part.type) {
              case "text":
                return (
                  <div
                    key={index}
                    className="leading-relaxed whitespace-pre-wrap"
                  >
                    {part.content}
                  </div>
                );

              case "reasoning":
                return (
                  <details
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-2 group"
                  >
                    <summary className="cursor-pointer text-sm font-medium text-gray-600 outline-none list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
                      <span className="transition-transform group-open:rotate-90">
                        ▶
                      </span>
                      사고 과정
                    </summary>
                    <div className="mt-2 pt-2 border-t border-gray-200 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {part.content}
                    </div>
                  </details>
                );
              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
};

export default Bubble;
