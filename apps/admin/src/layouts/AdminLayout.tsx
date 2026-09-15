import { Sidebar } from "@cloudflare/kumo";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

const navigation = [
  { path: "/", label: "Dashboard" },
  { path: "/menu", label: "Menu & Konten" },
  { path: "/ads", label: "Ads" },
  { path: "/media", label: "Media" },
  { path: "/preview", label: "Preview" },
  { path: "/settings", label: "Settings" },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sidebar.Provider contained defaultOpen className="cms-shell">
      <nav aria-label="Navigasi CMS" className="cms-sidebar-nav">
        <Sidebar>
          <Sidebar.Header>
            <div className="cms-brand" aria-label="Identitas BRIN CMS">
              <span className="cms-brand-mark" aria-hidden="true">BRIN</span>
              <span className="cms-brand-copy">
                <strong>Badan Riset dan Inovasi Nasional</strong>
                <small>Kiosk CMS</small>
              </span>
            </div>
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.Menu>
                {navigation.map((item) => (
                  <Sidebar.MenuButton
                    key={item.path}
                    active={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </Sidebar.MenuButton>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Footer>
            <Sidebar.Trigger />
          </Sidebar.Footer>
        </Sidebar>
      </nav>
      <main className="cms-main">{children}</main>
    </Sidebar.Provider>
  );
}
