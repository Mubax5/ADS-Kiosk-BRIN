import { LayerCard } from "@cloudflare/kumo";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { AdminLayout } from "./layouts/AdminLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="cms-page">
      <header className="cms-page-header"><h1 className="cms-page-title">{title}</h1></header>
      <LayerCard className="cms-metric"><p>Bagian ini akan dilengkapi pada tahap CMS berikutnya.</p></LayerCard>
    </section>
  );
}

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-shell"><LayerCard className="login-card">Memuat CMS…</LayerCard></div>;
  if (!user) return <LoginPage />;

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/menu" element={<PlaceholderPage title="Menu & Konten" />} />
        <Route path="/ads" element={<PlaceholderPage title="Ads" />} />
        <Route path="/media" element={<PlaceholderPage title="Media" />} />
        <Route path="/preview" element={<PlaceholderPage title="Preview" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
}
