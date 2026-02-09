import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "運営会社 | Eurecode",
};

export default function CompanyPage() {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">運営会社</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">運営者情報</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                <tr>
                  <th className="py-3 pr-4 text-left font-medium text-muted-foreground w-1/3">
                    事業形態
                  </th>
                  <td className="py-3">個人事業</td>
                </tr>
                <tr>
                  <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                    屋号
                  </th>
                  <td className="py-3">Eurecode</td>
                </tr>
                <tr>
                  <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                    代表者
                  </th>
                  <td className="py-3">松村 太緒</td>
                </tr>
                <tr>
                  <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                    設立
                  </th>
                  <td className="py-3">2025年</td>
                </tr>
                <tr>
                  <th className="py-3 pr-4 text-left font-medium text-muted-foreground">
                    事業内容
                  </th>
                  <td className="py-3">
                    プログラミング学習支援サービスの企画・開発・運営
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">ミッション</h2>
          <p className="text-muted-foreground">
            「考える力を育てる」をミッションに、AIを活用したプログラミング学習支援サービスを提供しています。
            単にコードを生成するのではなく、学習者が自ら考え、理解を深められるような体験を提供することで、
            真のプログラミングスキルの習得をサポートします。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">お問い合わせ</h2>
          <p className="text-muted-foreground">
            サービスに関するお問い合わせは、以下のメールアドレスまでお願いいたします。
          </p>
          <p className="mt-2">
            <a href="mailto:support@eurecode.jp" className="text-primary hover:underline">
              support@eurecode.jp
            </a>
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
