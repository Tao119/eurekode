import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ClientErrorHandler } from "@/components/common/ClientErrorHandler";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Fixed Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 pt-14">
        <ClientErrorHandler>{children}</ClientErrorHandler>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
