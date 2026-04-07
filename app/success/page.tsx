import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="success-wrap">
      <div className="card success-card">
        <div className="success-badge">Request received</div>
        <h1>Thanks, your support request has been submitted.</h1>
        <p>
          We’ve received your message and will reply by email as soon as
          possible. If your issue is urgent, you can also contact us directly at{" "}
          <a href="mailto:support@boostle.pro">support@boostle.pro</a>.
        </p>

        <div className="success-actions">
          <Link href="/" className="button button-primary">
            Back to support
          </Link>
        </div>
      </div>
    </main>
  );
}