"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChatContainer, ModelSelector } from "@/components/chat";
import { ProjectSelector } from "@/components/chat/ProjectSelector";
import type { ClaudeModel } from "@/types/chat";
import { DEFAULT_MODEL } from "@/types/chat";
import { useChat, ChatApiError } from "@/hooks/useChat";
import { toast } from "sonner";

export default function ExplanationModePage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("id");
  const initialProjectId = searchParams.get("projectId");

  // Track conversation ID in state to avoid page navigation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId);
  const hasUpdatedUrlRef = useRef(false);

  // Project selection state (can be changed before first message)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);

  // Model selection state
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>(DEFAULT_MODEL);

  // Update URL without navigation when a new conversation is created
  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConversationId(id);
    // Update URL for bookmarking/sharing without triggering navigation
    if (typeof window !== "undefined" && !hasUpdatedUrlRef.current) {
      hasUpdatedUrlRef.current = true;
      window.history.replaceState(null, "", `/chat/explanation/${id}`);
    }
  }, []);

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
  } = useChat({
    mode: "explanation",
    conversationId: currentConversationId || undefined,
    projectId: selectedProjectId || undefined,
    onError: handleError,
    onConversationCreated: handleConversationCreated,
    model: selectedModel,
  });

  // Disable project change once conversation has started
  const canChangeProject = messages.length === 0 && !currentConversationId;

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
      conversationId={currentConversationId || undefined}
    />
  );
}
