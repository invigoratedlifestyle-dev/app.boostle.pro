import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  sendTicketReplyAction,
  updateTicketStatusAction,
} from "./actions";

type TicketStatus = "open" | "in_progress" | "closed";

type Ticket = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  direction: "inbound" | "outbound";
  sender_name: string | null;
  sender_email: string;
  body_text: string | null;
  created_at: string;
};

type ConversationItem =
  | {
      id: string;
      type: "admin_reply";
      created_at: string;
      body: string | null;
      sender_email: string;
    }
  | {
      id: string;
      type: "customer_reply";
      created_at: string;
      body: string | null;
      sender_name: string | null;
      sender_email: string;
    };

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getStatusStyle(status: TicketStatus) {
  if (status === "open") {
    return { background: "#dcfce7", color: "#15803d" };
  }

  if (status === "in_progress") {
    return { background: "#fef3c7", color: "#b45309" };
  }

  return { background: "#e2e8f0", color: "#475569" };
}

function getStatusLabel(status: TicketStatus) {
  if (status === "in_progress") {
    return "In progress";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function cleanQuotedReply(text: string | null | undefined) {
  if (!text) return "";

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const lines = normalized.split("\n");
  const cleanLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const currentLine = line.trim();
    const nextLine = (lines[i + 1] ?? "").trim();

    const isQuoteHeaderStart =
      /^On .+<.+@.+>$/.test(currentLine) ||
      /^On .+wrote:$/i.test(currentLine) ||
      /^From:\s.+/i.test(currentLine) ||
      /^Sent:\s.+/i.test(currentLine) ||
      /^To:\s.+/i.test(currentLine) ||
      /^Subject:\s.+/i.test(currentLine);

    const isTwoLineQuoteHeader =
      /^On .+<.+@.+>$/.test(currentLine) && /^wrote:$/i.test(nextLine);

    if (isQuoteHeaderStart || isTwoLineQuoteHeader) {
      break;
    }

    if (currentLine.startsWith(">") || currentLine.startsWith("|")) {
      continue;
    }

    cleanLines.push(line);
  }

  return cleanLines.join("\n").trim();
}

export default async function AdminTicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const replySent = resolvedSearchParams.sent === "1";

  const supabase = getSupabaseAdmin();

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (ticketError) throw new Error(ticketError.message);
  if (!ticket) notFound();

  // ✅ SINGLE SOURCE OF TRUTH
  const { data: messages, error: messagesError } = await supabase
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const conversation: ConversationItem[] = (messages ?? []).map((msg: TicketMessage) => {
    if (msg.direction === "outbound") {
      return {
        id: msg.id,
        type: "admin_reply",
        created_at: msg.created_at,
        body: msg.body_text,
        sender_email: msg.sender_email,
      };
    }

    return {
      id: msg.id,
      type: "customer_reply",
      created_at: msg.created_at,
      body: cleanQuotedReply(msg.body_text),
      sender_name: msg.sender_name,
      sender_email: msg.sender_email,
    };
  });

  const typedTicket = ticket as Ticket;
  const returnTo = `/admin/tickets/${typedTicket.id}`;

  return (
    <main className="page-shell">
      <div className="container" style={{ display: "grid", gap: 20 }}>

        {/* SUCCESS */}
        {replySent && (
          <div className="card" style={{
            padding: 16,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
          }}>
            Reply sent successfully and added to ticket history.
          </div>
        )}

        {/* HEADER */}
        <section className="card" style={{ padding: 24 }}>
          <h2>{typedTicket.subject}</h2>
          <p>{typedTicket.email}</p>
        </section>

        {/* REPLY FORM */}
        <form action={sendTicketReplyAction}>
          <input type="hidden" name="ticketId" value={typedTicket.id} />

          <textarea name="replyBody" required />

          <button type="submit">Send reply</button>
        </form>

        {/* HISTORY */}
        <section className="card" style={{ padding: 24 }}>
          {conversation.map((item) =>
            item.type === "admin_reply" ? (
              <div key={item.id}>
                <strong>Admin:</strong>
                <div>{item.body}</div>
              </div>
            ) : (
              <div key={item.id}>
                <strong>Customer:</strong>
                <div>{item.body}</div>
              </div>
            )
          )}
        </section>
      </div>
    </main>
  );
}