"use client";

import { useEffect, use, useCallback } from "react";
import { BrainstormChatContainer } from "@/components/chat/BrainstormChatContainer";
import { useChat } from "@/hooks/useChat";
import { toast } from "sonner";
import type { ConversationMetadata } from "@/types/chat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BrainstormRoomPage({ params }: PageProps) {
  const { id: conversationId } = use(params);

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
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handle metadata changes from BrainstormChatContainer
  const handleMetadataChange = useCallback(
    (metadata: Partial<ConversationMetadata>) => {
      setExternalMetadata(metadata);
    },
    [setExternalMetadata]
  );

  // Load conversation on mount
  useEffect(() => {
    loadConversation(conversationId);
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
      conversationId={conversationId}
      restoredMetadata={restoredMetadata}
      onMetadataChange={handleMetadataChange}
    />
  );
}
