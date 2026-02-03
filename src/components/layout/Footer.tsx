"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-12 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto max-w-7xl h-full px-4 flex items-center justify-between">
        {/* Links */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors hidden sm:inline">
            プライバシー
          </Link>
          <Link href="/help" className="hover:text-foreground transition-colors">
            ヘルプ
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground">
          © 2026 Eurekode
        </p>
      </div>
    </footer>
  );
}
