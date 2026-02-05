import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_CHUNK_LENGTH = 2000;

interface MessagePair {
  index: number;
  content: string;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

/**
 * Generate an embedding vector for the given text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();
  const truncated = text.slice(0, MAX_CHUNK_LENGTH * 4); // rough char limit

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Chunk conversation messages into user+assistant pairs for embedding
 */
function chunkMessages(
  messages: Array<{ role: string; content: string }>
): MessagePair[] {
  const pairs: MessagePair[] = [];
  let pairIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      const userContent = msg.content;
      const assistantContent =
        i + 1 < messages.length && messages[i + 1].role === "assistant"
          ? messages[i + 1].content
          : "";

      const combined = assistantContent
        ? `Q: ${userContent}\nA: ${assistantContent}`
        : `Q: ${userContent}`;

      const truncated =
        combined.length > MAX_CHUNK_LENGTH
          ? combined.slice(0, MAX_CHUNK_LENGTH) + "..."
          : combined;

      pairs.push({ index: pairIndex, content: truncated });
      pairIndex++;

      if (assistantContent) {
        i++; // skip the assistant message we already consumed
      }
    }
  }

  return pairs;
}

/**
 * Generate a short summary from content (first 500 chars)
 */
function summarizeContent(content: string): string {
  const cleaned = content.replace(/\n+/g, " ").trim();
  return cleaned.length > 500 ? cleaned.slice(0, 497) + "..." : cleaned;
}

/**
 * Embed all message pairs from a conversation and store in DB.
 * Uses upsert to handle re-indexing when messages are updated.
 */
export async function embedConversationMessages(
  conversationId: string
): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, messages: true, projectId: true },
  });

  if (!conversation) return;

  // Only embed conversations that belong to a project
  if (!conversation.projectId) return;

  const messages = conversation.messages as Array<{
    role: string;
    content: string;
  }>;
  if (!messages || messages.length === 0) return;

  const pairs = chunkMessages(messages);
  if (pairs.length === 0) return;

  // Generate embeddings for all pairs
  const openai = getOpenAIClient();
  const inputs = pairs.map((p) => p.content);

  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: inputs,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  // Store each embedding using raw SQL (pgvector)
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const embedding = embeddingResponse.data[i].embedding;
    const vectorStr = `[${embedding.join(",")}]`;
    const summary = summarizeContent(pair.content);

    // Upsert: insert or update on conflict (conversationId, messageIndex)
    await prisma.$queryRawUnsafe(
      `INSERT INTO message_embeddings (id, conversation_id, message_index, content, content_summary, embedding, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, NOW())
       ON CONFLICT (conversation_id, message_index)
       DO UPDATE SET content = $3, content_summary = $4, embedding = $5::vector, created_at = NOW()`,
      conversationId,
      pair.index,
      pair.content,
      summary,
      vectorStr
    );
  }

  // Clean up any old embeddings with higher indices (conversation was shortened)
  await prisma.messageEmbedding.deleteMany({
    where: {
      conversationId,
      messageIndex: { gte: pairs.length },
    },
  });
}
