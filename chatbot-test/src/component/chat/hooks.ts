import { useContext, useSyncExternalStore } from "react";
import { ChatContext } from "./contexts";

export const useChat = () => {
  const context = useContext(ChatContext);

  if (context == null) {
    throw new Error("useChatStatus must be used within a ChatContext");
  }

  return context;
};

export const useChatStatus = () => {
  const chat = useChat();

  return useSyncExternalStore(
    chat.subscribeStatus,
    () => chat.status,
    () => chat.status,
  );
};

export const useMessages = () => {
  const chat = useChat();

  return useSyncExternalStore(
    chat.subscribe,
    () => chat.messages,
    () => chat.messages,
  );
};
