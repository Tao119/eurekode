import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClientErrorHandler } from "@/components/common/ClientErrorHandler";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Fixed Header */}
      <Header />

      {/* Main Content (with padding for fixed header/footer) */}
      {/* pb-0 on mobile for chat pages (footer hidden), pb-10 on desktop */}
      <main className="flex-1 overflow-auto pt-14 pb-0 sm:pb-10">
        <ClientErrorHandler>{children}</ClientErrorHandler>
      </main>

      {/* Fixed Footer */}
      <Footer />
    </div>
  );
}
