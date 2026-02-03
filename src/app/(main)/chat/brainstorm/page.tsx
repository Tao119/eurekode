"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BrainstormChatContainer } from "@/components/chat/BrainstormChatContainer";
import { ProjectSelector } from "@/components/chat/ProjectSelector";
import { useChat } from "@/hooks/useChat";
import { useTokenUsageOptional } from "@/contexts/TokenUsageContext";
import { toast } from "sonner";
import type { ConversationMetadata, BrainstormSubMode } from "@/types/chat";

export default function BrainstormModePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = searchParams.get("id");
  const initialProjectId = searchParams.get("projectId");
  const tokenUsage = useTokenUsageOptional();

  // Project selection state (can be changed before first message)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
  // SubMode state for API calls (synced from BrainstormChatContainer)
  const [subMode, setSubMode] = useState<BrainstormSubMode>("casual");

  // Navigate to the room route when a new conversation is created
  const handleConversationCreated = useCallback((id: string) => {
    router.replace(`/chat/brainstorm/${id}`);
  }, [router]);

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
    restoredMetadata,
    setExternalMetadata,
  } = useChat({
    mode: "brainstorm",
    conversationId: conversationId || undefined,
    projectId: selectedProjectId || undefined,
    brainstormSubMode: subMode,
    onError: (error) => {
      toast.error(error.message);
    },
    onConversationCreated: handleConversationCreated,
    onTokensUsed: handleTokensUsed,
  });

  // Disable project change once conversation has started
  const canChangeProject = messages.length === 0 && !conversationId;

  // Handle metadata changes from BrainstormChatContainer
  const handleMetadataChange = useCallback(
    (metadata: Partial<ConversationMetadata>) => {
      setExternalMetadata(metadata);
    },
    [setExternalMetadata]
  );

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
      conversationId={conversationId || undefined}
      restoredMetadata={restoredMetadata}
      onMetadataChange={handleMetadataChange}
      onSubModeChange={setSubMode}
      headerExtra={
        <ProjectSelector
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          disabled={!canChangeProject}
        />
      }
    />
  );
}
