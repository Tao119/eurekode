import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">プライバシーポリシー</CardTitle>
        <p className="text-sm text-muted-foreground">
          最終更新日: 2026年1月1日
        </p>
      </CardHeader>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">1. はじめに</h2>
          <p className="text-muted-foreground leading-relaxed">
            Eurecode（以下「本サービス」）は、ユーザーのプライバシーを尊重し、
            個人情報の保護に努めます。本プライバシーポリシーは、本サービスにおける
            個人情報の取り扱いについて説明するものです。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. 収集する情報</h2>
          <p className="text-muted-foreground leading-relaxed">
            本サービスでは、以下の情報を収集する場合があります。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>アカウント情報（メールアドレス、表示名、パスワード）</li>
            <li>プロフィール情報（組織名など、ユーザーが任意で提供する情報）</li>
            <li>利用状況データ（学習履歴、チャット履歴、アクセスログ）</li>
            <li>デバイス情報（ブラウザの種類、IPアドレス、OSの種類）</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">3. 情報の利用目的</h2>
          <p className="text-muted-foreground leading-relaxed">
            収集した情報は、以下の目的で利用します。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>本サービスの提供・運営のため</li>
            <li>ユーザーからのお問い合わせに対応するため</li>
            <li>本サービスの改善・新機能の開発のため</li>
            <li>利用規約に違反した行為への対応のため</li>
            <li>本サービスに関するお知らせを送信するため</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">4. 情報の第三者提供</h2>
          <p className="text-muted-foreground leading-relaxed">
            当社は、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>ユーザーの同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命、身体または財産の保護のために必要がある場合</li>
            <li>合併、会社分割、事業譲渡その他の事由による事業の承継に伴う場合</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">5. Cookieの使用</h2>
          <p className="text-muted-foreground leading-relaxed">
            本サービスでは、ユーザー体験の向上とサービスの改善のために
            Cookieおよび類似の技術を使用しています。ユーザーはブラウザの設定により
            Cookieの受け入れを拒否することができますが、その場合、本サービスの
            一部機能が利用できなくなる可能性があります。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. 情報の安全管理</h2>
          <p className="text-muted-foreground leading-relaxed">
            当社は、個人情報の漏洩、滅失またはき損の防止その他の個人情報の安全管理のために
            必要かつ適切な措置を講じます。これには、データの暗号化、アクセス制限、
            定期的なセキュリティ監査が含まれます。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. ユーザーの権利</h2>
          <p className="text-muted-foreground leading-relaxed">
            ユーザーは、当社が保有する自己の個人情報について、以下の権利を有します。
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
            <li>個人情報の開示を請求する権利</li>
            <li>個人情報の訂正・追加・削除を請求する権利</li>
            <li>個人情報の利用停止を請求する権利</li>
            <li>アカウントの削除を請求する権利</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">8. お子様のプライバシー</h2>
          <p className="text-muted-foreground leading-relaxed">
            本サービスは、13歳未満のお子様を対象としておりません。
            13歳未満のお子様から意図せず個人情報を収集したことが判明した場合、
            当該情報は速やかに削除します。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">9. ポリシーの変更</h2>
          <p className="text-muted-foreground leading-relaxed">
            本プライバシーポリシーは、法令の変更や本サービスの変更に伴い、
            予告なく変更されることがあります。変更後のプライバシーポリシーは、
            本ページに掲載した時点から効力を生じるものとします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">10. お問い合わせ</h2>
          <p className="text-muted-foreground leading-relaxed">
            本プライバシーポリシーに関するお問い合わせは、
            本サービスのヘルプページよりご連絡ください。
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
