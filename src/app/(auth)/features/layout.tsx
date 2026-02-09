import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg text-primary-foreground">
                  psychology
                </span>
              </div>
              <span className="font-bold text-foreground">Eurecode</span>
            </Link>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">ログイン</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">無料で始める</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/20 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-primary-foreground">
                  psychology
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                © 2025 Eurecode. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
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
          </div>
        </div>
      </footer>
    </div>
  );
}
