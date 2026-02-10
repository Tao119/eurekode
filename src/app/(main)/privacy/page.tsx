"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  const router = useRouter();
  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
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
            Eurecodeはユーザーのプライバシーを尊重し、
            個人情報の保護に努める。このプライバシーポリシーは、
            個人情報の取り扱いについて説明するものである。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">2. 収集する情報</h2>
          <p className="text-muted-foreground leading-relaxed">
            以下の情報を収集する場合がある。
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
            収集した情報は、以下の目的で利用する。
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
            以下の場合を除き、ユーザーの個人情報を第三者に提供することはない。
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
            ユーザー体験の向上とサービスの改善のために
            Cookieおよび類似の技術を使用している。ユーザーはブラウザの設定により
            Cookieの受け入れを拒否できるが、その場合、
            一部機能が利用できなくなる可能性がある。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">6. 情報の安全管理</h2>
          <p className="text-muted-foreground leading-relaxed">
            個人情報の漏洩、滅失またはき損の防止その他の個人情報の安全管理のために
            必要かつ適切な措置を講じる。データの暗号化、アクセス制限、
            定期的なセキュリティ監査を実施する。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">7. ユーザーの権利</h2>
          <p className="text-muted-foreground leading-relaxed">
            ユーザーは、保有する自己の個人情報について、以下の権利を有する。
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
            本サービスは、13歳未満を対象としていない。
            13歳未満から意図せず個人情報を収集したことが判明した場合、
            当該情報は速やかに削除する。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">9. ポリシーの変更</h2>
          <p className="text-muted-foreground leading-relaxed">
            このプライバシーポリシーは、法令の変更やサービスの変更に伴い、
            予告なく変更されることがある。変更後のプライバシーポリシーは、
            本ページに掲載した時点から効力を生じる。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">10. お問い合わせ</h2>
          <p className="text-muted-foreground leading-relaxed">
            このプライバシーポリシーに関するお問い合わせは、
            ヘルプページより連絡を。
          </p>
        </section>

        <div className="pt-6 border-t border-border">
          <button
            onClick={() => router.back()}
            className="text-primary hover:underline text-sm"
          >
            ← 戻る
          </button>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
