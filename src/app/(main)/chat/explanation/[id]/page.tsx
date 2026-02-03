"use client";

import { useEffect, use, useCallback } from "react";
import { ChatContainer } from "@/components/chat";
import { useChat } from "@/hooks/useChat";
import { useTokenUsageOptional } from "@/contexts/TokenUsageContext";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ExplanationRoomPage({ params }: PageProps) {
  const { id: conversationId } = use(params);
  const tokenUsage = useTokenUsageOptional();

  // Update token usage when response completes
  const handleTokensUsed = useCallback((tokens: number) => {
    tokenUsage?.addUsage(tokens);
  }, [tokenUsage]);

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
    mode: "explanation",
    conversationId,
    onError: (error) => {
      toast.error(error.message);
    },
    onTokensUsed: handleTokensUsed,
  });

  // Load conversation on mount (only when conversationId changes)
  useEffect(() => {
    loadConversation(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

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
    <ChatContainer
      mode="explanation"
      messages={messages}
      isLoading={isLoading}
      onSendMessage={sendMessage}
      welcomeMessage="コードや技術的な概念について質問してください。わかりやすく解説します。"
      inputPlaceholder="コードを貼り付けるか、質問を入力してください..."
      onStopGeneration={stopGeneration}
      onForkFromMessage={forkFromMessage}
      branches={branches}
      currentBranchId={currentBranchId}
      onSwitchBranch={switchBranch}
      onRegenerate={regenerateLastMessage}
      canRegenerate={canRegenerate}
      conversationId={conversationId}
    />
  );
}
