"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type {
  Message,
  ChatMode,
  ConversationBranch,
  ChatBranchState,
  ConversationMetadata,
  BrainstormModeState,
  BrainstormSubMode,
} from "@/types/chat";
import type { ApiError } from "@/types/api";
import { isAuthError, handleAuthError } from "@/lib/auth-error-handler";

// Custom error class to carry API error details
export class ChatApiError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = "ChatApiError";
    this.code = apiError.code;
    this.details = apiError.details;
  }
}

const EMPTY_MESSAGES: Message[] = [];

interface UseChatOptions {
  mode: ChatMode;
  conversationId?: string;
  projectId?: string;
  onError?: (error: Error) => void;
  onConversationCreated?: (id: string) => void;
  onTokensUsed?: (tokens: number) => void;
  // 壁打ちモードのサブモード（casual/planning）
  brainstormSubMode?: BrainstormSubMode;
}

// Generation status from backend
type GenerationStatus = "idle" | "generating" | "completed" | "failed";

interface GenerationRecoveryInfo {
  status: GenerationStatus;
  pendingContent?: string;
  error?: string;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: Error | null;
  conversationId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  loadConversation: (id: string) => Promise<void>;
  // Stop functionality
  stopGeneration: () => void;
  // Fork functionality
  forkFromMessage: (messageIndex: number) => void;
  branches: ConversationBranch[];
  currentBranchId: string;
  switchBranch: (branchId: string) => void;
  canFork: (messageIndex: number) => boolean;
  // Regenerate functionality
  regenerateLastMessage: () => Promise<void>;
  canRegenerate: boolean;
  // Generation recovery
  generationRecovery: GenerationRecoveryInfo | null;
  clearGenerationRecovery: () => void;
  // Branch state for external access
  branchState: ChatBranchState;
  // Metadata management (for brainstorm state etc.)
  setExternalMetadata: (metadata: Partial<ConversationMetadata>) => void;
  getMetadata: () => ConversationMetadata | null;
  // Restored metadata from loaded conversation
  restoredMetadata: ConversationMetadata | null;
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function useChat({ mode, conversationId: initialConversationId, projectId, onError, onConversationCreated, onTokensUsed, brainstormSubMode }: UseChatOptions): UseChatReturn {
  const [branchState, setBranchState] = useState<ChatBranchState>(() => {
    const mainBranchId = generateId();
    return {
      branches: [{ id: mainBranchId, name: "メイン", forkPointIndex: 0, createdAt: new Date().toISOString() }],
      currentBranchId: mainBranchId,
      messagesByBranch: { [mainBranchId]: [] },
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  const [generationRecovery, setGenerationRecovery] = useState<GenerationRecoveryInfo | null>(null);
  const [externalMetadata, setExternalMetadataState] = useState<Partial<ConversationMetadata>>({});
  const [restoredMetadata, setRestoredMetadata] = useState<ConversationMetadata | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const branchStateRef = useRef<ChatBranchState>(branchState);
  const externalMetadataRef = useRef<Partial<ConversationMetadata>>(externalMetadata);
  const isStreamingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const saveAbortControllerRef = useRef<AbortController | null>(null);

  // Keep metadata ref in sync
  useEffect(() => {
    externalMetadataRef.current = externalMetadata;
  }, [externalMetadata]);

  // Keep ref in sync with state
  useEffect(() => {
    branchStateRef.current = branchState;
  }, [branchState]);

  // Get current messages based on branch (memoized to prevent infinite loops)
  const messages = useMemo(() => {
    return branchState.messagesByBranch[branchState.currentBranchId] ?? EMPTY_MESSAGES;
  }, [branchState.messagesByBranch, branchState.currentBranchId]);

  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setBranchState((prev) => {
      const currentMessages = prev.messagesByBranch[prev.currentBranchId] || [];
      const newMessages = typeof updater === "function" ? updater(currentMessages) : updater;
      return {
        ...prev,
        messagesByBranch: {
          ...prev.messagesByBranch,
          [prev.currentBranchId]: newMessages,
        },
      };
    });
  }, []);

  // Build metadata for saving (includes branch state and external metadata)
  const buildMetadata = useCallback((): ConversationMetadata => {
    const currentBranchState = branchStateRef.current;
    const currentExternalMetadata = externalMetadataRef.current;
    return {
      ...currentExternalMetadata,
      branchState: currentBranchState,
      lastActiveBranchId: currentBranchState.currentBranchId,
    } as ConversationMetadata;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel any pending save requests
      if (saveAbortControllerRef.current) {
        saveAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Save conversation to server (with error handling and abort support)
  const saveConversation = useCallback(async (msgs: Message[], convId: string | null) => {
    if (msgs.length === 0 || !isMountedRef.current) return;

    // Cancel previous save request if still pending
    if (saveAbortControllerRef.current) {
      saveAbortControllerRef.current.abort();
    }
    saveAbortControllerRef.current = new AbortController();

    const metadata = buildMetadata();

    try {
      if (convId) {
        // Update existing conversation
        const response = await fetch("/api/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: convId,
            messages: msgs,
            metadata,
          }),
          signal: saveAbortControllerRef.current.signal,
        });
        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return;
        }
        // Check if response is ok
        if (!response.ok && isMountedRef.current) {
          console.warn("Failed to save conversation:", response.status);
        }
      } else {
        // Create new conversation
        const response = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            messages: msgs,
            metadata,
            projectId,
          }),
          signal: saveAbortControllerRef.current.signal,
        });
        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return;
        }
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.id && isMountedRef.current) {
            setConversationId(data.data.id);
            onConversationCreated?.(data.data.id);
          }
        }
      }
    } catch (err) {
      // Ignore abort errors (component unmounted)
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      // Only log if still mounted
      if (isMountedRef.current) {
        console.warn("Failed to save conversation:", err);
      }
    }
  }, [mode, projectId, buildMetadata, onConversationCreated]);

  // Debounced save effect - skip during streaming to prevent excessive saves
  useEffect(() => {
    if (messages.length === 0) return;

    // If streaming, mark as pending save but don't save yet
    if (isStreamingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveConversation(messages, conversationId);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, conversationId, saveConversation]);

  // Load conversation from server
  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingHistory(true);
    setGenerationRecovery(null);
    setRestoredMetadata(null);
    try {
      const response = await fetch(`/api/conversations/${id}`);
      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }
      const data = await response.json();
      if (data.success && data.data) {
        const conversation = data.data;
        const metadata = conversation.metadata as ConversationMetadata | null;

        // Restore branch state if available
        if (metadata?.branchState) {
          const savedBranchState = metadata.branchState;
          // Restore to the last active branch
          const targetBranchId = metadata.lastActiveBranchId || savedBranchState.currentBranchId;
          setBranchState({
            ...savedBranchState,
            currentBranchId: targetBranchId,
          });
        } else {
          // No saved branch state - create default with loaded messages
          const mainBranchId = generateId();
          setBranchState({
            branches: [{ id: mainBranchId, name: "メイン", forkPointIndex: 0, createdAt: new Date().toISOString() }],
            currentBranchId: mainBranchId,
            messagesByBranch: { [mainBranchId]: conversation.messages as Message[] },
          });
        }

        // Store restored metadata for external components (brainstorm state etc.)
        if (metadata) {
          setRestoredMetadata(metadata);
          // Also restore external metadata state
          setExternalMetadataState({
            options: metadata.options,
            state: metadata.state,
            brainstormState: metadata.brainstormState,
          });
        }

        setConversationId(id);

        // Check for generation recovery scenarios
        const status = conversation.generationStatus as GenerationStatus;
        if (status === "generating") {
          // Generation was in progress - show pending content if available
          if (conversation.pendingContent) {
            // Add the pending content as a partial assistant message
            const partialMessage: Message = {
              id: generateId(),
              role: "assistant",
              content: conversation.pendingContent + "\n\n[生成が中断されました。続きは再生成してください]",
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, partialMessage]);
          }
          setGenerationRecovery({
            status: "generating",
            pendingContent: conversation.pendingContent || undefined,
          });
        } else if (status === "failed") {
          // Generation failed - show error
          setGenerationRecovery({
            status: "failed",
            error: conversation.generationError || "生成中にエラーが発生しました",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
      onError?.(err instanceof Error ? err : new Error("会話の読み込みに失敗しました"));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [onError, setMessages]);

  // Clear generation recovery state
  const clearGenerationRecovery = useCallback(() => {
    setGenerationRecovery(null);
  }, []);

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Fork from a specific message
  const forkFromMessage = useCallback((messageIndex: number) => {
    setBranchState((prev) => {
      const currentMessages = prev.messagesByBranch[prev.currentBranchId] || [];

      // Copy messages up to and including the specified index
      const forkedMessages = currentMessages.slice(0, messageIndex + 1);

      // Create new branch
      const newBranchId = generateId();
      const branchNumber = prev.branches.length + 1;
      const newBranch: ConversationBranch = {
        id: newBranchId,
        name: `分岐 ${branchNumber}`,
        parentBranchId: prev.currentBranchId,
        forkPointIndex: messageIndex,
        createdAt: new Date().toISOString(),
      };

      return {
        branches: [...prev.branches, newBranch],
        currentBranchId: newBranchId,
        messagesByBranch: {
          ...prev.messagesByBranch,
          [newBranchId]: forkedMessages,
        },
      };
    });
  }, []);

  // Switch to a different branch
  const switchBranch = useCallback((branchId: string) => {
    setBranchState((prev) => {
      if (prev.branches.some((b) => b.id === branchId)) {
        return { ...prev, currentBranchId: branchId };
      }
      return prev;
    });
  }, []);

  // Check if we can fork from a specific message (only user messages or after assistant response)
  const canFork = useCallback((messageIndex: number) => {
    return messageIndex >= 0 && messageIndex < messages.length;
  }, [messages.length]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      isStreamingRef.current = true;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      // Add placeholder for assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Get current messages from ref to avoid stale closure
        const currentState = branchStateRef.current;
        const currentMessages = currentState.messagesByBranch[currentState.currentBranchId] || [];

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode,
            messages: [...currentMessages, userMessage],
            brainstormSubMode: mode === "brainstorm" ? brainstormSubMode : undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        // Check for auth error
        if (isAuthError(response)) {
          await handleAuthError();
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.error) {
            throw new ChatApiError(errorData.error);
          }
          throw new Error("チャットの送信に失敗しました");
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("レスポンスの読み取りに失敗しました");
        }

        let fullContent = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            reader.cancel();
            break;
          }

          // Append to buffer and process complete lines
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep incomplete last line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("data: ")) {
              const data = trimmedLine.slice(6);
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
                if (parsed.metadata) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === "assistant") {
                      return [
                        ...newMessages.slice(0, -1),
                        {
                          ...lastMessage,
                          metadata: { ...lastMessage.metadata, ...parsed.metadata },
                        },
                      ];
                    }
                    return newMessages;
                  });
                }
                // Handle done message with tokens used
                if (parsed.done && parsed.tokensUsed !== undefined) {
                  onTokensUsed?.(parsed.tokensUsed);
                }
              } catch {
                // Skip invalid JSON (might be incomplete chunk)
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim()) {
          const trimmedLine = buffer.trim();
          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6);
            if (data !== "[DONE]") {
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
                // Handle done message with tokens used (in case it's in the buffer)
                if (parsed.done && parsed.tokensUsed !== undefined) {
                  onTokensUsed?.(parsed.tokensUsed);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (err) {
        // Don't treat abort as an error
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);

        // Remove the empty assistant message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
        isStreamingRef.current = false;

        // Trigger pending save after streaming completes
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          const currentState = branchStateRef.current;
          const currentMessages = currentState.messagesByBranch[currentState.currentBranchId] || [];
          saveConversation(currentMessages, conversationId);
        }
      }
    },
    [mode, isLoading, onError, onTokensUsed, setMessages, conversationId, saveConversation, brainstormSubMode]
  );

  const clearMessages = useCallback(() => {
    const mainBranchId = generateId();
    setBranchState({
      branches: [{ id: mainBranchId, name: "メイン", forkPointIndex: 0, createdAt: new Date().toISOString() }],
      currentBranchId: mainBranchId,
      messagesByBranch: { [mainBranchId]: [] },
    });
    setConversationId(null);
    setError(null);
  }, []);

  // Check if we can regenerate (last message must be assistant and not loading)
  const canRegenerate = useMemo(() => {
    if (isLoading || messages.length < 2) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage.role === "assistant";
  }, [messages, isLoading]);

  // Regenerate the last assistant message
  const regenerateLastMessage = useCallback(async () => {
    if (!canRegenerate || isLoading) return;

    const currentState = branchStateRef.current;
    const currentMessages = currentState.messagesByBranch[currentState.currentBranchId] || [];

    // Find the last user message
    let lastUserMessageIndex = -1;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex === -1) return;

    // Remove messages after the last user message (the assistant response)
    setMessages(currentMessages.slice(0, lastUserMessageIndex + 1));

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    isStreamingRef.current = true;
    setIsLoading(true);
    setError(null);

    // Add placeholder for assistant message
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const messagesForApi = currentMessages.slice(0, lastUserMessageIndex + 1);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          messages: messagesForApi,
          brainstormSubMode: mode === "brainstorm" ? brainstormSubMode : undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      // Check for auth error
      if (isAuthError(response)) {
        await handleAuthError();
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error) {
          throw new ChatApiError(errorData.error);
        }
        throw new Error("チャットの送信に失敗しました");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("レスポンスの読み取りに失敗しました");
      }

      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          reader.cancel();
          break;
        }

        // Append to buffer and process complete lines
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep incomplete last line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6);
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
              if (parsed.metadata) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === "assistant") {
                    return [
                      ...newMessages.slice(0, -1),
                      {
                        ...lastMessage,
                        metadata: { ...lastMessage.metadata, ...parsed.metadata },
                      },
                    ];
                  }
                  return newMessages;
                });
              }
              // Handle done message with tokens used
              if (parsed.done && parsed.tokensUsed !== undefined) {
                onTokensUsed?.(parsed.tokensUsed);
              }
            } catch {
              // Skip invalid JSON (might be incomplete chunk)
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        const trimmedLine = buffer.trim();
        if (trimmedLine.startsWith("data: ")) {
          const data = trimmedLine.slice(6);
          if (data !== "[DONE]") {
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
              // Handle done message with tokens used (in case it's in the buffer)
              if (parsed.done && parsed.tokensUsed !== undefined) {
                onTokensUsed?.(parsed.tokensUsed);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      // Don't treat abort as an error
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      onError?.(error);

      // Restore the original assistant message on error
      setMessages(currentMessages);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      isStreamingRef.current = false;

      // Trigger pending save after streaming completes
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        const latestState = branchStateRef.current;
        const latestMessages = latestState.messagesByBranch[latestState.currentBranchId] || [];
        saveConversation(latestMessages, conversationId);
      }
    }
  }, [canRegenerate, isLoading, mode, onError, onTokensUsed, setMessages, conversationId, saveConversation, brainstormSubMode]);

  // Set external metadata (e.g., brainstorm state from BrainstormChatContainer)
  const setExternalMetadata = useCallback((metadata: Partial<ConversationMetadata>) => {
    setExternalMetadataState((prev) => ({
      ...prev,
      ...metadata,
    }));
  }, []);

  // Get current metadata
  const getMetadata = useCallback((): ConversationMetadata | null => {
    return buildMetadata();
  }, [buildMetadata]);

  return {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    conversationId,
    sendMessage,
    clearMessages,
    loadConversation,
    stopGeneration,
    forkFromMessage,
    branches: branchState.branches,
    currentBranchId: branchState.currentBranchId,
    switchBranch,
    canFork,
    regenerateLastMessage,
    canRegenerate,
    generationRecovery,
    clearGenerationRecovery,
    // New exports for state restoration
    branchState,
    setExternalMetadata,
    getMetadata,
    restoredMetadata,
  };
}
