"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BrainstormChatContainer, ModelSelector } from "@/components/chat";
import { ProjectSelector } from "@/components/chat/ProjectSelector";
import type { ClaudeModel } from "@/types/chat";
import { DEFAULT_MODEL } from "@/types/chat";
import { useChat, ChatApiError } from "@/hooks/useChat";
import { useTokenUsageOptional } from "@/contexts/TokenUsageContext";
import { useTokenLimitDialog } from "@/components/common/TokenLimitDialog";
import { toast } from "sonner";
import type { ConversationMetadata, BrainstormSubMode } from "@/types/chat";

export default function BrainstormModePage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("id");
  const initialProjectId = searchParams.get("projectId");
  const tokenUsage = useTokenUsageOptional();
  const { showTokenLimitError, TokenLimitDialog } = useTokenLimitDialog();

  // Track conversation ID in state to avoid page navigation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId);
  const hasUpdatedUrlRef = useRef(false);

  // Project selection state (can be changed before first message)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
  // SubMode state for API calls (synced from BrainstormChatContainer)
  const [subMode, setSubMode] = useState<BrainstormSubMode>("casual");
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>(DEFAULT_MODEL);

  // Update URL without navigation when a new conversation is created
  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConversationId(id);
    // Update URL for bookmarking/sharing without triggering navigation
    if (typeof window !== "undefined" && !hasUpdatedUrlRef.current) {
      hasUpdatedUrlRef.current = true;
      window.history.replaceState(null, "", `/chat/brainstorm/${id}`);
    }
  }, []);

  // Update token usage when response completes
  const handleTokensUsed = useCallback((tokens: number) => {
    tokenUsage?.addUsage(tokens);
  }, [tokenUsage]);

  // Handle errors including token limit exceeded
  const handleError = useCallback((error: Error) => {
    if (error instanceof ChatApiError && error.code === "TOKEN_LIMIT_EXCEEDED") {
      const handled = showTokenLimitError({
        code: error.code,
        message: error.message,
        details: error.details as {
          currentUsage: number;
          dailyLimit: number;
          remaining: number;
          required: number;
        },
      });
      if (handled) return;
    }
    toast.error(error.message);
  }, [showTokenLimitError]);

  const {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    forkFromMessage,
    branches,
    currentBranchId,
    switchBranch,
    loadConversation,
    regenerateLastMessage,
    canRegenerate,
    generationRecovery,
    clearGenerationRecovery,
    restoredMetadata,
    setExternalMetadata,
  } = useChat({
    mode: "brainstorm",
    conversationId: currentConversationId || undefined,
    projectId: selectedProjectId || undefined,
    brainstormSubMode: subMode,
    onError: handleError,
    onConversationCreated: handleConversationCreated,
    onTokensUsed: handleTokensUsed,
    model: selectedModel,
  });

  // Disable project change once conversation has started
  const canChangeProject = messages.length === 0 && !currentConversationId;

  // Handle metadata changes from BrainstormChatContainer
  const handleMetadataChange = useCallback(
    (metadata: Partial<ConversationMetadata>) => {
      setExternalMetadata(metadata);
    },
    [setExternalMetadata]
  );

  // Load conversation from history if ID is provided (from URL on initial load)
  useEffect(() => {
    if (initialConversationId) {
      loadConversation(initialConversationId);
    }
  }, [initialConversationId, loadConversation]);

  // Show toast for generation recovery
  useEffect(() => {
    if (generationRecovery) {
      if (generationRecovery.status === "generating") {
        toast.warning("前回の生成が中断されました。再生成ボタンで続きを生成できます。", {
          duration: 5000,
          action: {
            label: "閉じる",
            onClick: clearGenerationRecovery,
          },
        });
      } else if (generationRecovery.status === "failed") {
        toast.error(`生成中にエラーが発生しました: ${generationRecovery.error}`, {
          duration: 5000,
          action: {
            label: "閉じる",
            onClick: clearGenerationRecovery,
          },
        });
      }
    }
  }, [generationRecovery, clearGenerationRecovery]);

  return (
    <>
      <BrainstormChatContainer
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        welcomeMessage="アイデアや企画を一緒に整理して、実現可能な形にしていきましょう。"
        inputPlaceholder="アイデアを一言で教えてください..."
        onStopGeneration={stopGeneration}
        onForkFromMessage={forkFromMessage}
        branches={branches}
        currentBranchId={currentBranchId}
        onSwitchBranch={switchBranch}
        onRegenerate={regenerateLastMessage}
        canRegenerate={canRegenerate}
        conversationId={currentConversationId || undefined}
        restoredMetadata={restoredMetadata}
        onMetadataChange={handleMetadataChange}
        onSubModeChange={setSubMode}
        headerExtra={
          <>
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              disabled={isLoading}
            />
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
              disabled={!canChangeProject}
            />
          </>
        }
      />
      <TokenLimitDialog />
    </>
  );
}
