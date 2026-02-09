import Link from "next/link";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-36">
        {/* Gradient background - Stripe inspired */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              プログラミング学習の新しいかたち
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.1]">
              コピペで
              <br className="sm:hidden" />
              終わらせない。
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AIにコードを書いてもらう時代。
              <br className="hidden sm:block" />
              でも、「自分で考えて解けた」感覚を忘れていませんか？
            </p>

            {/* CTA */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12 shadow-lg shadow-primary/20" asChild>
                <Link href="/register">無料で始める</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12" asChild>
                <Link href="/pricing">料金プランを見る</Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
                クレカ登録不要
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
                14日間無料
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
                いつでも解約OK
              </span>
            </div>
          </div>

          {/* Product Visual */}
          <div className="mt-16 sm:mt-20">
            <Card className="shadow-2xl border-border/30 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="text-xs text-muted-foreground font-mono">Eurecode</div>
                <div className="w-10" />
              </div>
              <CardContent className="p-6 sm:p-8 bg-card/50 backdrop-blur">
                <div className="space-y-6">
                  {/* User message */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 size-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/30">
                      You
                    </div>
                    <div className="flex-1 pt-2">
                      <p className="text-foreground">
                        useEffectで無限ループが起きてるんですが、なぜですか？
                      </p>
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
                      <span className="material-symbols-outlined text-lg">psychology</span>
                    </div>
                    <div className="flex-1 pt-2 space-y-3">
                      <p className="text-foreground font-medium">
                        まず、一緒に原因を探ってみましょう。
                      </p>
                      <p className="text-muted-foreground">
                        useEffectの依存配列には何を入れていますか？
                        <br />
                        もし空配列を入れていないなら、レンダーのたびにeffectが実行されているかもしれません。
                      </p>
                      <div className="inline-flex items-center gap-2 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-sm">lightbulb</span>
                        ヒント: 依存配列の値が毎回新しく生成されていませんか？
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-border/50 bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-foreground">1,200+</div>
              <div className="text-sm text-muted-foreground mt-1">アクティブユーザー</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-foreground">50,000+</div>
              <div className="text-sm text-muted-foreground mt-1">学習セッション</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-foreground">4.8</div>
              <div className="text-sm text-muted-foreground mt-1">ユーザー満足度</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-foreground">30+</div>
              <div className="text-sm text-muted-foreground mt-1">導入企業</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Problem */}
            <div>
              <span className="text-sm font-medium text-destructive/80 uppercase tracking-wider">課題</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                AIがコードを書いてくれる時代に、
                <br />
                あなたのスキルは育っていますか？
              </h2>
              <div className="mt-6 space-y-4 text-muted-foreground">
                <p>ChatGPTやCopilotにコードを書いてもらえば、今日の仕事は片付く。</p>
                <p>でも、半年後のあなたは成長しているだろうか？</p>
                <p className="text-foreground font-medium">答えをもらうだけでは、考える力は育たない。</p>
              </div>
            </div>

            {/* Solution */}
            <div>
              <span className="text-sm font-medium text-primary uppercase tracking-wider">解決策</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                Eurecodeは、答えではなく
                <br />
                「考え方」を渡します。
              </h2>
              <div className="mt-6 space-y-4 text-muted-foreground">
                <p>問題を一緒に分解し、解決への道筋を示す。</p>
                <p>あなたが自分の力でたどり着けるよう、AIがサポート。</p>
                <p className="text-foreground font-medium">「自分で解けた」という実感が、本当の力になる。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 bg-muted/30" id="features">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
              3つのモードで、あなたの学びをサポート
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              目的に合わせて最適なモードを選べます。各モードの詳細をクリックしてご覧ください。
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard mode="explanation" />
            <FeatureCard mode="generation" />
            <FeatureCard mode="brainstorm" />
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="size-16 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-3xl text-primary">format_quote</span>
          </div>
          <blockquote className="text-xl sm:text-2xl font-medium text-foreground leading-relaxed">
            「今までAIにコードを書いてもらって済ませていたけど、
            Eurecodeを使い始めてから、自分で考えて解決できるようになった。
            面接でもコードの意図を説明できるようになって、内定をもらえました。」
          </blockquote>
          <div className="mt-8">
            <div className="font-medium text-foreground">Y.S.</div>
            <div className="text-sm text-muted-foreground">Web開発者 / 26歳</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            よくある質問
          </h2>

          <div className="space-y-6">
            <div className="border-b border-border pb-6">
              <h3 className="font-medium text-foreground mb-2">
                ChatGPTやCopilotとの違いは？
              </h3>
              <p className="text-muted-foreground text-sm">
                一般的なAIは「答え」を渡します。Eurecodeは「考え方」を渡します。
                あなたが自分で答えにたどり着けるよう、質問を投げかけ、ヒントを与え、
                思考プロセスをサポートします。
              </p>
            </div>

            <div className="border-b border-border pb-6">
              <h3 className="font-medium text-foreground mb-2">
                プログラミング初心者でも使えますか？
              </h3>
              <p className="text-muted-foreground text-sm">
                はい。むしろ初心者にこそ使ってほしいサービスです。
                解説モードでは、基礎的な概念から丁寧に説明します。
                コピペの癖がつく前に、正しい学習習慣を身につけましょう。
              </p>
            </div>

            <div className="border-b border-border pb-6">
              <h3 className="font-medium text-foreground mb-2">
                無料トライアル後は自動課金されますか？
              </h3>
              <p className="text-muted-foreground text-sm">
                いいえ。クレジットカードの登録は不要です。
                14日間の無料期間終了後も、機能制限付きの無料プランで継続利用できます。
              </p>
            </div>

            <div className="pb-6">
              <h3 className="font-medium text-foreground mb-2">
                チームや企業で導入できますか？
              </h3>
              <p className="text-muted-foreground text-sm">
                はい。Businessプラン・Enterpriseプランでは、
                アクセスキーによるメンバー管理、利用状況の分析、専用サポートを提供しています。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent" />
        </div>

        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            考える力を、取り戻そう。
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            今日から、本当の意味でのプログラミング学習を始めませんか。
          </p>
          <div className="mt-10">
            <Button size="lg" className="text-base px-10 h-14 shadow-lg shadow-primary/20" asChild>
              <Link href="/register">
                無料で始める
                <span className="material-symbols-outlined ml-2">arrow_forward</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
