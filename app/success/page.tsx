"use client";

import { useSearchParams } from "next/navigation";

export default function SuccessPage() {
  const params = useSearchParams();
  const ticket = params.get("ticket");

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Request submitted ✅</h1>

      {ticket && (
        <p>
          Your ticket ID: <strong>{ticket}</strong>
        </p>
      )}

      <p>We’ll get back to you shortly.</p>
    </main>
  );
}