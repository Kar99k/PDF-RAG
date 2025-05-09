import { MODEL, SYSTEM_PROMPT } from "@/constants";
import { Message, StreamingTextResponse } from "ai";
import { MessageContent, OpenAI } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { createChatEngine } from "./engine";
import { LlamaIndexStream } from "./llamaindex-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const getLastMessageContent = (
  textMessage: string,
  imageUrl: string | undefined
): MessageContent => {
  if (!imageUrl) return textMessage;
  return [
    {
      type: "text",
      text: textMessage,
    },
    {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    },
  ];
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, data }: { messages: Message[]; data: any } = body;
    const lastMessage = messages.pop();
    if (!messages || !lastMessage || lastMessage.role !== "user") {
      return NextResponse.json(
        {
          error:
            "messages are required in the request body and the last message must be from the user",
        },
        { status: 400 }
      );
    }

    const llm = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: MODEL,
      maxTokens: 2048,
    });

    const chatEngine = await createChatEngine(llm);

    const lastMessageContent = getLastMessageContent(
      lastMessage.content,
      data?.imageUrl
    );

    // Add system prompt as the first message
    const messagesWithSystem = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...messages,
    ];

    const response = await chatEngine.chat(
      lastMessageContent as MessageContent,
      //@ts-ignore
      messagesWithSystem,
      true
    );

    // Transform the response into a readable stream
    const stream = LlamaIndexStream(response);

    // Return a StreamingTextResponse, which can be consumed by the client
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      {
        status: 500,
      }
    );
  }
}
