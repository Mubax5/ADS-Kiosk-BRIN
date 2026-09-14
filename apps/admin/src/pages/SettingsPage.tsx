import type { CmsRole } from "@ads-kiosk/shared";
import { Badge, Button, Input, LayerCard, Select, Switch, Table } from "@cloudflare/kumo";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

type Settings = { sessionTimeoutSeconds: number; sessionWarningSeconds: 10; deviceDisplayName: string };
type UserSummary = { id: string; username: string; role: CmsRole; canPublish: boolean; active: boolean };
type Dashboard = { kiosk: null | { online: boolean; lastSeen: string | null; activeVersion: number | null }; mediaBytes: number };

export function SettingsPage() {
  const { user, csrfToken } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<CmsRole>("editor");
  const isAdmin = user?.role === "admin";

  const refresh = useCallback(async () => {
    const [nextSettings, nextDashboard] = await Promise.all([
      apiClient.get<Settings>("/api/v1/admin/settings"),
      apiClient.get<Dashboard>("/api/v1/admin/dashboard"),
    ]);
    setSettings(nextSettings);
    setDashboard(nextDashboard);
    if (isAdmin) {
      const result = await apiClient.get<{ items: UserSummary[] }>("/api/v1/admin/users");
      setUsers(result.items);
    }
  }, [isAdmin]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const next = await apiClient.put<Settings>("/api/v1/admin/settings", settings, csrfToken);
    setSettings(next);
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await apiClient.post("/api/v1/admin/users", { username: newUsername, password: newPassword, role: newRole, canPublish: false }, csrfToken);
    setNewUsername(""); setNewPassword(""); setNewRole("editor");
    await refresh();
  }

  async function patchUser(id: string, input: Partial<UserSummary>) {
    await apiClient.patch(`/api/v1/admin/users/${id}`, input, csrfToken);
    await refresh();
  }

  return (
    <section className="cms-page">
      <header className="cms-page-header"><div><h1 className="cms-page-title">Settings</h1><p className="cms-page-description">Pengaturan sesi, status perangkat, dan akun CMS.</p></div></header>
      <div className="cms-stack">
        {settings ? (
          <LayerCard className="cms-editor-card">
            <h2>Pengaturan Kiosk</h2>
            <form className="cms-form" onSubmit={saveSettings}>
              <div className="cms-form-grid">
                <Input label="Nama perangkat" value={settings.deviceDisplayName} onChange={(e) => setSettings({ ...settings, deviceDisplayName: e.target.value })} />
                <Input label="Timeout sesi (detik)" type="number" min={30} max={900} value={settings.sessionTimeoutSeconds} onChange={(e) => setSettings({ ...settings, sessionTimeoutSeconds: Number(e.target.value) })} />
              </div>
              <p>Peringatan akhir sesi: 10 detik.</p>
              {isAdmin ? <div className="cms-actions"><Button type="submit" variant="primary">Simpan Settings</Button></div> : null}
            </form>
          </LayerCard>
        ) : null}

        <LayerCard className="cms-editor-card">
          <h2>Status Kiosk</h2>
          <div className="cms-status-row">
            <Badge>{dashboard?.kiosk?.online ? "Online" : "Offline"}</Badge>
            <span>Versi aktif: {dashboard?.kiosk?.activeVersion ? `v${dashboard.kiosk.activeVersion}` : "Belum ada"}</span>
            <span>Terakhir terlihat: {dashboard?.kiosk?.lastSeen ? new Date(dashboard.kiosk.lastSeen).toLocaleString("id-ID") : "Belum ada"}</span>
          </div>
        </LayerCard>

        {isAdmin ? (
          <LayerCard className="cms-editor-card">
            <h2>Pengguna CMS</h2>
            <form className="cms-form-grid cms-user-create" onSubmit={createUser}>
              <Input label="Username baru" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required />
              <Input label="Password sementara" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              <Select label="Role" value={newRole} onValueChange={(role) => role && setNewRole(role as CmsRole)} items={{ editor: "Editor", admin: "Admin" }} />
              <div className="cms-actions"><Button type="submit" variant="primary">Tambah Pengguna</Button></div>
            </form>
            <Table>
              <Table.Header><Table.Row><Table.Head>Username</Table.Head><Table.Head>Role</Table.Head><Table.Head>Publish</Table.Head><Table.Head>Status</Table.Head></Table.Row></Table.Header>
              <Table.Body>{users.map((entry) => (
                <Table.Row key={entry.id}>
                  <Table.Cell>{entry.username}</Table.Cell>
                  <Table.Cell>{entry.role}</Table.Cell>
                  <Table.Cell>{entry.role === "editor" ? <Switch checked={entry.canPublish} onCheckedChange={(checked) => void patchUser(entry.id, { canPublish: checked })} aria-label={`Izin publish ${entry.username}`} /> : "Ya"}</Table.Cell>
                  <Table.Cell><Switch checked={entry.active} onCheckedChange={(checked) => void patchUser(entry.id, { active: checked })} aria-label={`Status ${entry.username}`} /></Table.Cell>
                </Table.Row>
              ))}</Table.Body>
            </Table>
          </LayerCard>
        ) : null}
      </div>
    </section>
  );
}
