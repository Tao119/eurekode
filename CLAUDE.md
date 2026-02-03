# Eurecode プロジェクト

## プロジェクト概要

Eurecodeは「コードを渡すのではなく、思考プロセスを渡す」をコンセプトとしたプログラミング学習支援AIチャットサービスです。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS v4
- **UIコンポーネント**: shadcn/ui (Radix UI)
- **状態管理**: Zustand
- **フォーム**: React Hook Form + Zod
- **ORM**: Prisma
- **認証**: NextAuth.js v5
- **AI**: Anthropic Claude API
- **決済**: Stripe

## ディレクトリ構造

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 認証関連ページ
│   ├── (main)/            # メインアプリケーション
│   │   ├── chat/          # チャット画面（各モード）
│   │   ├── admin/         # 管理者画面
│   │   ├── history/       # 学習履歴
│   │   └── settings/      # 設定
│   └── api/               # API Routes
├── components/
│   ├── ui/                # shadcn/ui コンポーネント
│   ├── chat/              # チャット関連コンポーネント
│   ├── common/            # 共通コンポーネント
│   ├── layout/            # レイアウトコンポーネント
│   └── providers/         # Context Providers
├── hooks/                 # カスタムフック
├── lib/                   # ユーティリティ
├── types/                 # 型定義
├── stores/                # Zustand ストア
├── prompts/               # AI プロンプト
└── generated/             # Prisma 生成ファイル
```

## 実装ロードマップ

### Phase 1: コア機能強化（現在）

#### 1.1 チャットUI省力化（優先度: 高）
- [x] 基本的なチャット機能
- [x] n択オプション自動検出・ボタン化
- [ ] インタラクティブクイズコンポーネント（正解/不正解フィードバック）
- [ ] 選択式回答の自動送信
- [ ] タイピングインジケーター改善

#### 1.2 解説モードのソクラテス式対話（優先度: 高）
- [x] 基本プロンプト設計
- [ ] 段階的質問フロー（初期推測→理解度確認→解説→転移確認）
- [ ] 理解度トラッキング
- [ ] 気づきカード自動生成

#### 1.3 生成モードの段階アンロック（優先度: 高）
- [ ] コードぼかし表示（blur filter）
- [ ] アンロックレベル管理（4段階）
- [ ] 理解度クイズ連携
- [ ] アンロック時のアニメーション

#### 1.4 壁打ちモードのガイド付きフロー（優先度: 中）
- [ ] フェーズ管理（言語化→ペルソナ→市場→技術→MVP→タスク分解）
- [ ] 各フェーズの選択式質問
- [ ] タスク自動生成・編集UI

### Phase 2: 学習支援機能

#### 2.1 学習履歴・振り返り
- [ ] 会話履歴一覧
- [ ] 気づきカード管理
- [ ] 簡易振り返りUI（絵文字選択式）
- [ ] 詳細振り返りオプション

#### 2.2 成長ダッシュボード
- [ ] 学習時間グラフ
- [ ] トピック別理解度
- [ ] 連続学習日数（ストリーク）
- [ ] 達成バッジ

#### 2.3 トークン管理
- [ ] リアルタイム残量表示
- [ ] 消費予測
- [ ] 上限到達時のUX

### Phase 3: 管理・課金機能

#### 3.1 アクセスキー管理
- [ ] キー発行UI
- [ ] キー入力（自動分割・自動検証）
- [ ] キー一覧・無効化

#### 3.2 組織管理
- [ ] メンバー一覧
- [ ] 利用状況モニタリング
- [ ] 組織設定

#### 3.3 課金システム
- [ ] Stripe連携
- [ ] プラン選択UI
- [ ] 請求履歴

## コーディング規約

### コンポーネント設計

```typescript
// 推奨パターン: 機能別にフォルダ分け
// components/chat/QuizCard.tsx
interface QuizCardProps {
  quiz: QuizData;
  onAnswer: (answerId: number) => void;
  disabled?: boolean;
}

export function QuizCard({ quiz, onAnswer, disabled }: QuizCardProps) {
  // 実装
}
```

### 状態管理

```typescript
// Zustand ストア（stores/chat-store.ts）
interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  // 実装
}));
```

### API 設計

```typescript
// 標準レスポンス形式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

## 重要な設計原則

### UX最適化（最重要）

1. **ゼロ入力アプローチ**: 可能な限りクリック/タップで完結
2. **スマートデフォルト**: 設定不要で使える初期値
3. **自動進行**: 確認ボタンを減らし、自動で次へ進む
4. **コンテキスト保持**: 中断しても続きから再開可能

### コード品質

1. **イミュータブル**: 新しいオブジェクトを作成、ミューテーション禁止
2. **小さなファイル**: 200-400行を目安、800行以下
3. **型安全**: any禁止、厳密な型定義
4. **エラーハンドリング**: 全ての非同期処理でcatch

## 環境変数

```env
# 必須
ANTHROPIC_API_KEY=          # Claude API キー
DATABASE_URL=               # PostgreSQL 接続文字列
AUTH_SECRET=                # NextAuth シークレット

# オプション
STRIPE_SECRET_KEY=          # Stripe シークレットキー
STRIPE_WEBHOOK_SECRET=      # Stripe Webhook シークレット
RESEND_API_KEY=             # メール送信用
UPSTASH_REDIS_URL=          # Redis URL
```

## コマンド

```bash
# 開発
pnpm dev

# ビルド
pnpm build

# Prisma
pnpm prisma generate   # クライアント生成
pnpm prisma db push    # スキーマ反映
pnpm prisma studio     # GUI

# テスト
pnpm test:e2e          # E2Eテスト
pnpm test:e2e:ui       # E2Eテスト（UI）
```
