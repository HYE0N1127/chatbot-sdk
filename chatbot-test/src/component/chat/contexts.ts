import { createContext } from "react";
import { Chat } from "../../sdk/index";

export const ChatContext = createContext<Chat | undefined>(undefined);
