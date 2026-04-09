export default function AdminLoginPage() {
  return (
    <main className="page-shell">
      <div className="container" style={{ display: "flex", justifyContent: "center" }}>
        <div
          className="card"
          style={{
            maxWidth: 480,
            width: "100%",
            padding: 32,
            borderRadius: 18,
          }}
        >
          <p style={{ fontSize: 14, color: "#58677a", marginBottom: 8 }}>
            Boostle Support
          </p>

          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
            Admin Login
          </h1>

          <p style={{ fontSize: 14, color: "#58677a", marginBottom: 24 }}>
            Enter your admin password to access the dashboard.
          </p>

          <form method="POST" action="/api/admin/login">
            <label style={{ display: "block", marginBottom: 6 }}>
              Password
            </label>

            <input
              type="password"
              name="password"
              placeholder="Enter admin password"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #dbe4f0",
                marginBottom: 16,
              }}
            />

            <button
              type="submit"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}