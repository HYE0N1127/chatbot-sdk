export type Message = {
  id: string;
  role: "user" | "assistant";
  state?: "streaming" | "done";
  content: string;
};

export type Chunk = {
  id: string;
  content: string;
};
