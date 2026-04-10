import { useMemo, useSyncExternalStore } from "react";
import { Chat } from "../../sdk/index";
import { Config, createConnection } from "../../sdk/connection/index";

export const useChat = <T>({ config }: { config: Config<T> }) => {
  const chat = useMemo(
    () => new Chat({ connection: createConnection<T>(config) }),
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
