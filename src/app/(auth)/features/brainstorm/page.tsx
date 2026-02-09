import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "壁打ちモード | Eurecode",
  description: "設計の悩みやアイデアをAIと一緒にブラッシュアップ。思考を整理し、より良い設計へ。",
};

export default function BrainstormFeaturePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-background to-background" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400 mb-6">
                <span className="material-symbols-outlined text-lg">lightbulb</span>
                壁打ちモード
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                アイデアを、
                <br />
                一緒に育てる
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                設計の悩み、アーキテクチャの選択、新機能のアイデア出し。
                AIを「壁打ち相手」として、思考を整理し、より良い答えにたどり着けます。
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-violet-500 hover:bg-violet-600" asChild>
                  <Link href="/register">無料で試してみる</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/#features">他のモードを見る</Link>
                </Button>
              </div>
            </div>

            {/* Hero Mockup */}
            <div className="relative">
              <Card className="shadow-2xl border-violet-500/20 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                  <span className="ml-auto text-xs text-muted-foreground">壁打ちモード</span>
                </div>
                <CardContent className="p-6 bg-card/80">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="size-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">
                        U
                      </div>
                      <div className="flex-1 p-3 bg-muted/50 rounded-lg text-sm">
                        <p className="text-foreground">
                          認証機能を実装したいんだけど、JWTとセッションベース、どっちがいいかな？
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                      </div>
                      <div className="flex-1 p-3 bg-violet-500/5 rounded-lg text-sm border border-violet-500/20">
                        <p className="font-medium text-foreground mb-2">
                          いい質問ですね。いくつか確認させてください。
                        </p>
                        <p className="text-muted-foreground text-xs mb-3">
                          このアプリはSPAですか、SSRですか？
                          また、モバイルアプリからもアクセスする予定はありますか？
                        </p>
                        <p className="text-muted-foreground text-xs">
                          これによって最適な選択が変わってきます。
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Key Feature */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Card className="border-violet-500/20 overflow-hidden">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Conversation flow */}
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        U
                      </div>
                      <p className="text-sm text-muted-foreground">
                        SPAで、将来的にモバイルアプリも考えてる
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-xs">psychology</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        なるほど。その場合はJWTが向いていそうですね。理由を整理してみましょう...
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        U
                      </div>
                      <p className="text-sm text-muted-foreground">
                        でもJWTはトークン無効化が難しいって聞いた
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-xs">psychology</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        その懸念は正しいです。いくつかの対策パターンを見てみましょう。短い有効期限 + リフレッシュトークンの組み合わせはどうですか？
                      </p>
                    </div>

                    {/* Summary card */}
                    <div className="mt-4 p-4 bg-violet-500/5 rounded-lg border border-violet-500/20">
                      <div className="flex items-center gap-2 text-violet-400 text-sm font-medium mb-2">
                        <span className="material-symbols-outlined text-lg">summarize</span>
                        議論のまとめ
                      </div>
                      <ul className="space-y-2 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-violet-400 text-sm mt-0.5">check</span>
                          SPA + モバイル対応のためJWTを採用
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-violet-400 text-sm mt-0.5">check</span>
                          アクセストークンは15分、リフレッシュトークンは7日
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-violet-400 text-sm mt-0.5">check</span>
                          リフレッシュトークンはDBで管理し、無効化可能に
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 text-violet-400 mb-4">
                <span className="material-symbols-outlined">forum</span>
                <span className="text-sm font-medium">壁打ちモードの特徴</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
                対話で思考を整理し、
                <br />
                最適解を見つける
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                壁打ちモードでは、AIが質問を投げかけながら、
                あなたの考えを引き出し、整理します。
                一人で悩んでいては気づかなかった視点や、
                見落としていた選択肢が見つかることも。
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-violet-400 mt-0.5">check_circle</span>
                  <span className="text-muted-foreground">質問に答えるだけで考えが整理される</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-violet-400 mt-0.5">check_circle</span>
                  <span className="text-muted-foreground">複数の選択肢を比較検討できる</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-violet-400 mt-0.5">check_circle</span>
                  <span className="text-muted-foreground">議論の内容を自動でまとめてくれる</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              壁打ちモードでできること
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">architecture</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">設計相談</h3>
              <p className="text-sm text-muted-foreground">
                アーキテクチャや技術選定について、AIと議論しながら検討
              </p>
            </div>

            <div className="text-center">
              <div className="size-14 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">psychology</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">思考の整理</h3>
              <p className="text-sm text-muted-foreground">
                モヤモヤしたアイデアを、対話を通じて具体化
              </p>
            </div>

            <div className="text-center">
              <div className="size-14 rounded-2xl bg-violet-500/15 text-violet-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">compare</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">選択肢の比較</h3>
              <p className="text-sm text-muted-foreground">
                複数の方法のメリット・デメリットを整理して比較
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              こんな時に使えます
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">rocket_launch</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">新しいプロジェクトを始める時</h3>
                    <p className="text-sm text-muted-foreground">
                      技術スタック、ディレクトリ構成、アーキテクチャなど、
                      最初の設計方針を一緒に考えられます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">construction</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">リファクタリングを検討する時</h3>
                    <p className="text-sm text-muted-foreground">
                      「この設計、本当に正しい？」という不安を、
                      対話を通じて確認し、より良い方向性を見つけます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">balance</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">技術選定で迷った時</h3>
                    <p className="text-sm text-muted-foreground">
                      ライブラリやフレームワークの選択で悩んだら、
                      要件を整理しながら最適な選択を探れます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">groups</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">チームへの提案前に</h3>
                    <p className="text-sm text-muted-foreground">
                      チームに提案する前に、AIと壁打ちして
                      論点を整理し、説得力のある提案を作れます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Conversation Examples */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              こんな会話ができます
            </h2>
            <p className="mt-4 text-muted-foreground">
              壁打ちモードでの実際の対話例
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-violet-400 text-sm mb-4">
                  <span className="material-symbols-outlined text-lg">chat_bubble</span>
                  設計相談
                </div>
                <p className="text-sm text-foreground font-medium mb-2">
                  「マイクロサービスとモノリス、どっちがいい？」
                </p>
                <p className="text-xs text-muted-foreground">
                  チームの規模、デプロイ頻度、開発フェーズなどを確認しながら、最適なアーキテクチャを一緒に検討
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-violet-400 text-sm mb-4">
                  <span className="material-symbols-outlined text-lg">chat_bubble</span>
                  技術選定
                </div>
                <p className="text-sm text-foreground font-medium mb-2">
                  「状態管理、Redux と Zustand で迷ってる」
                </p>
                <p className="text-xs text-muted-foreground">
                  アプリの規模、チームの経験、必要な機能を整理して、プロジェクトに合った選択をサポート
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-violet-400 text-sm mb-4">
                  <span className="material-symbols-outlined text-lg">chat_bubble</span>
                  アイデア出し
                </div>
                <p className="text-sm text-foreground font-medium mb-2">
                  「ユーザー体験を良くしたいんだけど」
                </p>
                <p className="text-xs text-muted-foreground">
                  現状の課題を深掘りし、ローディング状態、エラーハンドリング、アニメーションなど具体的な改善案を一緒に考える
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-violet-500/10 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            一人で悩まず、AIと一緒に考えよう
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            14日間無料で、壁打ちモードを体験できます。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-violet-500 hover:bg-violet-600 text-base px-10 h-14" asChild>
              <Link href="/register">
                無料で始める
                <span className="material-symbols-outlined ml-2">arrow_forward</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Other modes */}
      <section className="py-16 border-t border-border/50 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h3 className="text-center text-lg font-medium text-muted-foreground mb-8">
            他のモードも見る
          </h3>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Link href="/features/explanation" className="group">
              <Card className="border-border/50 hover:border-blue-500/30 transition-colors">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">menu_book</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground group-hover:text-blue-400 transition-colors">
                      解説モード
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      コードの仕組みを理解する
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/features/generation" className="group">
              <Card className="border-border/50 hover:border-amber-500/30 transition-colors">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">bolt</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground group-hover:text-amber-400 transition-colors">
                      生成モード
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      実装したい機能を言葉で伝える
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
