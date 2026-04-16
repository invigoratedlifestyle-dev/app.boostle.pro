"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Login failed.");
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <div
        className="container"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          className="card"
          style={{
            width: "100%",
            maxWidth: 480,
            padding: 32,
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#58677a",
            }}
          >
            Boostle Support
          </p>

          <h1
            style={{
              margin: "12px 0 10px",
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Admin Login
          </h1>

          <p
            style={{
              margin: "0 0 24px",
              color: "#58677a",
              lineHeight: 1.6,
            }}
          >
            Enter your admin password to access the dashboard.
          </p>

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <label
                htmlFor="password"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#122033",
                }}
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin password"
                required
                style={{
                  width: "100%",
                  border: "1px solid #dbe4f0",
                  background: "#ffffff",
                  color: "#122033",
                  borderRadius: 12,
                  padding: "14px 14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 18,
              }}
            >
              <button
                type="submit"
                disabled={loading}
                style={{
                  appearance: "none",
                  border: 0,
                  cursor: loading ? "not-allowed" : "pointer",
                  borderRadius: 12,
                  padding: "14px 18px",
                  fontWeight: 700,
                  background: "#2563eb",
                  color: "#ffffff",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

              {error ? (
                <span
                  style={{
                    fontSize: 14,
                    color: "#b91c1c",
                  }}
                >
                  {error}
                </span>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}