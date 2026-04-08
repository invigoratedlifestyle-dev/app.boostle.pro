"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="container">
        <div
          className="card"
          style={{ maxWidth: 480, margin: "0 auto", padding: 28 }}
        >
          <div className="eyebrow">Boostle Support</div>

          <h1 style={{ marginTop: 12 }}>Admin Login</h1>

          <p className="lead">
            Enter your admin password to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
            <div className="field">
              <label className="label">Password</label>

              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />
            </div>

            {error && (
              <div
                className="status-text status-error"
                style={{ marginTop: 10 }}
              >
                {error}
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <button
                className="button button-primary"
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}