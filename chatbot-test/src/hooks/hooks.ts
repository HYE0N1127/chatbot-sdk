import { useMemo, useSyncExternalStore } from "react";
import { Chat } from "../sdk/index";
import { Config, createConnection } from "../sdk/connection/index";
import { ToolCallPart } from "../type/message/index";

export const useChat = <T>({
  config,
  onToolCall,
}: {
  config: Config<T>;
  onToolCall: (part: ToolCallPart) => void;
}) => {
  const chat = useMemo(
    () => new Chat({ connection: createConnection<T>(config), onToolCall }),
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
    addToolOutput: chat.addToolOutput,
  };
};
