import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ChatContext } from "./component/chat/contexts";
import { ChatProvider } from "./component/chat/index";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <ChatProvider>
      <App />
    </ChatProvider>
  </React.StrictMode>,
);
