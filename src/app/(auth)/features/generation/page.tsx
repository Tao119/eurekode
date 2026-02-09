import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "生成モード | Eurecode",
  description: "やりたいことを言葉で伝えて、コードを生成。理解度クイズで「使いこなせる」力を身につけます。",
};

export default function GenerationFeaturePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-background to-background" />
          <div className="absolute top-0 right-1/3 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400 mb-6">
                <span className="material-symbols-outlined text-lg">bolt</span>
                生成モード
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                言葉でコードを
                <br />
                生み出す
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                実装したいことを自然な言葉で伝えるだけで、AIがコードを生成。
                さらに、理解度クイズに答えることで、生成されたコードを「自分のもの」にできます。
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600" asChild>
                  <Link href="/register">無料で試してみる</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/#features">他のモードを見る</Link>
                </Button>
              </div>
            </div>

            {/* Hero Mockup */}
            <div className="relative">
              <Card className="shadow-2xl border-amber-500/20 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                  <span className="ml-auto text-xs text-muted-foreground">生成モード</span>
                </div>
                <CardContent className="p-6 bg-card/80">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="size-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">
                        U
                      </div>
                      <div className="flex-1 p-3 bg-muted/50 rounded-lg text-sm">
                        <p className="text-foreground">
                          入力欄にメールアドレスを入力したら、
                          リアルタイムでバリデーションしたい
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                      </div>
                      <div className="flex-1 p-3 bg-amber-500/5 rounded-lg text-sm border border-amber-500/20">
                        <p className="font-medium text-foreground mb-2">
                          メールバリデーションを実装しますね。
                        </p>
                        <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
{`const [email, setEmail] = useState('')
const [error, setError] = useState('')

const validateEmail = (value) => {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
  if (!regex.test(value)) {
    setError('有効なメールアドレスを入力')
  } else {
    setError('')
  }
}`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Key Feature: Quiz */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-amber-400 mb-4">
                <span className="material-symbols-outlined">quiz</span>
                <span className="text-sm font-medium">生成モードの特徴</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
                コピペで終わらせない。
                <br />
                理解度クイズで定着。
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                AIがコードを生成した後、そのコードに関するクイズが出題されます。
                「なぜこう書くのか」「他の書き方はないか」を考えることで、
                単なるコピペではなく、本当に理解したコードになります。
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-400 mt-0.5">check_circle</span>
                  <span className="text-muted-foreground">正解すると次のステップへ進める</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-400 mt-0.5">check_circle</span>
                  <span className="text-muted-foreground">間違えても丁寧な解説が表示される</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-400 mt-0.5">check_circle</span>
                  <span className="text-muted-foreground">クイズの結果は学習記録として保存</span>
                </li>
              </ul>
            </div>

            <div>
              <Card className="border-amber-500/20 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-amber-500/5 px-4 py-3">
                  <span className="material-symbols-outlined text-amber-400 text-lg">quiz</span>
                  <span className="text-sm font-medium text-foreground">理解度チェック</span>
                </div>
                <CardContent className="p-6">
                  <p className="text-foreground font-medium mb-4">
                    このコードで使われている正規表現は、何をチェックしていますか？
                  </p>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted/50 rounded-lg border border-border hover:border-amber-500/30 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full border-2 border-muted-foreground/30" />
                        <span className="text-sm text-muted-foreground">
                          文字列の長さが10文字以上かどうか
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-sm">check</span>
                        </div>
                        <span className="text-sm text-foreground">
                          @の前後に文字があり、ドットを含む形式かどうか
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="size-6 rounded-full border-2 border-muted-foreground/30" />
                        <span className="text-sm text-muted-foreground">
                          特殊文字が含まれていないかどうか
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-green-400 text-lg">check_circle</span>
                      <p className="text-sm text-muted-foreground">
                        正解！この正規表現は、標準的なメールアドレスの形式をチェックしています。
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              生成モードでできること
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">description</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">自然言語で指示</h3>
              <p className="text-sm text-muted-foreground">
                「ボタンをクリックしたら〜」のように、日本語でやりたいことを伝えるだけ
              </p>
            </div>

            <div className="text-center">
              <div className="size-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">code</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">コード生成</h3>
              <p className="text-sm text-muted-foreground">
                要件に合ったコードをAIが生成。コメント付きで分かりやすく
              </p>
            </div>

            <div className="text-center">
              <div className="size-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">quiz</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">理解度クイズ</h3>
              <p className="text-sm text-muted-foreground">
                生成されたコードについてクイズを出題。コピペで終わらせない
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Use */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              使い方
            </h2>
            <p className="mt-4 text-muted-foreground">
              4ステップで、生成されたコードを自分のものに
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="relative">
              <div className="size-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-bold text-foreground text-center mb-2">
                やりたいことを書く
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                「〜したい」「〜を実装したい」など、自然な言葉で入力
              </p>
              <div className="hidden lg:block absolute top-6 left-full w-full h-0.5 bg-amber-500/30" />
            </div>

            <div className="relative">
              <div className="size-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-bold text-foreground text-center mb-2">
                コードを確認
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                AIが生成したコードを読んで、動作を理解
              </p>
              <div className="hidden lg:block absolute top-6 left-full w-full h-0.5 bg-amber-500/30" />
            </div>

            <div className="relative">
              <div className="size-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-bold text-foreground text-center mb-2">
                クイズに回答
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                理解度を確認するクイズに挑戦。間違えても大丈夫
              </p>
              <div className="hidden lg:block absolute top-6 left-full w-full h-0.5 bg-amber-500/30" />
            </div>

            <div>
              <div className="size-12 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-bold text-foreground text-center mb-2">
                自分のコードに
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                理解した上でコードを使用。応用も効くように
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 sm:py-28">
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
                  <div className="size-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">speed</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">よくあるパターンを素早く</h3>
                    <p className="text-sm text-muted-foreground">
                      フォームバリデーション、API呼び出し、状態管理など、
                      定番のパターンをサッと生成できます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">lightbulb</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">書き方が分からない時</h3>
                    <p className="text-sm text-muted-foreground">
                      やりたいことは分かるけど、どう書けばいいか分からない。
                      そんな時に最適なコードを提案します。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">school</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">新しい技術を学ぶ時</h3>
                    <p className="text-sm text-muted-foreground">
                      初めて使うライブラリやフレームワークでも、
                      まずはコードを生成して動きを理解できます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">work_history</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">プロトタイピング</h3>
                    <p className="text-sm text-muted-foreground">
                      まずは動くものを作りたい時に。
                      クイズで理解を深めながら、実装を進められます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            生成して、理解して、使いこなす
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            14日間無料で、生成モードを体験できます。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-base px-10 h-14" asChild>
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
            <Link href="/features/brainstorm" className="group">
              <Card className="border-border/50 hover:border-violet-500/30 transition-colors">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl">lightbulb</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground group-hover:text-violet-400 transition-colors">
                      壁打ちモード
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      設計やアイデアを一緒に考える
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
