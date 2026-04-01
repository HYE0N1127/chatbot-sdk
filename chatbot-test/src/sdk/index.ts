import { Chunk, Message } from "../type/message/index";
import { generateId } from "../utils/id/index";
import { Connection } from "./connection/index";

export class Chat {
  private _messages: Message[] = [];
  private connect: Connection;
  private listeners: (() => void)[] = [];

  constructor(options: { connection: Connection }) {
    this.connect = options.connection;
  }

  public sendMessages = async (prompt: string) => {
    const promptId = generateId();
    const promptMessage: Message = {
      id: promptId,
      role: "user",
      content: prompt,
    };

    this.messages = [...this.messages, promptMessage];

    const apiMessages = this.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const replyId = generateId();
    const pendingReply: Message = {
      id: replyId,
      role: "assistant",
      state: "streaming",
      content: "",
    };
    this.messages = [...this.messages, pendingReply];

    try {
      const response = await this.connect({
        messages: apiMessages,
      });

      if (!response.ok || !response.body) {
        throw new Error("네트워크 응답이 올바르지 않습니다.");
      }

      this.parse(response, replyId);
    } catch (error) {
      console.error(`Send message Error: ${error}`);
    }
  };

  private parse = async (response: Response, targetId: string) => {
    if (response.body == null) {
      return;
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(
        new TransformStream<string, Chunk>({
          transform: (chunk, controller) => {
            try {
              /**
               * TODO: Streaming으로 인하여 JSON이 잘려서 전송되는 경우를 방어하는 로직 필요
               */
              console.log(`$chunk : \n ${chunk}`);
              const parsed = JSON.parse(chunk) as Chunk;
              controller.enqueue(parsed);
            } catch (e) {
              // 스트림 청크가 불완전할 때 발생하는 JSON.parse 에러 방어
              console.error(`parse error ${e}`);
            }
          },
        }),
      )
      .getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Streaming 이 완료되는 경우 상태를 messages 내부 상태를 Done으로 변경합니다.
        this.messages = this.messages.map((msg) =>
          msg.id === targetId ? { ...msg, state: "done" } : msg,
        );

        break;
      }

      if (value && value.content) {
        this.messages = this.messages.map((msg) =>
          msg.id === targetId
            ? { ...msg, content: msg.content + value.content }
            : msg,
        );
      }
    }
  };

  private set messages(value: Message[]) {
    this._messages = value;
    this.notify();
  }

  public get messages(): Message[] {
    return this._messages;
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
