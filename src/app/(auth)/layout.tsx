import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - same as LP/main layout */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-14">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
