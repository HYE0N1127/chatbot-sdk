export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  state?: "streaming" | "done" | "error";
  content: string;
};

