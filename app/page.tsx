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

const quickCategories = [
  {
    title: "Installation help",
    description: "Need help getting Boostle live on your product page?",
    category: "Installation",
    subject: "Need help installing Boostle",
    message:
      "Hi Boostle team, I need help installing the app on my Shopify store. I’ve added the app but I’m not sure if the block is placed correctly.",
  },
  {
    title: "Theme placement",
    description: "Badge not showing in the right spot or missing on the product page?",
    category: "Theme placement",
    subject: "Help with theme placement",
    message:
      "Hi Boostle team, I need help placing the Boostle label correctly on my product page. It is either not visible or not appearing in the right location.",
  },
  {
    title: "Billing support",
    description: "Questions about plan access, upgrades, or billing behaviour.",
    category: "Billing",
    subject: "Question about billing",
    message:
      "Hi Boostle team, I have a question about billing or plan access for my store.",
  },
  {
    title: "App not working",
    description: "Something is broken, not updating, or not displaying properly.",
    category: "App not working",
    subject: "Boostle is not working correctly",
    message:
      "Hi Boostle team, the app doesn’t seem to be working correctly on my store. Here is what I expected to happen, and what happened instead:",
  },
];

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

  function applyQuickStart(item: {
    category: string;
    subject: string;
    message: string;
  }) {
    setForm((prev) => ({
      ...prev,
      category: item.category,
      subject: item.subject,
      message: item.message,
    }));

    setStatus({ type: "idle", message: "" });
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
    <main className="support-page">
      <div className="support-shell">
        <section className="hero-card">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Boostle Support
          </div>

          <div className="hero-grid">
            <div className="hero-copy">
              <h1>Support built for Shopify merchants using Boostle</h1>
              <p className="hero-text">
                Get help with installation, theme placement, billing, and
                troubleshooting for your Boostle app. Submit a request with your
                store details and we’ll point you in the right direction faster.
              </p>

              <div className="hero-points">
                <div className="hero-point">
                  <span className="hero-point-dot" />
                  <span>Installation and setup guidance</span>
                </div>
                <div className="hero-point">
                  <span className="hero-point-dot" />
                  <span>Theme placement and product page troubleshooting</span>
                </div>
                <div className="hero-point">
                  <span className="hero-point-dot" />
                  <span>Billing, upgrade, and plan access support</span>
                </div>
              </div>

              <div className="hero-contact">
                <span className="hero-contact-label">Direct support</span>
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </div>
            </div>

            <aside className="hero-side-panel">
              <h2>Before you submit</h2>
              <ul>
                <li>Include your Shopify store URL</li>
                <li>Tell us what you expected to happen</li>
                <li>Tell us what happened instead</li>
                <li>Mention the page, theme, or product involved</li>
              </ul>

              <div className="response-note">
                Better detail = faster troubleshooting.
              </div>
            </aside>
          </div>
        </section>

        <section className="quick-start-section">
          <div className="section-heading">
            <p className="eyebrow">Quick start</p>
            <h2>Start with a common support request</h2>
            <p>
              Tap one of these to pre-fill the form and reduce friction for the
              merchant.
            </p>
          </div>

          <div className="quick-grid">
            {quickCategories.map((item) => (
              <button
                key={item.title}
                type="button"
                className="quick-card"
                onClick={() => applyQuickStart(item)}
              >
                <span className="quick-card-title">{item.title}</span>
                <span className="quick-card-description">
                  {item.description}
                </span>
                <span className="quick-card-action">Use this template</span>
              </button>
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <p className="eyebrow">Submit a request</p>
            <h2>Tell us what’s happening</h2>
            <p>
              The more context you include, the easier it is to identify the
              issue quickly.
            </p>
          </div>

          <div className="form-card">
            <form onSubmit={handleSubmit} noValidate className="support-form">
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@store.com"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="storeUrl">Shopify store URL</label>
                  <input
                    id="storeUrl"
                    type="url"
                    value={form.storeUrl}
                    onChange={(e) => updateField("storeUrl", e.target.value)}
                    placeholder="https://your-store.myshopify.com"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="appName">App</label>
                  <select
                    id="appName"
                    value={form.appName}
                    onChange={(e) => updateField("appName", e.target.value)}
                    required
                  >
                    <option value="Boostle: Labels">Boostle: Labels</option>
                    <option value="Boostle Support">Boostle Support</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="subject">Subject</label>
                  <input
                    id="subject"
                    type="text"
                    value={form.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    placeholder="Short summary of the issue"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    required
                  >
                    <option value="Installation">Installation</option>
                    <option value="Billing">Billing</option>
                    <option value="App not working">App not working</option>
                    <option value="Theme placement">Theme placement</option>
                    <option value="Customisation">Customisation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="field field-full">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    placeholder="Describe the issue, what you expected, and what happened instead."
                    required
                  />
                </div>
              </div>

              {status.message ? (
                <div
                  className={`status-banner ${
                    status.type === "error"
                      ? "status-error"
                      : status.type === "success"
                        ? "status-success"
                        : ""
                  }`}
                >
                  {status.message}
                </div>
              ) : null}

              <div className="form-footer">
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="submit-button"
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>

                <p className="form-help">
                  Or email us directly at{" "}
                  <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>

      <style jsx>{`
        .support-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top,
              rgba(37, 99, 235, 0.12),
              transparent 30%
            ),
            linear-gradient(180deg, #f8fbff 0%, #eef4ff 45%, #f8fafc 100%);
          color: #0f172a;
        }

        .support-shell {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 20px 72px;
        }

        .hero-card,
        .form-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(148, 163, 184, 0.22);
          box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
        }

        .hero-card {
          border-radius: 28px;
          padding: 32px;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 999px;
          background: #eff6ff;
          color: #2563eb;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 22px;
        }

        .hero-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #2563eb;
          display: inline-block;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.75fr);
          gap: 24px;
          align-items: start;
        }

        .hero-copy h1 {
          margin: 0 0 16px;
          font-size: clamp(2.2rem, 4vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.05em;
        }

        .hero-text {
          margin: 0;
          font-size: 18px;
          line-height: 1.75;
          color: #334155;
          max-width: 760px;
        }

        .hero-points {
          display: grid;
          gap: 14px;
          margin-top: 28px;
        }

        .hero-point {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 16px;
          line-height: 1.6;
          color: #0f172a;
        }

        .hero-point-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
          margin-top: 9px;
          flex-shrink: 0;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
        }

        .hero-contact {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 28px;
          padding: 16px 18px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid #dbe7f5;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }

        .hero-contact-label {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
        }

        .hero-contact a,
        .form-help a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 700;
        }

        .hero-side-panel {
          border-radius: 22px;
          padding: 22px;
          background: linear-gradient(180deg, #0f172a 0%, #172554 100%);
          color: #ffffff;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
        }

        .hero-side-panel h2 {
          margin: 0 0 14px;
          font-size: 20px;
          letter-spacing: -0.03em;
        }

        .hero-side-panel ul {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 10px;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.6;
        }

        .response-note {
          margin-top: 18px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.1);
          color: #dbeafe;
          font-size: 14px;
          font-weight: 600;
        }

        .quick-start-section,
        .form-section {
          margin-top: 28px;
        }

        .section-heading {
          margin-bottom: 18px;
        }

        .eyebrow {
          margin: 0 0 8px;
          color: #2563eb;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .section-heading h2 {
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 2.4rem);
          line-height: 1.05;
          letter-spacing: -0.04em;
        }

        .section-heading p {
          margin: 10px 0 0;
          color: #475569;
          font-size: 16px;
          line-height: 1.7;
        }

        .quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .quick-card {
          appearance: none;
          border: 1px solid #dbe7f5;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 22px;
          padding: 20px;
          text-align: left;
          cursor: pointer;
          display: grid;
          gap: 10px;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.05);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease;
        }

        .quick-card:hover {
          transform: translateY(-2px);
          border-color: #93c5fd;
          box-shadow: 0 18px 40px rgba(37, 99, 235, 0.12);
        }

        .quick-card-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }

        .quick-card-description {
          font-size: 14px;
          line-height: 1.65;
          color: #475569;
        }

        .quick-card-action {
          font-size: 13px;
          font-weight: 700;
          color: #2563eb;
        }

        .form-card {
          border-radius: 28px;
          padding: 28px;
        }

        .support-form {
          display: grid;
          gap: 20px;
        }

        .field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px 16px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #0f172a;
          padding: 0 14px;
          font: inherit;
          outline: none;
          box-sizing: border-box;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            transform 0.18s ease;
        }

        .field input,
        .field select {
          height: 52px;
        }

        .field textarea {
          min-height: 180px;
          resize: vertical;
          padding-top: 14px;
          padding-bottom: 14px;
          line-height: 1.65;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
        }

        .status-banner {
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.55;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
        }

        .status-error {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
        }

        .status-success {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #15803d;
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .submit-button {
          appearance: none;
          border: 0;
          cursor: pointer;
          border-radius: 16px;
          padding: 15px 20px;
          font: inherit;
          font-weight: 800;
          background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          box-shadow: 0 14px 30px rgba(37, 99, 235, 0.24);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            opacity 0.18s ease;
        }

        .submit-button:hover:enabled {
          transform: translateY(-1px);
          box-shadow: 0 18px 34px rgba(37, 99, 235, 0.28);
        }

        .submit-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
          box-shadow: none;
        }

        .form-help {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: #475569;
        }

        @media (max-width: 1024px) {
          .quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .support-shell {
            padding: 20px 14px 48px;
          }

          .hero-card,
          .form-card {
            padding: 20px;
            border-radius: 22px;
          }

          .field-grid,
          .quick-grid {
            grid-template-columns: 1fr;
          }

          .hero-copy h1 {
            font-size: 2.2rem;
          }

          .hero-text {
            font-size: 16px;
          }

          .form-footer {
            align-items: stretch;
          }

          .submit-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}