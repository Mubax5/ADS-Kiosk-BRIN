import { LayerCard } from "@cloudflare/kumo";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { AdminLayout } from "./layouts/AdminLayout";
import { AdsPage } from "./pages/AdsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MediaPage } from "./pages/MediaPage";
import { MenuPage } from "./pages/MenuPage";
import { PreviewPage } from "./pages/PreviewPage";
import { SettingsPage } from "./pages/SettingsPage";

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-shell"><LayerCard className="login-card">Memuat CMS…</LayerCard></div>;
  if (!user) return <LoginPage />;

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
}
