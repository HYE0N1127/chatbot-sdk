import { useMemo, useSyncExternalStore } from "react";
import { Chat } from "../sdk/index";
import { Config, createConnection } from "../sdk/connection/index";
import { ToolCallPart, Message } from "../type/message/index";

export const useChat = <T>({
  config,
  onToolCall,
  initialMessages = [],
}: {
  config: Config<T>;
  onToolCall?: (part: ToolCallPart) => void;
  initialMessages?: Message[];
}) => {
  const chat = useMemo(
    () =>
      new Chat({
        connection: createConnection<T>(config),
        onToolCall,
        messages: initialMessages,
      }),
    [],
  );

  const status = useSyncExternalStore(
    chat.subscribeStatus,
    () => chat.status,
    () => chat.status,
  );

  const messages = useSyncExternalStore(
    chat.subscribeMessages,
    () => chat.messages,
    () => chat.messages,
  );

  return {
    status,
    messages,
    sendMessage: chat.sendMessage,
    resumeStream: chat.resumeStream,
    addToolOutput: chat.addToolOutput,
  };
};
