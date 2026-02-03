"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GenerationChatContainer } from "@/components/chat";
import { ProjectSelector } from "@/components/chat/ProjectSelector";
import { useChat, ChatApiError } from "@/hooks/useChat";
import { useTokenUsageOptional } from "@/contexts/TokenUsageContext";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";
import { useTokenLimitDialog } from "@/components/common/TokenLimitDialog";
import { toast } from "sonner";

export default function GenerationModePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams.get("id");
  const initialProjectId = searchParams.get("projectId");
  const tokenUsage = useTokenUsageOptional();
  const userSettings = useUserSettingsOptional();
  const { showTokenLimitError, TokenLimitDialog } = useTokenLimitDialog();

  // Get unlockSkipAllowed from user settings
  const canSkip = userSettings?.settings?.unlockSkipAllowed ?? false;

  // Project selection state (can be changed before first message)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);

  // Navigate to the room route when a new conversation is created
  const handleConversationCreated = useCallback((id: string) => {
    router.replace(`/chat/generation/${id}`);
  }, [router]);

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
  } = useChat({
    mode: "generation",
    conversationId: conversationId || undefined,
    projectId: selectedProjectId || undefined,
    onError: handleError,
    onConversationCreated: handleConversationCreated,
    onTokensUsed: handleTokensUsed,
  });

  // Disable project change once conversation has started
  const canChangeProject = messages.length === 0 && !conversationId;

  // Load conversation from history if ID is provided (legacy query param support)
  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId, loadConversation]);

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
      <GenerationChatContainer
        messages={messages}
        isLoading={isLoading}
        onSendMessage={sendMessage}
        welcomeMessage="実装したい機能を言葉で説明してください。計画を立て、コードを生成し、理解度を確認しながら進めます。"
        inputPlaceholder="実装したい機能を説明してください..."
        canSkip={canSkip}
        onStopGeneration={stopGeneration}
        onForkFromMessage={forkFromMessage}
        branches={branches}
        currentBranchId={currentBranchId}
        onSwitchBranch={switchBranch}
        onRegenerate={regenerateLastMessage}
        canRegenerate={canRegenerate}
        conversationId={conversationId || undefined}
        headerExtra={
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
            disabled={!canChangeProject}
          />
        }
      />
      <TokenLimitDialog />
    </>
  );
}
