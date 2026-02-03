"use client";

import { useState, useCallback, useRef } from "react";
import type { Message, ChatMode } from "@/types/chat";

interface QuickChatResult {
  conversationId: string;
  mode: ChatMode;
  title: string | null;
  isOrganized: boolean;
}

interface ModeDetectionInfo {
  mode: ChatMode;
  confidence: "high" | "medium" | "low";
}

interface UseQuickChatOptions {
  projectId?: string;
  onComplete?: (result: QuickChatResult) => void;
  onError?: (error: Error) => void;
}

interface UseQuickChatReturn {
  // State
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  conversationId: string | null;
  detectedMode: ModeDetectionInfo | null;

  // Actions
  sendQuickMessage: (content: string, explicitMode?: ChatMode) => Promise<void>;
  continueConversation: (content: string) => Promise<void>;
  stopGeneration: () => void;
  clearConversation: () => void;

  // Organize
  organizeToProject: (projectId: string) => Promise<void>;
  createAndOrganize: (projectName: string, projectType: "product" | "learning") => Promise<void>;
  dismissConversation: () => Promise<void>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function useQuickChat({
  projectId: initialProjectId,
  onComplete,
  onError,
}: UseQuickChatOptions = {}): UseQuickChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [detectedMode, setDetectedMode] = useState<ModeDetectionInfo | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Send a quick message (creates new conversation)
  const sendQuickMessage = useCallback(
    async (content: string, explicitMode?: ChatMode) => {
      if (!content.trim() || isLoading) return;

      abortControllerRef.current = new AbortController();

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages([userMessage]);
      setIsLoading(true);
      setError(null);
      setDetectedMode(null);

      // Add placeholder for assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch("/api/chat/quick", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            mode: explicitMode,
            projectId: initialProjectId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "チャットの送信に失敗しました");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("レスポンスの読み取りに失敗しました");
        }

        let fullContent = "";
        let resultInfo: QuickChatResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (abortControllerRef.current?.signal.aborted) {
            reader.cancel();
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);

                // Mode detection info
                if (parsed.type === "mode_detected") {
                  setDetectedMode({
                    mode: parsed.mode,
                    confidence: parsed.confidence,
                  });
                  setConversationId(parsed.conversationId);
                }

                // Content streaming
                if (parsed.content) {
                  fullContent += parsed.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === "assistant") {
                      return [
                        ...newMessages.slice(0, -1),
                        { ...lastMessage, content: fullContent },
                      ];
                    }
                    return newMessages;
                  });
                }

                // Done message
                if (parsed.done) {
                  resultInfo = {
                    conversationId: parsed.conversationId,
                    mode: parsed.mode,
                    title: parsed.title,
                    isOrganized: parsed.isOrganized,
                  };
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        if (resultInfo) {
          onComplete?.(resultInfo);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [initialProjectId, isLoading, onComplete, onError]
  );

  // Continue an existing conversation
  const continueConversation = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading || !conversationId) return;

      abortControllerRef.current = new AbortController();

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch("/api/chat/quick", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            conversationId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "チャットの送信に失敗しました");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("レスポンスの読み取りに失敗しました");
        }

        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (abortControllerRef.current?.signal.aborted) {
            reader.cancel();
            break;
          }

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === "assistant") {
                      return [
                        ...newMessages.slice(0, -1),
                        { ...lastMessage, content: fullContent },
                      ];
                    }
                    return newMessages;
                  });
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [conversationId, isLoading, onError]
  );

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setDetectedMode(null);
    setError(null);
  }, []);

  // Organize conversation to existing project
  const organizeToProject = useCallback(
    async (projectId: string) => {
      if (!conversationId) {
        onError?.(new Error("会話IDがありません"));
        return;
      }

      try {
        const response = await fetch(`/api/conversations/${conversationId}/organize`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ projectId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "プロジェクトへの紐づけに失敗しました");
        }

        const data = await response.json();
        if (data.success) {
          onComplete?.({
            conversationId,
            mode: detectedMode?.mode || "explanation",
            title: null,
            isOrganized: true,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);
      }
    },
    [conversationId, detectedMode, onComplete, onError]
  );

  // Create new project and organize
  const createAndOrganize = useCallback(
    async (projectName: string, projectType: "product" | "learning") => {
      if (!conversationId) {
        onError?.(new Error("会話IDがありません"));
        return;
      }

      try {
        const response = await fetch(`/api/conversations/${conversationId}/organize`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            createProject: {
              name: projectName,
              projectType,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "プロジェクトの作成に失敗しました");
        }

        const data = await response.json();
        if (data.success) {
          onComplete?.({
            conversationId,
            mode: detectedMode?.mode || "explanation",
            title: null,
            isOrganized: true,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);
      }
    },
    [conversationId, detectedMode, onComplete, onError]
  );

  // Dismiss conversation (mark as organized without project)
  const dismissConversation = useCallback(async () => {
    if (!conversationId) {
      onError?.(new Error("会話IDがありません"));
      return;
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/organize`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ convertToLearning: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "会話の整理に失敗しました");
      }

      clearConversation();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      onError?.(error);
    }
  }, [conversationId, clearConversation, onError]);

  return {
    messages,
    isLoading,
    error,
    conversationId,
    detectedMode,
    sendQuickMessage,
    continueConversation,
    stopGeneration,
    clearConversation,
    organizeToProject,
    createAndOrganize,
    dismissConversation,
  };
}
