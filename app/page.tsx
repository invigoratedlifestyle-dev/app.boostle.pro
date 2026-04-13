"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type FormDataShape = {
  name: string;
  email: string;
  storeUrl: string;
  appName: string;
  subject: string;
  category: string;
  message: string;
};

type SupportApiResponse = {
  ok?: boolean;
  ticketId?: string;
  ticketNumber?: number;
  error?: string;
};

const initialForm: FormDataShape = {
  name: "",
  email: "",
  storeUrl: "",
  appName: "Boostle: Labels",
  subject: "",
  category: "Installation",
  message: "",
};

export default function HomePage() {
  const router = useRouter();
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@boostle.pro";

  const [form, setForm] = useState<FormDataShape>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "error" | "success";
    message: string;
  }>({
    type: "idle",
    message: "",
  });

  const canSubmit = useMemo(() => {
    return Boolean(
      form.name.trim() &&
        form.email.trim() &&
        form.storeUrl.trim() &&
        form.appName.trim() &&
        form.subject.trim() &&
        form.category.trim() &&
        form.message.trim(),
    );
  }, [form]);

  function updateField<K extends keyof FormDataShape>(
    key: K,
    value: FormDataShape[K],
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "idle", message: "" });

    if (!canSubmit) {
      setStatus({
        type: "error",
        message: "Please complete all required fields.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as SupportApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      setStatus({
        type: "success",
        message: "Support request submitted successfully.",
      });

      setForm(initialForm);

      if (data.ticketNumber) {
        router.push(
          `/success?ticket=${encodeURIComponent(String(data.ticketNumber))}`,
        );
        return;
      }

      if (data.ticketId) {
        router.push(`/success?ticket=${encodeURIComponent(data.ticketId)}`);
        return;
      }

      router.push("/success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while submitting your request.";

      setStatus({
        type: "error",
        message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #eef4ff 45%, #f8fafc 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "56px 20px 72px",
        }}
      >
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 0.9fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #dbe7f5",
              borderRadius: 24,
              padding: 32,
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: "#eef4ff",
                color: "#2563eb",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "#2563eb",
                  display: "inline-block",
                }}
              />
              Boostle Support
            </div>

            <h1
              style={{
                margin: "0 0 16px",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
                color: "#0f172a",
              }}
            >
              Need help with a Boostle app?
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.7,
                color: "#334155",
                maxWidth: 720,
              }}
            >
              Submit a support request and we’ll help with setup, billing,
              troubleshooting, and general app questions.
            </p>

            <div
              style={{
                display: "grid",
                gap: 14,
                marginTop: 28,
              }}
            >
              {[
                "Shopify-focused support for Boostle apps",
                "Help with installation, theme placement, and billing",
                "Simple support flow while the full ticket system is built",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    color: "#0f172a",
                    fontSize: 17,
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#2563eb",
                      marginTop: 9,
                      flexShrink: 0,
                    }}
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 30,
                paddingTop: 22,
                borderTop: "1px solid #e2e8f0",
                fontSize: 16,
                color: "#334155",
              }}
            >
              <strong style={{ color: "#0f172a" }}>Email support:</strong>{" "}
              <a
                href={`mailto:${supportEmail}`}
                style={{
                  color: "#2563eb",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {supportEmail}
              </a>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #dbe7f5",
              borderRadius: 24,
              padding: 32,
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 36,
                lineHeight: 1.08,
                letterSpacing: "-0.04em",
                color: "#0f172a",
              }}
            >
              Submit a support request
            </h2>

            <p
              style={{
                margin: "0 0 24px",
                fontSize: 16,
                lineHeight: 1.65,
                color: "#475569",
              }}
            >
              Tell us what’s happening and include as much detail as possible so
              we can help faster.
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              style={{ display: "grid", gap: 18 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <label
                    htmlFor="name"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your name"
                    required
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      font: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label
                    htmlFor="email"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@store.com"
                    required
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      font: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label
                    htmlFor="storeUrl"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Shopify store URL
                  </label>
                  <input
                    id="storeUrl"
                    type="url"
                    value={form.storeUrl}
                    onChange={(e) => updateField("storeUrl", e.target.value)}
                    placeholder="https://your-store.myshopify.com"
                    required
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      font: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label
                    htmlFor="appName"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    App
                  </label>
                  <select
                    id="appName"
                    value={form.appName}
                    onChange={(e) => updateField("appName", e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      font: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Boostle: Labels">Boostle: Labels</option>
                    <option value="Boostle Support">Boostle Support</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label
                    htmlFor="subject"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={form.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    placeholder="Short summary of the issue"
                    required
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      font: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <label
                    htmlFor="category"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "0 14px",
                      font: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Installation">Installation</option>
                    <option value="Billing">Billing</option>
                    <option value="App not working">App not working</option>
                    <option value="Theme placement">Theme placement</option>
                    <option value="Customisation">Customisation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridColumn: "1 / -1",
                  }}
                >
                  <label
                    htmlFor="message"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    placeholder="Describe the issue, what you expected, and what happened instead."
                    required
                    style={{
                      width: "100%",
                      minHeight: 160,
                      resize: "vertical",
                      borderRadius: 14,
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      color: "#0f172a",
                      padding: "14px",
                      font: "inherit",
                      lineHeight: 1.6,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                  marginTop: 4,
                }}
              >
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  style={{
                    appearance: "none",
                    border: 0,
                    cursor: submitting || !canSubmit ? "not-allowed" : "pointer",
                    borderRadius: 14,
                    padding: "14px 18px",
                    fontWeight: 700,
                    background:
                      submitting || !canSubmit ? "#cbd5e1" : "#2563eb",
                    color: "#ffffff",
                    font: "inherit",
                    opacity: submitting || !canSubmit ? 0.8 : 1,
                  }}
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>

                {status.message ? (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color:
                        status.type === "error"
                          ? "#b91c1c"
                          : status.type === "success"
                            ? "#15803d"
                            : "#475569",
                    }}
                  >
                    {status.message}
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#475569",
                  paddingTop: 6,
                }}
              >
                You can also contact us directly at{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  style={{
                    color: "#2563eb",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  {supportEmail}
                </a>
                .
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}