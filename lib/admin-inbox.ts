import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  DEFAULT_CONTACT_TO_EMAIL,
  escapeHtml,
  getEmailServiceSummary,
  getResendApiKey,
  isValidEmailAddress,
  resolveEmailFrom,
  resolveSiteOrigin,
  sanitizeHeaderField,
} from "@/lib/email";
import { SITE_NAME } from "@/lib/seo";

export type EmailFolder = "inbox" | "sent" | "starred" | "archived" | "trash";

export type EmailThreadSource = "resend_inbound" | "contact_form" | "outbound";
export type EmailMessageSource = "resend_inbound" | "contact_form" | "admin_reply";
export type EmailDirection = "inbound" | "outbound";

export type EmailAttachmentMeta = {
  id: string;
  filename: string | null;
  size: number;
  content_type: string;
};

export type AdminEmailThreadRow = {
  id: string;
  subject: string;
  normalized_subject: string;
  participant_email: string;
  participant_name: string;
  source: EmailThreadSource;
  folder: EmailFolder;
  is_read: boolean;
  is_starred: boolean;
  snippet: string;
  message_count: number;
  last_message_at: string;
  last_inbound_at: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminEmailMessageRow = {
  id: string;
  thread_id: string;
  direction: EmailDirection;
  source: EmailMessageSource;
  resend_email_id: string | null;
  rfc_message_id: string | null;
  in_reply_to: string | null;
  from_email: string;
  from_name: string;
  to_emails: string[];
  cc_emails: string[];
  reply_to: string | null;
  subject: string;
  text_body: string;
  html_body: string | null;
  attachments: EmailAttachmentMeta[];
  sent_by_admin_email: string | null;
  created_at: string;
};

export type InboxCounts = {
  inbox: number;
  unread: number;
  starred: number;
  sent: number;
  archived: number;
  trash: number;
};

export type InboxSummaryItem = {
  id: string;
  subject: string;
  participantName: string;
  participantEmail: string;
  snippet: string;
  source: EmailThreadSource;
  lastMessageAt: string;
};

export type ResendSyncStats = {
  syncedCount: number;
  totalChecked: number;
  receivingSupported: boolean;
  error?: string;
};

export function isMissingInboxTableError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("admin_email_threads") ||
    msg.includes("admin_email_messages") ||
    msg.includes("does not exist")
  );
}

export function parseSenderIdentity(rawFrom: string): {
  name: string;
  email: string;
} {
  const cleaned = sanitizeHeaderField(rawFrom || "");
  if (!cleaned) {
    return { name: "Remetente desconhecido", email: "" };
  }

  const bracketMatch = cleaned.match(/^(.*?)<([^<>@\s]+@[^<>@\s]+)>$/);
  if (bracketMatch) {
    const rawName = bracketMatch[1].trim().replace(/^["']|["']$/g, "").trim();
    const email = bracketMatch[2].trim().toLowerCase();
    return {
      name: rawName || email.split("@")[0] || email,
      email,
    };
  }

  const emailOnly = cleaned.replace(/^["']|["']$/g, "").toLowerCase();
  if (isValidEmailAddress(emailOnly)) {
    return {
      name: emailOnly.split("@")[0] || emailOnly,
      email: emailOnly,
    };
  }

  return { name: cleaned, email: "" };
}

export function normalizeEmailSubject(subject: string): string {
  const clean = sanitizeHeaderField(subject || "");
  const stripped = clean.replace(
    /^(?:\s*(?:re|res|fwd|fw|enc)\s*:\s*)+/i,
    ""
  ).trim();
  return (stripped || "(sem assunto)").toLowerCase().slice(0, 180);
}

export function stripHtmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function buildSnippet(textBody: string, htmlBody?: string | null): string {
  const source = (textBody || "").trim() || stripHtmlToText(htmlBody || "");
  const singleLine = source.replace(/\s+/g, " ").trim();
  if (!singleLine) return "(Mensagem sem conteúdo de texto)";
  return singleLine.length > 140
    ? `${singleLine.slice(0, 137).trimEnd()}…`
    : singleLine;
}

export function sanitizeSandboxedEmailHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<(?:embed|meta|base)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\b(href|src|action|formaction)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)[^"']*\2/gi,
      '$1=$2#$2'
    )
    .replace(
      /\b(href|src|action|formaction)\s*=\s*(?:javascript|vbscript|data:text\/html)[^\s>]+/gi,
      '$1="#"'
    );
}

export function buildAdminReplyEmailHtml(params: {
  bodyText: string;
  quotedText?: string;
  quotedAuthor?: string;
}): string {
  const origin = resolveSiteOrigin();
  const paragraphs = params.bodyText
    .trim()
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 14px; line-height:1.65; color:#1E293B;">${escapeHtml(
          block
        ).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  const quotedHtml = params.quotedText
    ? `<div style="margin-top:24px; padding-left:14px; border-left:3px solid #CBD5E1; color:#64748B; font-size:13px;">
        <p style="margin:0 0 8px; font-weight:600; color:#475569;">${escapeHtml(
          params.quotedAuthor
            ? `Em resposta a ${params.quotedAuthor}:`
            : "Mensagem anterior:"
        )}</p>
        <div style="white-space:pre-wrap;">${escapeHtml(
          params.quotedText.slice(0, 2000)
        )}</div>
      </div>`
    : "";

  return `
  <div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#0F172A; font-size:14px; max-width:640px; margin:0 auto; padding:12px 4px;">
    ${paragraphs}
    ${quotedHtml}
    <div style="margin-top:26px; padding-top:14px; border-top:1px solid #E2E8F0; font-size:12px; color:#64748B;">
      <strong style="color:#0F172A;">Equipe ${escapeHtml(SITE_NAME)}</strong> ·
      <a href="${escapeHtml(origin)}" style="color:#4F46E5; text-decoration:none;">${escapeHtml(
        origin
      )}</a>
    </div>
  </div>`;
}

async function findMatchingThread(
  admin: SupabaseClient,
  params: {
    participantEmail: string;
    normalizedSubject: string;
    inReplyTo?: string | null;
  }
): Promise<AdminEmailThreadRow | null> {
  if (params.inReplyTo) {
    const cleanRef = params.inReplyTo.trim();
    if (cleanRef) {
      const { data: msgMatch } = await admin
        .from("admin_email_messages")
        .select("thread_id")
        .eq("rfc_message_id", cleanRef)
        .limit(1)
        .maybeSingle();

      if (msgMatch?.thread_id) {
        const { data: threadByRef } = await admin
          .from("admin_email_threads")
          .select("*")
          .eq("id", msgMatch.thread_id)
          .maybeSingle();
        if (threadByRef) {
          return threadByRef as AdminEmailThreadRow;
        }
      }
    }
  }

  if (params.participantEmail && params.normalizedSubject) {
    const { data: bySubject } = await admin
      .from("admin_email_threads")
      .select("*")
      .eq("participant_email", params.participantEmail.toLowerCase())
      .eq("normalized_subject", params.normalizedSubject)
      .neq("folder", "trash")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bySubject) {
      return bySubject as AdminEmailThreadRow;
    }
  }

  return null;
}

export async function recordContactFormMessage(
  admin: SupabaseClient | null,
  params: {
    nome: string;
    email: string;
    assunto: string;
    mensagem: string;
    resendEmailId?: string | null;
  }
): Promise<{ saved: boolean; threadId?: string; error?: string }> {
  if (!admin) {
    return { saved: false, error: "Supabase admin não configurado." };
  }

  const fromEmail = sanitizeHeaderField(params.email).toLowerCase();
  const fromName = sanitizeHeaderField(params.nome).slice(0, 120);
  const subject = sanitizeHeaderField(params.assunto).slice(0, 200) || "Contato pelo site";
  const normalizedSubject = normalizeEmailSubject(subject);
  const textBody = params.mensagem.trim().slice(0, 10000);
  const snippet = buildSnippet(textBody);
  const nowIso = new Date().toISOString();

  try {
    const existing = await findMatchingThread(admin, {
      participantEmail: fromEmail,
      normalizedSubject,
    });

    let threadId = existing?.id;

    if (!threadId) {
      const { data: createdThread, error: createErr } = await admin
        .from("admin_email_threads")
        .insert({
          subject,
          normalized_subject: normalizedSubject,
          participant_email: fromEmail,
          participant_name: fromName,
          source: "contact_form",
          folder: "inbox",
          is_read: false,
          is_starred: false,
          snippet,
          message_count: 1,
          last_message_at: nowIso,
          last_inbound_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();

      if (createErr) {
        if (!isMissingInboxTableError(createErr)) {
          console.error("[Artigen Inbox] Erro ao criar thread de contato:", createErr.message);
        }
        return { saved: false, error: createErr.message };
      }

      threadId = createdThread.id;
    } else {
      await admin
        .from("admin_email_threads")
        .update({
          folder: "inbox",
          is_read: false,
          snippet,
          message_count: (existing?.message_count ?? 1) + 1,
          last_message_at: nowIso,
          last_inbound_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", threadId);
    }

    const { error: msgErr } = await admin.from("admin_email_messages").insert({
      thread_id: threadId,
      direction: "inbound",
      source: "contact_form",
      resend_email_id: params.resendEmailId ? `contact:${params.resendEmailId}` : null,
      from_email: fromEmail,
      from_name: fromName,
      to_emails: [DEFAULT_CONTACT_TO_EMAIL],
      cc_emails: [],
      reply_to: fromEmail,
      subject,
      text_body: textBody,
      html_body: null,
      attachments: [],
      created_at: nowIso,
    });

    if (msgErr) {
      if (!isMissingInboxTableError(msgErr)) {
        console.error("[Artigen Inbox] Erro ao salvar mensagem de contato:", msgErr.message);
      }
      return { saved: false, error: msgErr.message };
    }

    return { saved: true, threadId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    return { saved: false, error: message };
  }
}

export type InboundResendPayload = {
  id: string;
  from: string;
  to: string[];
  cc?: string[] | null;
  reply_to?: string[] | null;
  subject: string;
  text?: string | null;
  html?: string | null;
  created_at?: string;
  message_id?: string | null;
  headers?: Record<string, string> | null;
  attachments?: Array<{
    id: string;
    filename: string | null;
    size?: number;
    content_type: string;
  }>;
};

function readHeaderCaseInsensitive(
  headers: Record<string, string> | null | undefined,
  name: string
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return null;
}

export async function ingestInboundResendEmail(
  admin: SupabaseClient,
  email: InboundResendPayload
): Promise<{ inserted: boolean; threadId?: string; skippedReason?: string }> {
  const resendId = String(email.id || "").trim();
  if (!resendId) {
    return { inserted: false, skippedReason: "missing_id" };
  }

  const { data: existingMsg, error: lookupErr } = await admin
    .from("admin_email_messages")
    .select("id, thread_id")
    .eq("resend_email_id", resendId)
    .maybeSingle();

  if (lookupErr) {
    if (isMissingInboxTableError(lookupErr)) {
      return { inserted: false, skippedReason: "table_missing" };
    }
    throw new Error(lookupErr.message);
  }

  if (existingMsg) {
    return {
      inserted: false,
      threadId: existingMsg.thread_id,
      skippedReason: "already_exists",
    };
  }

  const sender = parseSenderIdentity(email.from || "");
  const replyToHeader =
    Array.isArray(email.reply_to) && email.reply_to.length > 0
      ? parseSenderIdentity(email.reply_to[0]).email || email.reply_to[0]
      : null;

  const participantEmail =
    (replyToHeader && isValidEmailAddress(replyToHeader)
      ? replyToHeader
      : sender.email) || "remetente@desconhecido.local";
  const participantName = sender.name || participantEmail;

  const subject =
    sanitizeHeaderField(email.subject || "").slice(0, 220) || "(Sem assunto)";
  const normalizedSubject = normalizeEmailSubject(subject);
  const inReplyTo = readHeaderCaseInsensitive(email.headers, "in-reply-to");
  const rfcMessageId =
    (email.message_id && email.message_id.trim()) ||
    readHeaderCaseInsensitive(email.headers, "message-id");

  const rawText = (email.text || "").trim();
  const rawHtml = email.html ? String(email.html) : null;
  const textBody = rawText || stripHtmlToText(rawHtml || "");
  const snippet = buildSnippet(textBody, rawHtml);
  const createdAt =
    email.created_at && !Number.isNaN(Date.parse(email.created_at))
      ? new Date(email.created_at).toISOString()
      : new Date().toISOString();

  const existingThread = await findMatchingThread(admin, {
    participantEmail,
    normalizedSubject,
    inReplyTo,
  });

  let threadId = existingThread?.id;
  if (!threadId) {
    const { data: insertedThread, error: threadErr } = await admin
      .from("admin_email_threads")
      .insert({
        subject,
        normalized_subject: normalizedSubject,
        participant_email: participantEmail,
        participant_name: participantName,
        source: "resend_inbound",
        folder: "inbox",
        is_read: false,
        is_starred: false,
        snippet,
        message_count: 1,
        last_message_at: createdAt,
        last_inbound_at: createdAt,
        created_at: createdAt,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (threadErr) {
      throw new Error(threadErr.message);
    }
    threadId = insertedThread.id;
  } else {
    const newerTimestamp =
      new Date(createdAt).getTime() >=
      new Date(existingThread?.last_message_at ?? 0).getTime()
        ? createdAt
        : existingThread!.last_message_at;

    await admin
      .from("admin_email_threads")
      .update({
        folder: "inbox",
        is_read: false,
        snippet,
        message_count: (existingThread?.message_count ?? 1) + 1,
        last_message_at: newerTimestamp,
        last_inbound_at: newerTimestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  }

  const attachments: EmailAttachmentMeta[] = Array.isArray(email.attachments)
    ? email.attachments.map((att) => ({
        id: String(att.id || ""),
        filename: att.filename ?? null,
        size: Number(att.size ?? 0),
        content_type: String(att.content_type || "application/octet-stream"),
      }))
    : [];

  const { error: insertMsgErr } = await admin
    .from("admin_email_messages")
    .insert({
      thread_id: threadId,
      direction: "inbound",
      source: "resend_inbound",
      resend_email_id: resendId,
      rfc_message_id: rfcMessageId,
      in_reply_to: inReplyTo,
      from_email: sender.email || participantEmail,
      from_name: sender.name || participantName,
      to_emails: Array.isArray(email.to) ? email.to : [],
      cc_emails: Array.isArray(email.cc) ? email.cc : [],
      reply_to: replyToHeader,
      subject,
      text_body: textBody || "(Mensagem sem corpo de texto)",
      html_body: rawHtml,
      attachments,
      created_at: createdAt,
    });

  if (insertMsgErr) {
    if (insertMsgErr.code === "23505") {
      return { inserted: false, threadId, skippedReason: "already_exists" };
    }
    throw new Error(insertMsgErr.message);
  }

  return { inserted: true, threadId };
}

export async function syncResendReceivingEmails(
  admin: SupabaseClient
): Promise<ResendSyncStats> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return {
      syncedCount: 0,
      totalChecked: 0,
      receivingSupported: false,
      error: "RESEND_API_KEY não configurada.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const listRes = await resend.emails.receiving.list({ limit: 40 });

    if (listRes.error || !listRes.data) {
      const msg = listRes.error?.message || "Erro ao consultar Resend Receiving.";
      const unsupported =
        /not enabled|permission|restricted|unauthorized|domain/i.test(msg);
      return {
        syncedCount: 0,
        totalChecked: 0,
        receivingSupported: !unsupported,
        error: msg,
      };
    }

    const items = listRes.data.data ?? [];
    if (items.length === 0) {
      return {
        syncedCount: 0,
        totalChecked: 0,
        receivingSupported: true,
      };
    }

    const ids = items.map((i) => i.id).filter(Boolean);
    const { data: existingRows, error: checkErr } = await admin
      .from("admin_email_messages")
      .select("resend_email_id")
      .in("resend_email_id", ids);

    if (checkErr) {
      if (isMissingInboxTableError(checkErr)) {
        return {
          syncedCount: 0,
          totalChecked: items.length,
          receivingSupported: true,
          error: "table_missing",
        };
      }
      throw new Error(checkErr.message);
    }

    const existingSet = new Set(
      (existingRows ?? []).map((r) => String(r.resend_email_id))
    );
    const missingItems = items.filter((i) => !existingSet.has(i.id)).slice(0, 15);

    let syncedCount = 0;
    for (const item of missingItems) {
      const detail = await resend.emails.receiving.get(item.id);
      if (detail.error || !detail.data) {
        const res = await ingestInboundResendEmail(admin, {
          id: item.id,
          from: item.from,
          to: item.to,
          cc: item.cc,
          reply_to: item.reply_to,
          subject: item.subject,
          created_at: item.created_at,
          message_id: item.message_id,
          attachments: item.attachments,
        });
        if (res.inserted) syncedCount += 1;
        continue;
      }

      const d = detail.data;
      const res = await ingestInboundResendEmail(admin, {
        id: d.id,
        from: d.from,
        to: d.to,
        cc: d.cc,
        reply_to: d.reply_to,
        subject: d.subject,
        text: d.text,
        html: d.html,
        created_at: d.created_at,
        message_id: d.message_id,
        headers: d.headers,
        attachments: d.attachments,
      });
      if (res.inserted) syncedCount += 1;
    }

    return {
      syncedCount,
      totalChecked: items.length,
      receivingSupported: true,
    };
  } catch (err) {
    return {
      syncedCount: 0,
      totalChecked: 0,
      receivingSupported: false,
      error: err instanceof Error ? err.message : "sync_error",
    };
  }
}

export async function getAdminInboxSummary(admin: SupabaseClient): Promise<{
  unreadCount: number;
  inboxCount: number;
  recentUnread: InboxSummaryItem[];
  migrationPending: boolean;
}> {
  const { data: unreadThreads, count: unreadCount, error: unreadErr } = await admin
    .from("admin_email_threads")
    .select(
      "id, subject, participant_name, participant_email, snippet, source, last_message_at",
      { count: "exact" }
    )
    .eq("folder", "inbox")
    .eq("is_read", false)
    .order("last_message_at", { ascending: false })
    .limit(6);

  if (unreadErr) {
    if (isMissingInboxTableError(unreadErr)) {
      return {
        unreadCount: 0,
        inboxCount: 0,
        recentUnread: [],
        migrationPending: true,
      };
    }
    throw new Error(unreadErr.message);
  }

  const { count: inboxCount } = await admin
    .from("admin_email_threads")
    .select("id", { count: "exact", head: true })
    .eq("folder", "inbox");

  return {
    unreadCount: unreadCount ?? 0,
    inboxCount: inboxCount ?? 0,
    migrationPending: false,
    recentUnread: (unreadThreads ?? []).map((t) => ({
      id: String(t.id),
      subject: String(t.subject),
      participantName: String(t.participant_name || t.participant_email),
      participantEmail: String(t.participant_email),
      snippet: String(t.snippet || ""),
      source: t.source as EmailThreadSource,
      lastMessageAt: String(t.last_message_at),
    })),
  };
}

export async function getInboxCounts(
  admin: SupabaseClient
): Promise<InboxCounts> {
  const [inboxRes, unreadRes, starredRes, sentRes, archivedRes, trashRes] =
    await Promise.all([
      admin
        .from("admin_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("folder", "inbox"),
      admin
        .from("admin_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("folder", "inbox")
        .eq("is_read", false),
      admin
        .from("admin_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("is_starred", true)
        .neq("folder", "trash"),
      admin
        .from("admin_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("folder", "sent"),
      admin
        .from("admin_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("folder", "archived"),
      admin
        .from("admin_email_threads")
        .select("id", { count: "exact", head: true })
        .eq("folder", "trash"),
    ]);

  return {
    inbox: inboxRes.count ?? 0,
    unread: unreadRes.count ?? 0,
    starred: starredRes.count ?? 0,
    sent: sentRes.count ?? 0,
    archived: archivedRes.count ?? 0,
    trash: trashRes.count ?? 0,
  };
}

export async function listAdminEmailThreads(
  admin: SupabaseClient,
  options: {
    folder?: EmailFolder;
    search?: string;
    unreadOnly?: boolean;
    limit?: number;
  }
): Promise<{
  threads: AdminEmailThreadRow[];
  counts: InboxCounts;
  migrationPending: boolean;
}> {
  const folder = options.folder ?? "inbox";
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 150);

  let query = admin
    .from("admin_email_threads")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (folder === "starred") {
    query = query.eq("is_starred", true).neq("folder", "trash");
  } else {
    query = query.eq("folder", folder);
  }

  if (options.unreadOnly) {
    query = query.eq("is_read", false);
  }

  const searchClean = (options.search || "").trim().replace(/[%_,()]/g, " ");
  if (searchClean) {
    query = query.or(
      `subject.ilike.%${searchClean}%,participant_email.ilike.%${searchClean}%,participant_name.ilike.%${searchClean}%,snippet.ilike.%${searchClean}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingInboxTableError(error)) {
      return {
        threads: [],
        counts: {
          inbox: 0,
          unread: 0,
          starred: 0,
          sent: 0,
          archived: 0,
          trash: 0,
        },
        migrationPending: true,
      };
    }
    throw new Error(error.message);
  }

  const counts = await getInboxCounts(admin);
  return {
    threads: (data ?? []) as AdminEmailThreadRow[],
    counts,
    migrationPending: false,
  };
}

export async function getAdminEmailThreadDetail(
  admin: SupabaseClient,
  threadId: string,
  options?: { markRead?: boolean }
): Promise<{
  thread: AdminEmailThreadRow;
  messages: AdminEmailMessageRow[];
} | null> {
  const { data: thread, error: threadErr } = await admin
    .from("admin_email_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();

  if (threadErr) {
    throw new Error(threadErr.message);
  }
  if (!thread) return null;

  if (options?.markRead !== false && !thread.is_read) {
    await admin
      .from("admin_email_threads")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", threadId);
    thread.is_read = true;
  }

  const { data: messages, error: msgErr } = await admin
    .from("admin_email_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (msgErr) {
    throw new Error(msgErr.message);
  }

  return {
    thread: thread as AdminEmailThreadRow,
    messages: (messages ?? []) as AdminEmailMessageRow[],
  };
}

export async function replyToAdminEmailThread(
  admin: SupabaseClient,
  params: {
    threadId: string;
    bodyText: string;
    subjectOverride?: string;
    adminEmail: string;
  }
): Promise<
  | {
      ok: true;
      message: AdminEmailMessageRow;
      thread: AdminEmailThreadRow;
      resendId: string | null;
    }
  | { ok: false; status: number; error: string }
> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "RESEND_API_KEY não configurada no servidor.",
    };
  }

  const detail = await getAdminEmailThreadDetail(admin, params.threadId, {
    markRead: true,
  });
  if (!detail) {
    return { ok: false, status: 404, error: "Conversa não encontrada." };
  }

  const { thread, messages } = detail;
  if (!isValidEmailAddress(thread.participant_email)) {
    return {
      ok: false,
      status: 400,
      error: "Endereço de e-mail do destinatário inválido.",
    };
  }

  const baseSubject = (params.subjectOverride || thread.subject || "").trim();
  const replySubject = /^re:/i.test(baseSubject)
    ? baseSubject
    : `Re: ${baseSubject || "Contato Artigen"}`;

  const lastInbound = [...messages]
    .reverse()
    .find((m) => m.direction === "inbound");

  const html = buildAdminReplyEmailHtml({
    bodyText: params.bodyText,
    quotedText: lastInbound?.text_body,
    quotedAuthor:
      lastInbound?.from_name || lastInbound?.from_email || thread.participant_email,
  });

  const cleanText = params.bodyText.trim();
  const fromHeader = resolveEmailFrom();
  const summary = getEmailServiceSummary();
  const fromAddress =
    parseSenderIdentity(fromHeader).email || DEFAULT_CONTACT_TO_EMAIL;

  const extraHeaders: Record<string, string> = {};
  if (lastInbound?.rfc_message_id) {
    extraHeaders["In-Reply-To"] = lastInbound.rfc_message_id;
    extraHeaders["References"] = lastInbound.rfc_message_id;
  }

  try {
    const resend = new Resend(apiKey);
    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromHeader,
      to: [thread.participant_email],
      subject: sanitizeHeaderField(replySubject).slice(0, 200),
      html,
      text: `${cleanText}\n\n---\nEquipe ${SITE_NAME} (${summary.domain})`,
      replyTo: fromAddress,
      ...(Object.keys(extraHeaders).length > 0 ? { headers: extraHeaders } : {}),
    });

    if (sendErr) {
      return {
        ok: false,
        status: 502,
        error: sendErr.message || "Falha ao enviar resposta via Resend.",
      };
    }

    const nowIso = new Date().toISOString();
    const { data: insertedMsg, error: insertErr } = await admin
      .from("admin_email_messages")
      .insert({
        thread_id: thread.id,
        direction: "outbound",
        source: "admin_reply",
        resend_email_id: sendData?.id ? `sent:${sendData.id}` : null,
        in_reply_to: lastInbound?.rfc_message_id ?? null,
        from_email: fromAddress,
        from_name: SITE_NAME,
        to_emails: [thread.participant_email],
        cc_emails: [],
        reply_to: fromAddress,
        subject: replySubject,
        text_body: cleanText,
        html_body: html,
        attachments: [],
        sent_by_admin_email: params.adminEmail,
        created_at: nowIso,
      })
      .select("*")
      .single();

    if (insertErr) {
      throw new Error(insertErr.message);
    }

    const { data: updatedThread, error: updErr } = await admin
      .from("admin_email_threads")
      .update({
        is_read: true,
        snippet: buildSnippet(cleanText),
        message_count: thread.message_count + 1,
        last_message_at: nowIso,
        replied_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", thread.id)
      .select("*")
      .single();

    if (updErr) {
      throw new Error(updErr.message);
    }

    return {
      ok: true,
      message: insertedMsg as AdminEmailMessageRow,
      thread: updatedThread as AdminEmailThreadRow,
      resendId: sendData?.id ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Erro ao enviar resposta.",
    };
  }
}

export async function composeAdminEmail(
  admin: SupabaseClient,
  params: {
    toEmail: string;
    toName?: string;
    subject: string;
    bodyText: string;
    adminEmail: string;
  }
): Promise<
  | {
      ok: true;
      thread: AdminEmailThreadRow;
      message: AdminEmailMessageRow;
      resendId: string | null;
    }
  | { ok: false; status: number; error: string }
> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: "RESEND_API_KEY não configurada no servidor.",
    };
  }

  const toEmail = sanitizeHeaderField(params.toEmail).toLowerCase();
  if (!isValidEmailAddress(toEmail)) {
    return { ok: false, status: 400, error: "E-mail do destinatário inválido." };
  }

  const subject = sanitizeHeaderField(params.subject).slice(0, 200);
  const bodyText = params.bodyText.trim();
  if (!subject || !bodyText) {
    return {
      ok: false,
      status: 400,
      error: "Assunto e mensagem são obrigatórios.",
    };
  }

  const fromHeader = resolveEmailFrom();
  const summary = getEmailServiceSummary();
  const fromAddress =
    parseSenderIdentity(fromHeader).email || DEFAULT_CONTACT_TO_EMAIL;
  const html = buildAdminReplyEmailHtml({ bodyText });

  try {
    const resend = new Resend(apiKey);
    const { data: sendData, error: sendErr } = await resend.emails.send({
      from: fromHeader,
      to: [toEmail],
      subject,
      html,
      text: `${bodyText}\n\n---\nEquipe ${SITE_NAME} (${summary.domain})`,
      replyTo: fromAddress,
    });

    if (sendErr) {
      return {
        ok: false,
        status: 502,
        error: sendErr.message || "Falha ao enviar e-mail via Resend.",
      };
    }

    const nowIso = new Date().toISOString();
    const toName =
      sanitizeHeaderField(params.toName || "").slice(0, 120) ||
      toEmail.split("@")[0] ||
      toEmail;

    const { data: thread, error: threadErr } = await admin
      .from("admin_email_threads")
      .insert({
        subject,
        normalized_subject: normalizeEmailSubject(subject),
        participant_email: toEmail,
        participant_name: toName,
        source: "outbound",
        folder: "sent",
        is_read: true,
        is_starred: false,
        snippet: buildSnippet(bodyText),
        message_count: 1,
        last_message_at: nowIso,
        replied_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (threadErr) {
      throw new Error(threadErr.message);
    }

    const { data: message, error: msgErr } = await admin
      .from("admin_email_messages")
      .insert({
        thread_id: thread.id,
        direction: "outbound",
        source: "admin_reply",
        resend_email_id: sendData?.id ? `sent:${sendData.id}` : null,
        from_email: fromAddress,
        from_name: SITE_NAME,
        to_emails: [toEmail],
        cc_emails: [],
        reply_to: fromAddress,
        subject,
        text_body: bodyText,
        html_body: html,
        attachments: [],
        sent_by_admin_email: params.adminEmail,
        created_at: nowIso,
      })
      .select("*")
      .single();

    if (msgErr) {
      throw new Error(msgErr.message);
    }

    return {
      ok: true,
      thread: thread as AdminEmailThreadRow,
      message: message as AdminEmailMessageRow,
      resendId: sendData?.id ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "Erro ao enviar e-mail.",
    };
  }
}
