import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "特定商取引法に基づく表記 | Eurecode",
};

export default function LegalPage() {
  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">特定商取引法に基づく表記</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground w-1/3">
                  販売事業者
                </th>
                <td className="py-4">
                  Eurecode（個人事業）
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  運営責任者
                </th>
                <td className="py-4">
                  松村 太緒
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  所在地
                </th>
                <td className="py-4">
                  請求があった場合は遅滞なく開示いたします
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  電話番号
                </th>
                <td className="py-4">
                  請求があった場合は遅滞なく開示いたします
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  メールアドレス
                </th>
                <td className="py-4">
                  support@eurecode.jp
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  販売価格
                </th>
                <td className="py-4">
                  各プランの料金ページに表示された金額（税込）
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  支払方法
                </th>
                <td className="py-4">
                  クレジットカード決済（Stripe経由）
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  支払時期
                </th>
                <td className="py-4">
                  月額プラン：毎月の契約更新日に自動決済
                  <br />
                  年額プラン：契約開始日に一括決済
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  サービス提供時期
                </th>
                <td className="py-4">
                  決済完了後、即時利用可能
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  返品・キャンセル
                </th>
                <td className="py-4">
                  デジタルサービスの性質上、決済完了後の返金はお受けしておりません。
                  <br />
                  サブスクリプションはいつでも解約可能です（次回更新日以降は課金されません）。
                </td>
              </tr>
              <tr>
                <th className="py-4 pr-4 text-left font-medium text-muted-foreground">
                  動作環境
                </th>
                <td className="py-4">
                  最新版のChrome、Firefox、Safari、Edgeを推奨
                  <br />
                  インターネット接続が必要です
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>最終更新日: 2025年2月</p>
        </div>
      </CardContent>
    </Card>
  );
}
