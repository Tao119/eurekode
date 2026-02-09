import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "解説モード | Eurecode",
  description: "コードの仕組みを理解する。AIがあなたの「なぜ？」に答え、考える力を育てます。",
};

export default function ExplanationFeaturePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-background to-background" />
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400 mb-6">
                <span className="material-symbols-outlined text-lg">menu_book</span>
                解説モード
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                コードの「なぜ」を
                <br />
                理解する
              </h1>

              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                分からないコードを貼り付けるだけで、AIがその仕組みを丁寧に解説。
                ただ答えを教えるのではなく、あなたが自分で理解できるようサポートします。
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-blue-500 hover:bg-blue-600" asChild>
                  <Link href="/register">無料で試してみる</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/#features">他のモードを見る</Link>
                </Button>
              </div>
            </div>

            {/* Hero Mockup */}
            <div className="relative">
              <Card className="shadow-2xl border-blue-500/20 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                  <span className="ml-auto text-xs text-muted-foreground">解説モード</span>
                </div>
                <CardContent className="p-6 bg-card/80">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="size-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                        U
                      </div>
                      <div className="flex-1 p-3 bg-muted/50 rounded-lg text-sm">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          array.reduce((acc, cur) =&gt; acc + cur, 0)
                        </code>
                        <p className="mt-2 text-muted-foreground">
                          このコードが何をしているか教えてください
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">psychology</span>
                      </div>
                      <div className="flex-1 p-3 bg-blue-500/5 rounded-lg text-sm border border-blue-500/20">
                        <p className="font-medium text-foreground mb-2">
                          一緒に読み解いていきましょう。
                        </p>
                        <p className="text-muted-foreground text-xs">
                          <code className="bg-muted px-1 rounded">reduce</code>は配列の要素を1つの値にまとめるメソッドです。
                          <code className="bg-muted px-1 rounded">acc</code>（accumulator）と<code className="bg-muted px-1 rounded">cur</code>（current）はそれぞれ何を表していると思いますか？
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

      {/* Features */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              解説モードでできること
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="size-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">code</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">コード解説</h3>
              <p className="text-sm text-muted-foreground">
                貼り付けたコードの動作を、ステップバイステップで解説します
              </p>
            </div>

            <div className="text-center">
              <div className="size-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">help</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">質問で深掘り</h3>
              <p className="text-sm text-muted-foreground">
                答えを教えるのではなく、質問を投げかけて理解を促します
              </p>
            </div>

            <div className="text-center">
              <div className="size-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-2xl">auto_stories</span>
              </div>
              <h3 className="font-bold text-foreground mb-2">気づきカード</h3>
              <p className="text-sm text-muted-foreground">
                学んだことを「気づきカード」として記録し、振り返れます
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Use */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              使い方
            </h2>
            <p className="mt-4 text-muted-foreground">
              3ステップで、コードの理解を深められます
            </p>
          </div>

          <div className="space-y-16">
            {/* Step 1 */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    コードを貼り付ける
                  </h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  理解したいコードをそのまま貼り付けるだけ。
                  どんなプログラミング言語でも対応しています。
                  「このコードは何をしている？」「なぜこう書くの？」など、
                  自由に質問してください。
                </p>
              </div>
              <div className="order-1 lg:order-2">
                <Card className="border-border/50 overflow-hidden">
                  <CardContent className="p-6 bg-muted/30">
                    <div className="bg-card rounded-lg p-4 border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        コードを入力
                      </div>
                      <pre className="text-sm font-mono text-foreground overflow-x-auto">
{`const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};`}
                      </pre>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <div className="flex-1 bg-card rounded-lg p-3 border border-border">
                        <p className="text-sm text-muted-foreground">
                          このdebounce関数の仕組みを教えてください
                        </p>
                      </div>
                      <Button size="sm" className="bg-blue-500">
                        <span className="material-symbols-outlined text-sm">send</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Step 2 */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <Card className="border-border/50 overflow-hidden">
                  <CardContent className="p-6 bg-muted/30">
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="size-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                          <span className="material-symbols-outlined text-sm">psychology</span>
                        </div>
                        <div className="flex-1 p-3 bg-blue-500/5 rounded-lg text-sm border border-blue-500/20">
                          <p className="text-foreground mb-3">
                            一緒にdebounceの動きを追ってみましょう。
                          </p>
                          <p className="text-muted-foreground text-xs mb-3">
                            まず、<code className="bg-muted px-1 rounded">timeoutId</code>という変数がありますね。
                            この変数は関数の外で定義されていますが、なぜだと思いますか？
                          </p>
                          <div className="inline-flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full">
                            <span className="material-symbols-outlined text-sm">lightbulb</span>
                            ヒント: クロージャについて考えてみてください
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    AIと対話しながら理解を深める
                  </h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  AIは答えをすぐに教えません。
                  質問を投げかけ、ヒントを与えながら、
                  あなた自身が理解にたどり着けるようサポートします。
                  「分かった！」という瞬間を大切にしています。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    学びを記録する
                  </h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  対話の中で得た気づきは「気づきカード」として保存できます。
                  後から振り返ることで、知識が定着し、
                  同じことで悩むことが減っていきます。
                </p>
              </div>
              <div className="order-1 lg:order-2">
                <Card className="border-border/50 overflow-hidden">
                  <CardContent className="p-6 bg-muted/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                      <span className="material-symbols-outlined text-sm text-blue-400">bookmark</span>
                      気づきカード
                    </div>
                    <div className="space-y-3">
                      <div className="p-3 bg-card rounded-lg border border-blue-500/20">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-blue-400 text-sm mt-0.5">lightbulb</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              クロージャで状態を保持する
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              debounceは内部関数が外部変数を参照することで、呼び出し間で状態を保持している
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-card rounded-lg border border-border">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-blue-400 text-sm mt-0.5">lightbulb</span>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              clearTimeoutでキャンセル
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              新しい呼び出しが来たら前のタイマーをキャンセルすることで、最後の呼び出しだけが実行される
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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
                  <div className="size-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">school</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">プログラミング学習中</h3>
                    <p className="text-sm text-muted-foreground">
                      教材のサンプルコードが理解できない時、AIが丁寧に解説してくれます。
                      一人で悩む時間を減らせます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">work</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">業務でレガシーコードを読む時</h3>
                    <p className="text-sm text-muted-foreground">
                      前任者が書いた複雑なコードも、AIと一緒に読み解けます。
                      ドキュメントがなくても大丈夫。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">bug_report</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">バグの原因を探る時</h3>
                    <p className="text-sm text-muted-foreground">
                      エラーが出ているコードを貼り付けて、
                      なぜそのエラーが起きているのかを一緒に考えられます。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">diversity_3</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-2">コードレビューの準備</h3>
                    <p className="text-sm text-muted-foreground">
                      レビュー対象のコードを事前に理解しておくことで、
                      より建設的なフィードバックができます。
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
          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            コードを理解する力を、身につけよう
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            14日間無料で、解説モードを体験できます。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-base px-10 h-14" asChild>
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
