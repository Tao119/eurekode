import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HelpPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-3xl">
        <CardHeader>
        <CardTitle className="text-2xl font-bold">ヘルプ</CardTitle>
        <p className="text-sm text-muted-foreground">
          よくある質問とサポート情報
        </p>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Getting Started */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">rocket_launch</span>
            はじめに
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">Eurecodeとは</h3>
              <p className="text-sm text-muted-foreground">
                AIを活用したプログラミング学習支援サービス。
                コードの説明を受けたり、ブレインストーミングをしたり、
                コード生成の練習をしたりできる。
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">アカウントの作成方法</h3>
              <p className="text-sm text-muted-foreground">
                <Link href="/register" className="text-primary hover:underline">新規登録ページ</Link>
                からメールアドレスとパスワードを入力してアカウントを作成できる。
                組織で利用する場合は管理者アカウントを選択する。
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">apps</span>
            機能について
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">コード説明モード</h3>
              <p className="text-sm text-muted-foreground">
                コードを入力すると、AIがそのコードの動作を詳しく説明する。
                わからないコードを理解するのに役立つ。
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">ブレインストーミングモード</h3>
              <p className="text-sm text-muted-foreground">
                アイデアをAIと一緒にブラッシュアップできる。
                新機能の設計やアーキテクチャの検討に活用できる。
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">コード生成モード</h3>
              <p className="text-sm text-muted-foreground">
                要件を伝えると、AIがコードを生成する。
                クイズに回答することで、生成されたコードの理解を深められる。
              </p>
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">manage_accounts</span>
            アカウント管理
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">パスワードを忘れた場合</h3>
              <p className="text-sm text-muted-foreground">
                <Link href="/forgot-password" className="text-primary hover:underline">パスワードリセットページ</Link>
                からメールアドレスを入力してリセット用のリンクを受け取る。
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">アクセスキーでの参加</h3>
              <p className="text-sm text-muted-foreground">
                組織から発行されたアクセスキーを持っている場合は、
                <Link href="/join" className="text-primary hover:underline">キー入力ページ</Link>
                からキーを入力して参加できる。
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">mail</span>
            お問い合わせ
          </h2>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-4">
              質問や要望があれば、お問い合わせフォームから連絡を。
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-base">send</span>
              お問い合わせフォームへ
            </Link>
          </div>
        </section>

        <div className="pt-6 border-t border-border">
          <Link href="/login" className="text-primary hover:underline text-sm">
            ← ログインページに戻る
          </Link>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
