"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // チャット画面ではモバイルでフッターを非表示
  const isChatPage = pathname?.startsWith("/chat");

  if (isChatPage) {
    // チャット画面では最小限のフッターのみ表示（デスクトップのみ）
    return (
      <footer className="hidden sm:block border-t border-border bg-muted/50 py-4">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          © 2026 Eurecode. All rights reserved.
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border bg-muted/50 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company */}
          <div className="col-span-2 sm:col-span-1">
            <h4 className="font-bold text-foreground mb-4">Eurecode</h4>
            <p className="text-sm text-muted-foreground">
              「考える力」を育てる
              <br />
              プログラミング学習AI
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-foreground mb-4">プロダクト</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/features/explanation"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  解説モード
                </Link>
              </li>
              <li>
                <Link
                  href="/features/generation"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  生成モード
                </Link>
              </li>
              <li>
                <Link
                  href="/features/brainstorm"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  壁打ちモード
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  料金プラン
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold text-foreground mb-4">サポート</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/help"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  ヘルプ
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@eurecode.jp"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  お問い合わせ
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-foreground mb-4">法的情報</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  利用規約
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link
                  href="/company"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  運営会社
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          © 2026 Eurecode. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
