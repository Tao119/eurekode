"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();

  // チャット画面ではモバイルでフッターを非表示
  const isChatPage = pathname?.startsWith("/chat");

  return (
    <footer className={`fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 ${isChatPage ? "hidden sm:block sm:h-10" : "h-10 sm:h-12"}`}>
      <div className="mx-auto max-w-7xl h-full px-3 sm:px-4 flex items-center justify-between">
        {/* Links */}
        <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            プライバシー
          </Link>
          <Link href="/help" className="hover:text-foreground transition-colors">
            ヘルプ
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          © 2026 Eurecode
        </p>
      </div>
    </footer>
  );
}
