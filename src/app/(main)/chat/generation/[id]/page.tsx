"use client";

import { useEffect, use } from "react";
import { GenerationChatContainer } from "@/components/chat";
import { useChat } from "@/hooks/useChat";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function GenerationRoomPage({ params }: PageProps) {
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
  } = useChat({
    mode: "generation",
    conversationId,
    onError: (error) => {
      toast.error(error.message);
    },
  });

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
    <GenerationChatContainer
      messages={messages}
      isLoading={isLoading}
      onSendMessage={sendMessage}
      welcomeMessage="実装したい機能を言葉で説明してください。計画を立て、コードを生成し、理解度を確認しながら進めます。"
      inputPlaceholder="実装したい機能を説明してください..."
      canSkip={false}
      onStopGeneration={stopGeneration}
      onForkFromMessage={forkFromMessage}
      branches={branches}
      currentBranchId={currentBranchId}
      onSwitchBranch={switchBranch}
      onRegenerate={regenerateLastMessage}
      canRegenerate={canRegenerate}
    />
  );
}
