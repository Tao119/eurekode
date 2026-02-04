"use client";

import { useEffect, use, useCallback, useMemo } from "react";
import { GenerationChatContainer } from "@/components/chat";
import { useChat } from "@/hooks/useChat";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";
import { toast } from "sonner";
import type { PersistedGenerationState } from "@/hooks/useGenerationMode";

interface PageProps {
  params: Promise<{ id: string }>;
}

// 拡張されたConversationMetadata型（generationStateを含む）
interface ExtendedConversationMetadata {
  generationState?: PersistedGenerationState;
  // その他のフィールドは省略
}

export default function GenerationRoomPage({ params }: PageProps) {
  const { id: conversationId } = use(params);
  const userSettings = useUserSettingsOptional();

  // Get unlockSkipAllowed from user settings (制限解除モード)
  const canSkip = userSettings?.settings?.unlockSkipAllowed ?? false;

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
  } = useChat({
    mode: "generation",
    conversationId,
    onError: handleError,
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

  // 会話metadataから生成モード状態を取得
  const initialGenerationState = useMemo(() => {
    const extendedMetadata = restoredMetadata as ExtendedConversationMetadata | null;
    return extendedMetadata?.generationState || undefined;
  }, [restoredMetadata]);

  return (
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
      conversationId={conversationId}
      initialGenerationState={initialGenerationState}
    />
  );
}
