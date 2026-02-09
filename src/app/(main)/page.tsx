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
    // Force light theme for LP only
    <div className="flex flex-col [&_*]:!text-slate-900 bg-white [&_.text-muted-foreground]:!text-slate-600 [&_.text-foreground]:!text-slate-900 [&_.border-border]:!border-slate-200 [&_.bg-muted]:!bg-slate-100 [&_.bg-card]:!bg-white [&_.bg-background]:!bg-white">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-24 bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Main Headline - Empathetic, beginner-focused */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              「わからない」が、
              <br />
              <span className="text-sky-600">わかる</span>に変わる瞬間。
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Eurecodeは答えを渡しません。
              <br className="hidden sm:block" />
              あなたが<span className="font-medium text-slate-800">「自分で解けた！」</span>と思える体験を、AIがつくります。
            </p>

            {/* CTA */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="!bg-sky-600 hover:!bg-sky-700 !text-white text-base px-8 h-12" asChild>
                <Link href="/register">まずは無料で試してみる</Link>
              </Button>
            </div>

            {/* Trust indicators */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-sky-600">check_circle</span>
                クレカ登録不要
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-sky-600">check_circle</span>
                14日間無料
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Before/After Demo Section */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-8 sm:mb-12">
            ふつうのAIと、Eurecodeの違い
          </h2>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {/* Before: Regular AI */}
            <Card className="!border-slate-200 !bg-slate-50 overflow-hidden">
              <div className="px-4 py-3 border-b !border-slate-200 !bg-slate-100">
                <span className="text-sm font-medium text-slate-500">ふつうのAI</span>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                    U
                  </div>
                  <div className="flex-1 text-sm text-slate-700">
                    forループの書き方がわかりません
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">smart_toy</span>
                  </div>
                  <div className="flex-1 text-sm space-y-2">
                    <p className="text-slate-700">こう書けば動きます：</p>
                    <pre className="text-xs bg-slate-800 text-slate-100 p-3 rounded overflow-x-auto">
{`for (let i = 0; i < 5; i++) {
  console.log(i);
}`}
                    </pre>
                  </div>
                </div>
                <div className="text-center py-2">
                  <span className="text-xs text-slate-400">↓ コピペ ↓</span>
                </div>
                <div className="text-center text-sm text-slate-500 italic">
                  動いた！...でも、なんで動くの？
                </div>
              </CardContent>
            </Card>

            {/* After: Eurecode */}
            <Card className="!border-sky-200 !bg-sky-50 overflow-hidden ring-2 ring-sky-200">
              <div className="px-4 py-3 border-b !border-sky-200 !bg-sky-100">
                <span className="text-sm font-medium text-sky-700">Eurecode</span>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-sky-200 text-sky-700 flex items-center justify-center text-xs font-bold">
                    U
                  </div>
                  <div className="flex-1 text-sm text-slate-700">
                    forループの書き方がわかりません
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 size-8 rounded-full bg-sky-600 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                  </div>
                  <div className="flex-1 text-sm space-y-3">
                    <p className="text-slate-700">
                      forループは「同じ処理を繰り返す」ときに使います。
                    </p>
                    <p className="text-slate-600">
                      たとえば、1から5まで数を表示したいとき、どう書けばいいと思いますか？
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs text-sky-700 bg-sky-100 px-3 py-1.5 rounded-full">
                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                      ヒント: 「いくつから」「いくつまで」を考えてみて
                    </div>
                  </div>
                </div>
                <div className="text-center text-sm text-sky-700 font-medium">
                  自分で考えて → 気づく → 次は書ける！
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Feature: Explanation Mode */}
      <section className="py-12 sm:py-20 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 bg-sky-100 px-3 py-1 rounded-full mb-4">
              <span className="material-symbols-outlined text-lg">star</span>
              初心者におすすめ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              まずは「解説モード」から
            </h2>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              わからないコードを貼り付けるだけ。
              AIが一緒に読み解きながら、あなたの理解をサポートします。
            </p>
          </div>

          <Card className="!border-sky-200 !bg-white overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="size-14 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">menu_book</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">解説モード</h3>
                  <p className="text-slate-600 text-sm">コードの「なぜ？」を理解する</p>
                </div>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sky-600 mt-0.5">check_circle</span>
                  <span className="text-slate-700">わからないコードを貼るだけでOK</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sky-600 mt-0.5">check_circle</span>
                  <span className="text-slate-700">答えを教えるのではなく、質問で理解を促す</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-sky-600 mt-0.5">check_circle</span>
                  <span className="text-slate-700">学んだことは「気づきカード」に記録</span>
                </li>
              </ul>

              <div className="mt-6">
                <Button className="!bg-sky-600 hover:!bg-sky-700 !text-white" asChild>
                  <Link href="/features/explanation">
                    詳しく見る
                    <span className="material-symbols-outlined ml-1 text-lg">arrow_forward</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Other modes */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 mb-4">慣れてきたら、こちらのモードも</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/features/generation" className="flex items-center gap-2 text-sm text-slate-600 hover:text-amber-600 transition-colors">
                <span className="size-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">bolt</span>
                </span>
                生成モード
              </Link>
              <Link href="/features/brainstorm" className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 transition-colors">
                <span className="size-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">lightbulb</span>
                </span>
                壁打ちモード
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it works - Simple 3 steps */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-8 sm:mb-12">
            3ステップで始められます
          </h2>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="size-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                1
              </div>
              <h3 className="font-bold text-slate-900 mb-2">無料登録</h3>
              <p className="text-sm text-slate-600">
                メールアドレスだけでOK。
                <br />
                クレカ不要です。
              </p>
            </div>

            <div className="text-center">
              <div className="size-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                2
              </div>
              <h3 className="font-bold text-slate-900 mb-2">質問する</h3>
              <p className="text-sm text-slate-600">
                わからないことを
                <br />
                そのまま聞くだけ。
              </p>
            </div>

            <div className="text-center">
              <div className="size-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
                3
              </div>
              <h3 className="font-bold text-slate-900 mb-2">考えて解く</h3>
              <p className="text-sm text-slate-600">
                AIのヒントを頼りに、
                <br />
                自分で答えにたどり着く。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who is this for - Persona section */}
      <section className="py-12 sm:py-20 bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-8 sm:mb-12">
            こんな人におすすめ
          </h2>

          <div className="grid sm:grid-cols-3 gap-6">
            <Card className="!border-slate-200 !bg-white">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-sky-100 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-sky-600">school</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">プログラミング初心者</h3>
                <p className="text-sm text-slate-600">
                  独学で始めたけど、わからないことだらけ。誰かに聞きたいけど、聞ける人がいない。
                </p>
              </CardContent>
            </Card>

            <Card className="!border-slate-200 !bg-white">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-amber-600">content_copy</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">コピペ脱却したい人</h3>
                <p className="text-sm text-slate-600">
                  ChatGPTでコードは書けるけど、自分では何もできない気がする。ちゃんと理解したい。
                </p>
              </CardContent>
            </Card>

            <Card className="!border-slate-200 !bg-white">
              <CardContent className="p-6 text-center">
                <div className="size-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-violet-600">work</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-2">転職・就活準備中</h3>
                <p className="text-sm text-slate-600">
                  面接でコードの説明を求められても答えられない。理解した上で書けるようになりたい。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ with Accordion */}
      <section className="py-12 sm:py-20 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-8 sm:mb-12">
            よくある質問
          </h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="!border-slate-200">
              <AccordionTrigger className="text-left text-slate-900 hover:no-underline">
                プログラミング完全初心者でも大丈夫？
              </AccordionTrigger>
              <AccordionContent className="text-slate-600">
                はい、むしろ初心者にこそおすすめです。
                Eurecodeは「forループって何？」「変数ってどう使うの？」というレベルから対応しています。
                コピペの癖がつく前に、正しい学習習慣を身につけられます。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="!border-slate-200">
              <AccordionTrigger className="text-left text-slate-900 hover:no-underline">
                ChatGPTやCopilotとの違いは？
              </AccordionTrigger>
              <AccordionContent className="text-slate-600">
                一般的なAIは「答え」を渡します。Eurecodeは「考え方」を渡します。
                すぐに答えを教えるのではなく、質問を投げかけ、ヒントを与えながら、
                あなた自身が答えにたどり着けるようサポートします。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="!border-slate-200">
              <AccordionTrigger className="text-left text-slate-900 hover:no-underline">
                無料トライアル後は自動課金される？
              </AccordionTrigger>
              <AccordionContent className="text-slate-600">
                いいえ。クレジットカードの登録は不要です。
                14日間の無料期間終了後も、機能制限付きの無料プランで継続利用できます。
                有料プランへのアップグレードは任意です。
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="!border-slate-200">
              <AccordionTrigger className="text-left text-slate-900 hover:no-underline">
                どんなプログラミング言語に対応している？
              </AccordionTrigger>
              <AccordionContent className="text-slate-600">
                JavaScript、Python、Java、C、HTML/CSSなど、主要なプログラミング言語に対応しています。
                初心者の方は、まずHTML/CSSやJavaScriptから始めることをおすすめします。
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            14日間無料。
            <br />
            あなたの「わかった！」を体験しよう。
          </h2>
          <p className="mt-4 text-slate-600">
            クレジットカード不要。いつでも解約OK。
          </p>
          <div className="mt-8">
            <Button size="lg" className="!bg-sky-600 hover:!bg-sky-700 !text-white text-base px-10 h-14" asChild>
              <Link href="/register">
                まずは無料で試してみる
                <span className="material-symbols-outlined ml-2">arrow_forward</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 bg-slate-100 border-t !border-slate-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Company */}
            <div>
              <h4 className="font-bold text-slate-900 mb-4">Eurecode</h4>
              <p className="text-sm text-slate-600">
                「考える力」を育てる
                <br />
                プログラミング学習AI
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-bold text-slate-900 mb-4">プロダクト</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features/explanation" className="text-slate-600 hover:text-sky-600">解説モード</Link></li>
                <li><Link href="/features/generation" className="text-slate-600 hover:text-sky-600">生成モード</Link></li>
                <li><Link href="/features/brainstorm" className="text-slate-600 hover:text-sky-600">壁打ちモード</Link></li>
                <li><Link href="/pricing" className="text-slate-600 hover:text-sky-600">料金プラン</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold text-slate-900 mb-4">サポート</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/help" className="text-slate-600 hover:text-sky-600">ヘルプ</Link></li>
                <li><a href="mailto:support@eurecode.jp" className="text-slate-600 hover:text-sky-600">お問い合わせ</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold text-slate-900 mb-4">法的情報</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/terms" className="text-slate-600 hover:text-sky-600">利用規約</Link></li>
                <li><Link href="/privacy" className="text-slate-600 hover:text-sky-600">プライバシーポリシー</Link></li>
                <li><Link href="/legal" className="text-slate-600 hover:text-sky-600">特定商取引法に基づく表記</Link></li>
                <li><Link href="/company" className="text-slate-600 hover:text-sky-600">運営会社</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t !border-slate-200 text-center text-sm text-slate-500">
            © 2025 Eurecode. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
