"use client";

import { useState, useEffect, useCallback } from "react";
import { OutOfCreditsModal, OutOfCreditsMessage } from "@/components/billing/OutOfCreditsModal";
import { CreditBalanceDisplay } from "@/components/billing/CreditAlert";
import { useCredits } from "@/hooks/useCredits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";
import type { IndividualPlan, OrganizationPlan, AIModel } from "@/config/plans";

interface ChatWithCreditsProps {
  children: React.ReactNode;
  /** メッセージ送信ハンドラーをラップ */
  onSendMessage?: (message: string, attachments?: unknown[]) => void;
  /** チャットコンテナに渡すprops */
  chatProps?: Record<string, unknown>;
}

/**
 * チャット画面のクレジット管理ラッパー
 *
 * - 低残高警告の表示
 * - ポイント不足時のモーダル表示
 * - 送信前のポイントチェック
 */
export function ChatWithCredits({ children, onSendMessage }: ChatWithCreditsProps) {
  const credits = useCredits();
  const [showModal, setShowModal] = useState(false);

  // ポイント不足時に自動でモーダルを表示
  useEffect(() => {
    if (credits.isBlocked && !credits.isLoading) {
      setShowModal(true);
    }
  }, [credits.isBlocked, credits.isLoading]);

  return (
    <>
      {/* 低残高警告バナー（5会話以下） */}
      {credits.lowBalanceWarning && !credits.isBlocked && (
        <LowBalanceWarning
          remainingConversations={credits.remainingConversations.sonnet}
          onOpenModal={() => setShowModal(true)}
        />
      )}

      {/* ポイント不足メッセージ（チャット内） */}
      {credits.isBlocked && (
        <OutOfCreditsMessage
          remainingConversations={0}
          isOrganizationMember={credits.isOrganizationMember}
          onOpenModal={() => setShowModal(true)}
        />
      )}

      {/* チャット本体 */}
      {children}

      {/* OutOfCreditsModal */}
      <OutOfCreditsModal
        open={showModal}
        onOpenChange={setShowModal}
        remainingPoints={credits.totalRemaining}
        remainingConversations={credits.remainingConversations.sonnet}
        currentPlan={credits.plan as IndividualPlan | OrganizationPlan}
        isOrganization={credits.isOrganization}
        isOrganizationMember={credits.isOrganizationMember}
        isCompletelyOut={credits.isBlocked}
      />
    </>
  );
}

/**
 * 低残高警告バナー
 */
function LowBalanceWarning({
  remainingConversations,
  onOpenModal,
}: {
  remainingConversations: number;
  onOpenModal: () => void;
}) {
  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
      <div className="mx-auto max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span className="text-yellow-800 dark:text-yellow-200">
            残り約{remainingConversations}回の会話が可能です
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-yellow-800 border-yellow-500/50 hover:bg-yellow-500/10"
          onClick={onOpenModal}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          ポイント追加
        </Button>
      </div>
    </div>
  );
}

/**
 * ヘッダー用のクレジット残高バッジ
 */
export function CreditBadge({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const credits = useCredits();

  if (credits.isLoading) {
    return (
      <Badge variant="outline" className={className}>
        ...
      </Badge>
    );
  }

  const isLow = credits.lowBalanceWarning;
  const isOut = credits.isBlocked;

  return (
    <Badge
      variant={isOut ? "destructive" : isLow ? "secondary" : "outline"}
      className={`cursor-pointer ${className}`}
      onClick={onClick}
    >
      {credits.remainingConversations.sonnet}pt
    </Badge>
  );
}

/**
 * 使用前のモデル選択と残高確認
 */
export function ModelSelectorWithCredits({
  selectedModel,
  onModelChange,
  disabled,
}: {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
}) {
  const credits = useCredits();

  const models: { id: AIModel; name: string; rate: number }[] = [
    { id: "sonnet", name: "標準", rate: 1.0 },
    { id: "opus", name: "高性能", rate: 1.6 },
  ];

  return (
    <div className="flex items-center gap-2">
      {models.map((model) => {
        const canUse = credits.canUseModel(model.id);
        const remaining = credits.getRemainingForModel(model.id);
        const isAvailable = credits.availableModels.includes(model.id);

        return (
          <button
            key={model.id}
            onClick={() => onModelChange(model.id)}
            disabled={disabled || !canUse || !isAvailable}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${selectedModel === model.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
              }
              ${!canUse || !isAvailable ? "opacity-50 cursor-not-allowed" : ""}
            `}
            title={
              !isAvailable
                ? "このモデルはプランで利用できません"
                : !canUse
                ? "ポイントが不足しています"
                : `残り${remaining}回`
            }
          >
            {model.name}
            {isAvailable && (
              <span className="ml-1 text-xs opacity-70">
                ({model.rate}pt)
              </span>
            )}
            {!isAvailable && (
              <span className="ml-1 text-xs">🔒</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 送信ボタンのラッパー（ポイントチェック付き）
 */
export function useSendWithCreditCheck() {
  const credits = useCredits();
  const [showModal, setShowModal] = useState(false);

  const checkAndSend = useCallback(
    (
      sendFn: () => void,
      model: AIModel = "sonnet"
    ): { canSend: boolean; showModal: () => void } => {
      if (!credits.canUseModel(model)) {
        return {
          canSend: false,
          showModal: () => setShowModal(true),
        };
      }

      sendFn();
      return { canSend: true, showModal: () => {} };
    },
    [credits]
  );

  return {
    checkAndSend,
    showModal,
    setShowModal,
    credits,
  };
}
