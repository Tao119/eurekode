"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "./Logo";
import { CreditCounter } from "@/components/common/CreditCounter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  guestOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", icon: "home", guestOnly: true },
  { href: "/projects", label: "プロジェクト", icon: "folder_open" },
  { href: "/history", label: "学習履歴", icon: "history" },
  { href: "/dashboard", label: "ダッシュボード", icon: "insights" },
  { href: "/admin", label: "管理", icon: "admin_panel_settings", adminOnly: true },
];

export function Header() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isLoading = status === "loading";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const credits = useCredits();

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    // Hide admin-only items for non-admins
    if (item.adminOnly && session?.user.userType !== "admin") return false;
    // Hide guest-only items for logged-in users
    if (item.guestOnly && session) return false;
    return true;
  });

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4">
          {/* Left: Menu Button (Mobile) + Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile Menu Button */}
            {session && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-3 -ml-3 rounded-lg hover:bg-muted transition-colors"
                aria-label={mobileMenuOpen ? "メニューを閉じる" : "メニューを開く"}
                aria-expanded={mobileMenuOpen}
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  {mobileMenuOpen ? "close" : "menu"}
                </span>
              </button>
            )}

            {/* Logo - dashboard for logged in users, LP for guests */}
            <Logo size="sm" href={session ? "/dashboard" : "/"} />
          </div>

          {/* Center: Navigation (Desktop) */}
          {session && (
            <nav className="hidden md:flex items-center gap-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    item.adminOnly && "text-orange-400 hover:text-orange-300"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            ) : session ? (
              <>
                {/* Credit Counter (Desktop only) */}
                <div className="hidden lg:block">
                  <CreditCounter size="sm" />
                </div>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-1 rounded-full border border-border p-1.5 hover:bg-muted transition-colors"
                      aria-label="ユーザーメニュー"
                    >
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {session.user.displayName?.charAt(0) || "U"}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-muted-foreground text-[16px] mr-0.5" aria-hidden="true">
                        expand_more
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">
                        {session.user.displayName}
                      </p>
                      {session.user.email && (
                        <p className="text-xs text-muted-foreground">
                          {session.user.email}
                        </p>
                      )}
                      {credits.isOrganizationMember && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">corporate_fare</span>
                          組織メンバー
                        </p>
                      )}
                      {/* プラン表示 - メンバーには非表示 */}
                      {!credits.isOrganizationMember && (
                        <Link
                          href="/settings/billing"
                          className="text-xs text-primary hover:underline mt-1 inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">arrow_circle_up</span>
                          {session.user.plan.toUpperCase()} プラン
                        </Link>
                      )}
                    </div>
                    <DropdownMenuSeparator />

                    {/* Mobile-only: Credit Counter */}
                    <div className="lg:hidden px-2 py-2 border-b border-border mb-1">
                      <CreditCounter size="sm" showLink={false} />
                    </div>

                    {/* プラン・請求 - メンバーには非表示 */}
                    {!credits.isOrganizationMember && (
                      <DropdownMenuItem asChild>
                        <Link href="/settings/billing" className="cursor-pointer">
                          <span className="material-symbols-outlined mr-2 text-[18px]">
                            credit_card
                          </span>
                          プラン・請求
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer">
                        <span className="material-symbols-outlined mr-2 text-[18px]">
                          settings
                        </span>
                        設定
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive cursor-pointer"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      <span className="material-symbols-outlined mr-2 text-[18px]">
                        logout
                      </span>
                      ログアウト
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/pricing">料金</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">ログイン</Link>
                </Button>
                <Button size="sm" asChild className="text-xs sm:text-sm">
                  <Link href="/register">
                    <span className="hidden sm:inline">無料で始める</span>
                    <span className="sm:hidden">始める</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {session && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden",
              mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={closeMobileMenu}
          />

          {/* Drawer */}
          <div
            className={cn(
              "fixed top-14 left-0 bottom-0 z-40 w-72 bg-background border-r border-border transition-transform md:hidden overflow-y-auto",
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            {/* User Info Summary */}
            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {session.user.displayName?.charAt(0) || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.user.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                </div>
              </div>
              <div className="mt-3">
                <CreditCounter size="sm" showLink={false} />
              </div>
            </div>

            {/* Navigation */}
            <nav className="p-3 space-y-1">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                メニュー
              </p>
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors active:scale-[0.98]",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    item.adminOnly && "text-orange-400 hover:text-orange-300"
                  )}
                >
                  <span className="material-symbols-outlined text-xl">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Quick Actions */}
            <div className="p-3 border-t border-border">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                クイックスタート
              </p>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Link
                  href="/chat/brainstorm"
                  onClick={closeMobileMenu}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-2xl">lightbulb</span>
                  <span className="text-xs font-medium">壁打ち</span>
                </Link>
                <Link
                  href="/chat/explanation"
                  onClick={closeMobileMenu}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-2xl">school</span>
                  <span className="text-xs font-medium">解説</span>
                </Link>
                <Link
                  href="/chat/generation"
                  onClick={closeMobileMenu}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-2xl">code</span>
                  <span className="text-xs font-medium">生成</span>
                </Link>
              </div>
            </div>

            {/* Settings & Logout */}
            <div className="p-3 border-t border-border">
              <Link
                href="/settings"
                onClick={closeMobileMenu}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-xl">settings</span>
                設定
              </Link>
              {/* プラン・請求 - メンバーには非表示 */}
              {!credits.isOrganizationMember && (
                <Link
                  href="/settings/billing"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-xl">credit_card</span>
                  プラン・請求
                </Link>
              )}
              <button
                onClick={() => {
                  closeMobileMenu();
                  signOut({ callbackUrl: "/" });
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-all"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
                ログアウト
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
