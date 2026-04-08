type SuccessPageProps = {
  searchParams: Promise<{
    ticket?: string;
  }>;
};

export default async function SuccessPage({
  searchParams,
}: SuccessPageProps) {
  const params = await searchParams;
  const ticket = params.ticket;

  return (
    <main className="success-wrap">
      <div className="card success-card">
        <div className="success-badge">Request received</div>
        <h1>Thanks, your support request has been submitted.</h1>

        <p>
          We’ve received your message and will reply by email as soon as
          possible.
        </p>

        {ticket ? (
          <p style={{ marginTop: "16px" }}>
            Your ticket ID: <strong>{ticket}</strong>
          </p>
        ) : null}

        <div className="success-actions">
          <a href="/" className="button button-primary">
            Back to support
          </a>
        </div>
      </div>
    </main>
  );
}