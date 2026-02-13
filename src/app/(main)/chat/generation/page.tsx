"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { GenerationChatContainer, ModelSelector } from "@/components/chat";
import { ProjectSelector } from "@/components/chat/ProjectSelector";
import { GoalSettingModal } from "@/components/chat/GoalSettingModal";
import { GoalTrigger } from "@/components/chat/GoalDisplay";
import type { ClaudeModel, LearnerGoal, ConversationMetadata } from "@/types/chat";
import { DEFAULT_MODEL } from "@/types/chat";
import { useChat, ChatApiError } from "@/hooks/useChat";
import { useCredits } from "@/hooks/useCredits";
import { useGoal } from "@/hooks/useGoal";
import { useUserSettingsOptional } from "@/contexts/UserSettingsContext";
import { toast } from "sonner";
import type { PersistedGenerationState } from "@/hooks/useGenerationMode";

// 拡張されたConversationMetadata型（generationStateを含む）
interface ExtendedConversationMetadata {
  generationState?: PersistedGenerationState;
}

export default function GenerationModePage() {
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("id");
  const initialProjectId = searchParams.get("projectId");
  const userSettings = useUserSettingsOptional();

  // Track conversation ID in state to avoid page navigation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(initialConversationId);
  const hasUpdatedUrlRef = useRef(false);

  // Get unlockSkipAllowed from user settings
  const canSkip = userSettings?.settings?.unlockSkipAllowed ?? false;

  // Project selection state (can be changed before first message)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId);

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
      window.history.replaceState(null, "", `/chat/generation/${id}`);
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
    mode: "generation",
    conversationId: currentConversationId || undefined,
    projectId: selectedProjectId || undefined,
    onError: handleError,
    onConversationCreated: handleConversationCreated,
    onPointsConsumed: handlePointsConsumed,
    model: selectedModel,
  });

  // Goal setting for learner autonomy
  const handleMetadataChange = useCallback(
    (metadata: Partial<ConversationMetadata>) => {
      setExternalMetadata(metadata);
    },
    [setExternalMetadata]
  );

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

  // Disable project change once conversation has started
  const canChangeProject = messages.length === 0 && !currentConversationId;

  // 会話metadataから生成モード状態を取得
  const initialGenerationState = useMemo(() => {
    const extendedMetadata = restoredMetadata as ExtendedConversationMetadata | null;
    return extendedMetadata?.generationState || undefined;
  }, [restoredMetadata]);

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
        canRegenerate={false}
        conversationId={currentConversationId || undefined}
        initialGenerationState={initialGenerationState}
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
