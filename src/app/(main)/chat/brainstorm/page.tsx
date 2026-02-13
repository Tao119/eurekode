"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BrainstormChatContainer, ModelSelector } from "@/components/chat";
import { ProjectSelector } from "@/components/chat/ProjectSelector";
import { GoalSettingModal } from "@/components/chat/GoalSettingModal";
import { GoalTrigger } from "@/components/chat/GoalDisplay";
import type { ClaudeModel, LearnerGoal } from "@/types/chat";
import { DEFAULT_MODEL } from "@/types/chat";
import { useChat, ChatApiError } from "@/hooks/useChat";
import { useCredits } from "@/hooks/useCredits";
import { useGoal } from "@/hooks/useGoal";
import { toast } from "sonner";
import type { ConversationMetadata, BrainstormSubMode } from "@/types/chat";

export default function BrainstormModePage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("id");
  const initialProjectId = searchParams.get("projectId");

  // Track conversation ID in state to avoid page navigation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId);
  const hasUpdatedUrlRef = useRef(false);

  // Project selection state (can be changed before first message)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);
  // SubMode state for API calls (synced from BrainstormChatContainer)
  const [subMode, setSubMode] = useState<BrainstormSubMode>("casual");
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>(DEFAULT_MODEL);

  // Credit state for real-time updates
  const { updateBalance } = useCredits();

  // Handler for real-time point consumption updates
  const handlePointsConsumed = useCallback((info: { remainingPoints: number; lowBalanceWarning?: boolean }) => {
    updateBalance(info.remainingPoints);
    if (info.lowBalanceWarning) {
      toast.warning("ポイント残高が少なくなっています", { duration: 3000 });
    }
  }, [updateBalance]);

  // Update URL without navigation when a new conversation is created
  const handleConversationCreated = useCallback((id: string) => {
    setCurrentConversationId(id);
    // Update URL for bookmarking/sharing without triggering navigation
    if (typeof window !== "undefined" && !hasUpdatedUrlRef.current) {
      hasUpdatedUrlRef.current = true;
      window.history.replaceState(null, "", `/chat/brainstorm/${id}`);
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
    restoredMetadata,
    setExternalMetadata,
  } = useChat({
    mode: "brainstorm",
    conversationId: currentConversationId || undefined,
    projectId: selectedProjectId || undefined,
    brainstormSubMode: subMode,
    onError: handleError,
    onConversationCreated: handleConversationCreated,
    onPointsConsumed: handlePointsConsumed,
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

  // Goal setting for learner autonomy
  const { goal, setGoal, clearGoal } = useGoal({
    restoredMetadata,
    onMetadataChange: handleMetadataChange,
  });

  const [showGoalModal, setShowGoalModal] = useState(false);
  const goalModalShownRef = useRef(false);

  // Show goal modal for new conversations
  useEffect(() => {
    if (
      !currentConversationId &&
      messages.length === 0 &&
      !goalModalShownRef.current &&
      !isLoading
    ) {
      const timer = setTimeout(() => {
        setShowGoalModal(true);
        goalModalShownRef.current = true;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentConversationId, messages.length, isLoading]);

  const handleGoalSubmit = useCallback(
    (newGoal: LearnerGoal) => {
      setGoal(newGoal);
      setShowGoalModal(false);
    },
    [setGoal]
  );

  const handleGoalSkip = useCallback(() => {
    setShowGoalModal(false);
  }, []);

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
      <GoalSettingModal
        open={showGoalModal}
        onOpenChange={setShowGoalModal}
        onSubmit={handleGoalSubmit}
        onSkip={handleGoalSkip}
      />
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
        conversationId={currentConversationId || undefined}
        restoredMetadata={restoredMetadata}
        onMetadataChange={handleMetadataChange}
        onSubModeChange={setSubMode}
        goal={goal}
        onGoalEdit={() => setShowGoalModal(true)}
        onGoalClear={clearGoal}
        headerExtra={
          <>
            <GoalTrigger goal={goal} onClick={() => setShowGoalModal(true)} />
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
    </>
  );
}
