"use client";

import { useState, useEffect, use, useCallback } from "react";
import { BrainstormChatContainer } from "@/components/chat/BrainstormChatContainer";
import { useChat } from "@/hooks/useChat";
import { useCredits } from "@/hooks/useCredits";
import { toast } from "sonner";
import type { ConversationMetadata, BrainstormSubMode } from "@/types/chat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BrainstormRoomPage({ params }: PageProps) {
  const { id: conversationId } = use(params);
  // SubMode state for API calls (synced from BrainstormChatContainer)
  const [subMode, setSubMode] = useState<BrainstormSubMode>("casual");

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
    conversationId,
    brainstormSubMode: subMode,
    onError: handleError,
    onPointsConsumed: handlePointsConsumed,
  });

  // Handle metadata changes from BrainstormChatContainer
  const handleMetadataChange = useCallback(
    (metadata: Partial<ConversationMetadata>) => {
      setExternalMetadata(metadata);
    },
    [setExternalMetadata]
  );

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
      canRegenerate={false}
      conversationId={conversationId}
      restoredMetadata={restoredMetadata}
      onMetadataChange={handleMetadataChange}
      onSubModeChange={setSubMode}
    />
  );
}
