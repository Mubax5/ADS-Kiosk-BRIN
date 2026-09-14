import { Button, Input, LayerCard } from "@cloudflare/kumo";
import { useState, type FormEvent } from "react";
import { ApiClientError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Tidak dapat masuk ke CMS");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <LayerCard className="login-card">
        <h1>BRIN Kiosk CMS</h1>
        <p>Masuk untuk mengelola konten kiosk.</p>
        <form className="login-form" onSubmit={submit}>
          <Input
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p role="alert" className="login-error">{error}</p> : null}
          <Button type="submit" variant="primary" disabled={submitting || !username || !password}>
            {submitting ? "Memproses…" : "Masuk"}
          </Button>
        </form>
      </LayerCard>
    </div>
  );
}
