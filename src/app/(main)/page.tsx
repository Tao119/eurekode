import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-24 bg-gradient-to-b from-sky-950/50 to-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              「わからない」が、
              <br />
              <span className="text-sky-400">わかる</span>に変わる瞬間。
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              あなたが<span className="font-medium text-foreground">「自分で解けた！」</span>と思える体験を、AIがつくる。
              <br className="hidden sm:block" />
              <span className="text-muted-foreground/80">答えではなく、考える力を。</span>
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-sky-600 hover:bg-sky-500 text-white text-base px-8 h-12" asChild>
                <Link href="/register">まずは無料で試してみる</Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-sky-400">check_circle</span>
                クレカ登録不要
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-sky-400">check_circle</span>
                14日間無料
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Demo Section */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-8 sm:mb-12">
            一般的なAIチャットと、Eurecodeの違い
          </h2>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Before: Regular AI */}
            <Card className="border-border bg-muted/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/50">
                <span className="text-sm font-medium text-muted-foreground">一般的なAIチャット</span>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold">
                    U
                  </div>
                  <div className="flex-1 text-sm text-foreground">
                    forループの書き方がわかりません
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">smart_toy</span>
                  </div>
                  <div className="flex-1 text-sm space-y-2">
                    <p className="text-foreground">こう書けば動きます：</p>
                    <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`for (let i = 0; i < 5; i++) {
  console.log(i);
}`}
                    </pre>
                  </div>
                </div>
                <div className="text-center py-2">
                  <span className="text-xs text-muted-foreground/60">↓ コピペ ↓</span>
                </div>
                <div className="text-center text-sm text-muted-foreground italic">
                  動いた！...でも、なんで動くの？
                </div>
              </CardContent>
            </Card>

            {/* After: Eurecode */}
            <Card className="border-sky-500/30 bg-sky-950/20 overflow-hidden ring-2 ring-sky-500/30">
              <div className="px-4 py-3 border-b border-sky-500/30 bg-sky-950/30">
                <span className="text-sm font-medium text-sky-400">Eurecode</span>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold">
                    U
                  </div>
                  <div className="flex-1 text-sm text-foreground">
                    forループの書き方がわかりません
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-sky-600 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                  </div>
                  <div className="flex-1 text-sm space-y-3">
                    <p className="text-foreground">
                      forループは「同じ処理を繰り返す」ときに使います。
                    </p>
                    <p className="text-muted-foreground">
                      たとえば、1から5まで数を表示したいとき、どう書けばいいと思いますか？
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs text-sky-400 bg-sky-500/10 px-3 py-1.5 rounded-full">
                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                      ヒント: 「いくつから」「いくつまで」を考えてみて
                    </div>
                  </div>
                </div>
                {/* User's "Aha!" moment */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold">
                    U
                  </div>
                  <div className="flex-1 text-sm text-foreground">
                    あ、i が 0 から始まって 5 より小さい間、繰り返すってことか！
                  </div>
                </div>
                <div className="text-center text-sm text-sky-400 font-medium bg-sky-500/10 py-2 rounded-lg">
                  💡 自分で気づけた！→ 次は書ける！
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Feature: Explanation Mode */}
      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-sky-400 bg-sky-500/10 px-3 py-1 rounded-full mb-4">
              <span className="material-symbols-outlined text-lg">star</span>
              初心者におすすめ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              まずは「解説モード」から
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              わからないコードを貼り付けるだけ。
              AIが一緒に読み解きながら、あなたの理解をサポートします。
            </p>
          </div>

          <Card className="border-sky-500/30 bg-card overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">menu_book</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">解説モード</h3>
                  <p className="text-muted-foreground text-sm">コードの「なぜ？」を理解する</p>
                </div>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sky-400 mt-0.5">check_circle</span>
                  <span className="text-foreground">わからないコードを貼るだけでOK</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sky-400 mt-0.5">check_circle</span>
                  <span className="text-foreground">AIが「ここは何をしてると思う？」と問いかけてくれる</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sky-400 mt-0.5">check_circle</span>
                  <span className="text-foreground">
                    理解できたことは「気づきカード」として自動で記録
                    <span className="text-muted-foreground text-xs ml-1">（後から振り返れる）</span>
                  </span>
                </li>
              </ul>

              <div className="mt-6">
                <Button className="bg-sky-600 hover:bg-sky-500 text-white" asChild>
                  <Link href="/features/explanation">
                    詳しく見る
                    <span className="material-symbols-outlined ml-1 text-lg">arrow_forward</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Other modes with descriptions */}
          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-4 text-center">慣れてきたら、こちらのモードも</p>
            <div className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              <Link href="/features/generation" className="group flex items-start gap-3 p-3 rounded-lg hover:bg-card transition-colors">
                <span className="size-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">bolt</span>
                </span>
                <div>
                  <span className="font-medium text-foreground group-hover:text-amber-400 transition-colors">生成モード</span>
                  <p className="text-xs text-muted-foreground">やりたいことを伝えてコード生成</p>
                </div>
              </Link>
              <Link href="/features/brainstorm" className="group flex items-start gap-3 p-3 rounded-lg hover:bg-card transition-colors">
                <span className="size-10 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined">lightbulb</span>
                </span>
                <div>
                  <span className="font-medium text-foreground group-hover:text-violet-400 transition-colors">壁打ちモード</span>
                  <p className="text-xs text-muted-foreground">設計やアイデアを一緒に考える</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Simple 3 steps */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-8 sm:mb-12">
            3ステップで始められます
          </h2>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="size-12 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                1
              </div>
              <h3 className="font-bold text-foreground mb-2">無料登録</h3>
              <p className="text-sm text-muted-foreground">
                メールアドレスだけ。
                <br />
                30秒で完了。
              </p>
            </div>

            <div className="text-center">
              <div className="size-12 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                2
              </div>
              <h3 className="font-bold text-foreground mb-2">わからないことを聞く</h3>
              <p className="text-sm text-muted-foreground">
                AIが答えの代わりに
                <br />
                ヒントをくれる。
              </p>
            </div>

            <div className="text-center">
              <div className="size-12 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                3
              </div>
              <h3 className="font-bold text-foreground mb-2">「わかった！」が積み上がる</h3>
              <p className="text-sm text-muted-foreground">
                気づきが記録され、
                <br />
                あなたの成長が見える。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who is this for - Persona section */}
      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-8 sm:mb-12">
            こんな人におすすめ
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-border bg-card">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-sky-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-sky-400">school</span>
                </div>
                <h3 className="font-bold text-foreground mb-2">プログラミング初心者</h3>
                <p className="text-sm text-muted-foreground">
                  独学で始めたけど、わからないことだらけ。誰かに聞きたい。
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-amber-400">content_copy</span>
                </div>
                <h3 className="font-bold text-foreground mb-2">コピペ脱却したい人</h3>
                <p className="text-sm text-muted-foreground">
                  AIでコードは書けるけど、自分では何もできない気がする。
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-violet-400">work</span>
                </div>
                <h3 className="font-bold text-foreground mb-2">転職・就活準備中</h3>
                <p className="text-sm text-muted-foreground">
                  面接でコードの説明を求められても答えられない。
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-green-400">trending_up</span>
                </div>
                <h3 className="font-bold text-foreground mb-2">もっと深く理解したい人</h3>
                <p className="text-sm text-muted-foreground">
                  動くコードは書ける。でも、もっと原理を理解したい。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ with Accordion */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-8 sm:mb-12">
            よくある質問
          </h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:no-underline">
                プログラミング完全初心者でも大丈夫？
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                はい、むしろ初心者にこそおすすめです。
                Eurecodeは「forループって何？」「変数ってどう使うの？」というレベルから対応しています。
                コピペの癖がつく前に、正しい学習習慣を身につけられます。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:no-underline">
                ChatGPTやCopilotとの違いは？
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                一般的なAIは「答え」を渡します。Eurecodeは「考え方」を渡します。
                すぐに答えを教えるのではなく、質問を投げかけ、ヒントを与えながら、
                あなた自身が答えにたどり着けるようサポートします。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:no-underline">
                無料トライアル後は自動課金される？
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                いいえ。クレジットカードの登録は不要です。
                14日間の無料期間終了後も、機能制限付きの無料プランで継続利用できます。
                有料プランへのアップグレードは任意です。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:no-underline">
                どんなプログラミング言語に対応している？
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                JavaScript、Python、Java、C、HTML/CSSなど、主要なプログラミング言語に対応しています。
                初心者の方は、まずHTML/CSSやJavaScriptから始めることをおすすめします。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="border-border">
              <AccordionTrigger className="text-left text-foreground hover:no-underline">
                チームや企業で導入できますか？
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                はい。BusinessプランとEnterpriseプランでは、
                アクセスキーによるメンバー管理、利用状況の分析、専用サポートを提供しています。
                詳しくは料金プランをご覧ください。
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-sky-950/50 to-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            14日間無料。
            <br />
            あなたの「わかった！」を体験しよう。
          </h2>
          <p className="mt-4 text-muted-foreground">
            クレジットカード不要。無料プランはずっと使えます。
          </p>
          <div className="mt-8">
            <Button size="lg" className="bg-sky-600 hover:bg-sky-500 text-white text-base px-10 h-14" asChild>
              <Link href="/register">
                まずは無料で試してみる
                <span className="material-symbols-outlined ml-2">arrow_forward</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
