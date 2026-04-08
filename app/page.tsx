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
    return (
      form.name.trim() &&
      form.email.trim() &&
      form.storeUrl.trim() &&
      form.appName.trim() &&
      form.subject.trim() &&
      form.category.trim() &&
      form.message.trim()
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
    <main className="page-shell">
      <div className="container">
        <section className="hero">
          <div className="card hero-copy">
            <div className="eyebrow">Boostle Support</div>

            <h1>Need help with a Boostle app?</h1>

            <p className="lead">
              Submit a support request and we’ll help with setup, billing,
              troubleshooting, and general app questions.
            </p>

            <ul className="trust-list">
              <li>
                <span className="trust-dot" />
                <span>Shopify-focused support for Boostle apps</span>
              </li>
              <li>
                <span className="trust-dot" />
                <span>Help with installation, theme placement, and billing</span>
              </li>
              <li>
                <span className="trust-dot" />
                <span>Simple support flow while the full ticket system is built</span>
              </li>
            </ul>

            <div className="support-email">
              <strong>Email support:</strong>{" "}
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </div>
          </div>

          <div className="card form-card">
            <h2>Submit a support request</h2>
            <p>
              Tell us what’s happening and include as much detail as possible so
              we can help faster.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-grid">
                <div className="field">
                  <label className="label" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    className="input"
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="you@store.com"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="storeUrl">
                    Shopify store URL
                  </label>
                  <input
                    id="storeUrl"
                    className="input"
                    type="url"
                    value={form.storeUrl}
                    onChange={(e) => updateField("storeUrl", e.target.value)}
                    placeholder="https://your-store.myshopify.com"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="appName">
                    App
                  </label>
                  <select
                    id="appName"
                    className="select"
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
                  <label className="label" htmlFor="subject">
                    Subject
                  </label>
                  <input
                    id="subject"
                    className="input"
                    type="text"
                    value={form.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    placeholder="Short summary of the issue"
                    required
                  />
                </div>

                <div className="field">
                  <label className="label" htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    className="select"
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

                <div className="field full">
                  <label className="label" htmlFor="message">
                    Message
                  </label>
                  <textarea
                    id="message"
                    className="textarea"
                    value={form.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    placeholder="Describe the issue, what you expected, and what happened instead."
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submitting || !canSubmit}
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>

                {status.message ? (
                  <span
                    className={`status-text ${
                      status.type === "error"
                        ? "status-error"
                        : status.type === "success"
                          ? "status-success"
                          : ""
                    }`}
                  >
                    {status.message}
                  </span>
                ) : null}
              </div>

              <div className="footer-note">
                You can also contact us directly at{" "}
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}