import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

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
      <main className="flex-1 overflow-auto pt-14 pb-12">{children}</main>

      {/* Fixed Footer */}
      <Footer />
    </div>
  );
}
