import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/embedding-service";
import type { ChatMode } from "@/types/chat";

const DEFAULT_RESULT_LIMIT = 5;
const MAX_CONTEXT_LENGTH = 3000;

export interface RAGResult {
  conversationId: string;
  conversationTitle: string;
  mode: ChatMode;
  content: string;
  contentSummary: string;
  score: number;
  messageIndex: number;
}

/**
 * Search for relevant message embeddings within a project's conversations
 * using cosine similarity via pgvector.
 */
export async function searchRelevantContext(
  query: string,
  projectId: string,
  options?: { limit?: number; excludeConversationId?: string }
): Promise<RAGResult[]> {
  const limit = options?.limit ?? DEFAULT_RESULT_LIMIT;
  const excludeId = options?.excludeConversationId ?? "";

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  // Search using cosine distance (<=> operator in pgvector)
  const results = await prisma.$queryRawUnsafe<
    Array<{
      conversation_id: string;
      title: string | null;
      mode: string;
      content: string;
      content_summary: string | null;
      message_index: number;
      score: number;
    }>
  >(
    `SELECT
       me.conversation_id,
       c.title,
       c.mode,
       me.content,
       me.content_summary,
       me.message_index,
       1 - (me.embedding <=> $1::vector) as score
     FROM message_embeddings me
     JOIN conversations c ON me.conversation_id = c.id
     WHERE c.project_id = $2
       AND ($3 = '' OR me.conversation_id != $3)
     ORDER BY me.embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    projectId,
    excludeId,
    limit
  );

  return results.map((r) => ({
    conversationId: r.conversation_id,
    conversationTitle: r.title || "無題の会話",
    mode: r.mode as ChatMode,
    content: r.content,
    contentSummary: r.content_summary || r.content.slice(0, 200),
    score: Number(r.score),
    messageIndex: r.message_index,
  }));
}

/**
 * Build a complete project context string for injection into the system prompt.
 * Fetches project info + relevant conversation excerpts via RAG.
 */
export async function buildProjectContext(
  projectId: string,
  currentQuery: string,
  currentConversationId?: string
): Promise<string | null> {
  // Fetch project info
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      description: true,
      ideaSummary: true,
      targetPersona: true,
      techStack: true,
    },
  });

  if (!project) return null;

  // Check if any embeddings exist for this project's conversations
  const embeddingCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count
     FROM message_embeddings me
     JOIN conversations c ON me.conversation_id = c.id
     WHERE c.project_id = $1`,
    projectId
  );

  const hasEmbeddings =
    embeddingCount.length > 0 && Number(embeddingCount[0].count) > 0;

  // Build project header
  let context = `\n\n【プロジェクトコンテキスト】\nプロジェクト: ${project.title}`;
  if (project.description) {
    context += `\n説明: ${project.description}`;
  }
  if (project.ideaSummary) {
    context += `\nアイデア概要: ${project.ideaSummary}`;
  }
  if (project.targetPersona) {
    context += `\nターゲット: ${project.targetPersona}`;
  }
  if (project.techStack && (project.techStack as string[]).length > 0) {
    context += `\n技術スタック: ${(project.techStack as string[]).join(", ")}`;
  }

  // If no embeddings exist, return just project info
  if (!hasEmbeddings) {
    return context;
  }

  // Search for relevant context
  let results: RAGResult[];
  try {
    results = await searchRelevantContext(currentQuery, projectId, {
      limit: DEFAULT_RESULT_LIMIT,
      excludeConversationId: currentConversationId,
    });
  } catch (error) {
    console.error("RAG search failed:", error);
    return context;
  }

  if (results.length === 0) {
    return context;
  }

  // Filter by minimum relevance score
  const relevantResults = results.filter((r) => r.score > 0.3);
  if (relevantResults.length === 0) {
    return context;
  }

  // Build conversation reference blocks
  context += `\n\n以下は、このプロジェクト内の関連する過去の会話から抽出した情報です。`;
  context += `\nこれらを参照する場合、必ず [[ref:{会話ID}:{モード}|{会話タイトル}]] 形式で引用してください。\n`;

  // Group by conversation to avoid redundant headers
  const byConversation = new Map<
    string,
    { title: string; mode: ChatMode; excerpts: string[] }
  >();

  let totalLength = 0;
  for (const result of relevantResults) {
    if (totalLength > MAX_CONTEXT_LENGTH) break;

    const existing = byConversation.get(result.conversationId);
    const excerpt = result.contentSummary;

    if (existing) {
      existing.excerpts.push(excerpt);
    } else {
      byConversation.set(result.conversationId, {
        title: result.conversationTitle,
        mode: result.mode,
        excerpts: [excerpt],
      });
    }
    totalLength += excerpt.length;
  }

  for (const [convId, conv] of byConversation) {
    context += `\n---`;
    context += `\n[会話: "${conv.title}" (ID: ${convId}, モード: ${conv.mode})]`;
    for (const excerpt of conv.excerpts) {
      context += `\n${excerpt}`;
    }
    context += `\n---`;
  }

  context += `\n\n【引用ルール】`;
  context += `\n- 過去の会話を参照する場合は必ず [[ref:会話ID:モード|表示テキスト]] の形式で明示してください`;
  context += `\n- 例: 「[[ref:abc-123:brainstorm|企画段階の議論]]で検討した通り、...」`;
  context += `\n- 引用は自然な文章の中に組み込んでください`;

  return context;
}
