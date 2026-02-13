"use client";

import { useEffect, use, useCallback } from "react";
import { ExplanationChatContainer } from "@/components/chat/ExplanationChatContainer";
import { useChat } from "@/hooks/useChat";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ExplanationRoomPage({ params }: PageProps) {
  const { id: conversationId } = use(params);

  // Credit state for real-time updates
  const { updateBalance } = useCredits();

  // Handler for real-time point consumption updates
  const handlePointsConsumed = useCallback((info: { remainingPoints: number; lowBalanceWarning?: boolean }) => {
    updateBalance(info.remainingPoints);
    if (info.lowBalanceWarning) {
      toast.warning("ポイント残高が少なくなっています", { duration: 3000 });
    }
  }, [updateBalance]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    toast.error(error.message);
  }, []);

  const {
    messages,
    isLoading,
    isLoadingHistory,
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
    onError: handleError,
    onPointsConsumed: handlePointsConsumed,
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
    <ExplanationChatContainer
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
      canRegenerate={false}
      conversationId={conversationId}
    />
  );
}
