export type Message = {
  id: string;
  role: "user" | "assistant";
  state?: "streaming" | "done" | "error";
  content: string;
};

