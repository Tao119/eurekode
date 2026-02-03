import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">利用規約</CardTitle>
        <p className="text-sm text-muted-foreground">
          最終更新日: 2026年1月1日
        </p>
      </CardHeader>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">第1条（適用）</h2>
          <p className="text-muted-foreground leading-relaxed">
            本規約は、Eurecode（以下「本サービス」）の利用に関する条件を定めるものです。
            ユーザーは本規約に同意した上で本サービスを利用するものとします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第2条（利用登録）</h2>
          <p className="text-muted-foreground leading-relaxed">
            本サービスの利用を希望する方は、本規約に同意の上、所定の方法により利用登録を行うものとします。
            利用登録の申請者に以下の事由があると判断した場合、登録を拒否することがあります。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>虚偽の事項を届け出た場合</li>
            <li>本規約に違反したことがある者からの申請である場合</li>
            <li>その他、当社が利用登録を相当でないと判断した場合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第3条（禁止事項）</h2>
          <p className="text-muted-foreground leading-relaxed">
            ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>サーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
            <li>本サービスの運営を妨害するおそれのある行為</li>
            <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
            <li>不正アクセスをし、またはこれを試みる行為</li>
            <li>他のユーザーに成りすます行為</li>
            <li>本サービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第4条（本サービスの提供の停止等）</h2>
          <p className="text-muted-foreground leading-relaxed">
            当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく
            本サービスの全部または一部の提供を停止または中断することができるものとします。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
            <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
            <li>コンピュータまたは通信回線等が事故により停止した場合</li>
            <li>その他、当社が本サービスの提供が困難と判断した場合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第5条（知的財産権）</h2>
          <p className="text-muted-foreground leading-relaxed">
            本サービスにおいて提供されるコンテンツ（テキスト、画像、動画、プログラム等）に関する
            知的財産権は、当社または正当な権利を有する第三者に帰属します。
            ユーザーは、これらを当社の許可なく複製、転載、改変、販売等することはできません。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第6条（免責事項）</h2>
          <p className="text-muted-foreground leading-relaxed">
            当社は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた
            取引、連絡または紛争等について一切責任を負いません。
            本サービスで提供される情報の正確性、完全性、有用性等について保証するものではありません。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第7条（規約の変更）</h2>
          <p className="text-muted-foreground leading-relaxed">
            当社は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。
            変更後の利用規約は、当社ウェブサイトに掲載したときから効力を生じるものとします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">第8条（準拠法・裁判管轄）</h2>
          <p className="text-muted-foreground leading-relaxed">
            本規約の解釈にあたっては、日本法を準拠法とします。
            本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <div className="pt-6 border-t border-border">
          <Link href="/login" className="text-primary hover:underline text-sm">
            ← ログインページに戻る
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
