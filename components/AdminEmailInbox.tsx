"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { sanitizeSandboxedEmailHtml } from "@/lib/admin-inbox";

type EmailFolder = "inbox" | "sent" | "starred" | "archived" | "trash";

type EmailAttachmentMeta = {
  id: string;
  filename: string | null;
  size: number;
  content_type: string;
};

type EmailThread = {
  id: string;
  subject: string;
  normalized_subject: string;
  participant_email: string;
  participant_name: string;
  source: "resend_inbound" | "contact_form" | "outbound";
  folder: EmailFolder;
  is_read: boolean;
  is_starred: boolean;
  snippet: string;
  message_count: number;
  last_message_at: string;
  last_inbound_at: string | null;
  replied_at: string | null;
};

type EmailMessage = {
  id: string;
  thread_id: string;
  direction: "inbound" | "outbound";
  source: "resend_inbound" | "contact_form" | "admin_reply";
  from_email: string;
  from_name: string;
  to_emails: string[];
  subject: string;
  text_body: string;
  html_body: string | null;
  attachments: EmailAttachmentMeta[];
  sent_by_admin_email: string | null;
  created_at: string;
};

type InboxCounts = {
  inbox: number;
  unread: number;
  starred: number;
  sent: number;
  archived: number;
  trash: number;
};

type AdminEmailInboxProps = {
  embeddedInStudio?: boolean;
  onUnreadCountChange?: (count: number) => void;
};

const FOLDERS: {
  id: EmailFolder;
  label: string;
  icon: typeof Inbox;
}[] = [
  { id: "inbox", label: "Entrada", icon: Inbox },
  { id: "starred", label: "Com estrela", icon: Star },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "archived", label: "Arquivados", icon: Archive },
  { id: "trash", label: "Lixeira", icon: Trash2 },
];

function formatShortTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const now = new Date();
  const sameDay =
    dt.getFullYear() === now.getFullYear() &&
    dt.getMonth() === now.getMonth() &&
    dt.getDate() === now.getDate();

  if (sameDay) {
    return dt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return dt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function formatFullDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(nameOrEmail: string): string {
  const clean = (nameOrEmail || "?").trim();
  const parts = clean.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getSourceBadge(source: EmailThread["source"]) {
  if (source === "contact_form") {
    return {
      label: "Contato do site",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70",
    };
  }
  if (source === "outbound") {
    return {
      label: "Enviado",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70",
    };
  }
  return {
    label: "E-mail recebido",
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70",
  };
}

export default function AdminEmailInbox({
  embeddedInStudio = false,
  onUnreadCountChange,
}: AdminEmailInboxProps) {
  const [folder, setFolder] = useState<EmailFolder>("inbox");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [counts, setCounts] = useState<InboxCounts>({
    inbox: 0,
    unread: 0,
    starred: 0,
    sent: 0,
    archived: 0,
    trash: 0,
  });
  const [emailService, setEmailService] = useState<{
    configured: boolean;
    domain: string;
    from: string;
  } | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);

  const [loadingList, setLoadingList] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [htmlPreviewIds, setHtmlPreviewIds] = useState<Record<string, boolean>>({});

  // Reply box
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: "ok" | "aviso" | "erro";
    text: string;
  } | null>(null);

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeName, setComposeName] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingCompose, setSendingCompose] = useState(false);

  const updateCounts = useCallback(
    (next: InboxCounts) => {
      setCounts(next);
      onUnreadCountChange?.(next.unread);
    },
    [onUnreadCountChange]
  );

  const loadThreads = useCallback(
    async (opts?: { sync?: boolean; silent?: boolean; manual?: boolean }) => {
      if (!opts?.silent) setLoadingList(true);
      setListError(null);

      try {
        const qs = new URLSearchParams({
          folder,
          ...(appliedSearch ? { search: appliedSearch } : {}),
          ...(unreadOnly ? { unread: "1" } : {}),
          ...(opts?.sync ? { sync: "1" } : {}),
        });
        const res = await fetch(`/api/admin/emails?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          erro?: string;
          threads?: EmailThread[];
          counts?: InboxCounts;
          migrationPending?: boolean;
          emailService?: { configured: boolean; domain: string; from: string };
          syncStats?: {
            syncedCount: number;
            receivingSupported?: boolean;
            error?: string;
          };
        };

        if (!res.ok || !data.ok) {
          setListError(data.erro || "Não foi possível carregar os e-mails.");
          return;
        }

        setThreads(data.threads ?? []);
        if (data.counts) updateCounts(data.counts);
        setMigrationPending(Boolean(data.migrationPending));
        if (data.emailService) setEmailService(data.emailService);

        if (opts?.sync && data.syncStats) {
          if (data.syncStats.syncedCount > 0) {
            setActionNotice({
              type: "ok",
              text: `${data.syncStats.syncedCount} novo(s) e-mail(s) sincronizado(s) da Resend.`,
            });
          } else if (
            data.syncStats.error &&
            data.syncStats.error !== "table_missing"
          ) {
            setActionNotice({
              type:
                data.syncStats.receivingSupported === false ? "aviso" : "erro",
              text: data.syncStats.error,
            });
          } else if (opts.manual) {
            setActionNotice({
              type: "ok",
              text: "Caixa atualizada com os e-mails mais recentes.",
            });
          }
        }
      } catch {
        setListError("Erro de rede ao carregar a caixa de e-mail.");
      } finally {
        setLoadingList(false);
        setSyncing(false);
      }
    },
    [folder, appliedSearch, unreadOnly, updateCounts]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        void loadThreads({ sync: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadThreads]);

  const openThread = useCallback(
    async (threadId: string) => {
      setSelectedId(threadId);
      setLoadingDetail(true);
      setActionNotice(null);
      setReplyText("");

      try {
        const res = await fetch(`/api/admin/emails/${threadId}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          erro?: string;
          thread?: EmailThread;
          messages?: EmailMessage[];
          counts?: InboxCounts;
        };
        if (!res.ok || !data.ok || !data.thread) {
          setActionNotice({
            type: "erro",
            text: data.erro || "Não foi possível abrir a conversa.",
          });
          return;
        }

        setSelectedThread(data.thread);
        setMessages(data.messages ?? []);
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, is_read: true } : t))
        );
        if (data.counts) updateCounts(data.counts);
      } catch {
        setActionNotice({
          type: "erro",
          text: "Erro de rede ao carregar conversa.",
        });
      } finally {
        setLoadingDetail(false);
      }
    },
    [updateCounts]
  );

  const deepLinkAppliedRef = useRef(false);
  useEffect(() => {
    if (deepLinkAppliedRef.current || embeddedInStudio) return;
    deepLinkAppliedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const qFolder = params.get("folder");
    const qThread = params.get("thread");

    void Promise.resolve().then(() => {
      if (
        qFolder &&
        ["inbox", "sent", "starred", "archived", "trash"].includes(qFolder)
      ) {
        setFolder(qFolder as EmailFolder);
      }
      if (qThread) {
        void openThread(qThread);
      }
    });
  }, [embeddedInStudio, openThread]);

  async function handlePatchThread(
    threadId: string,
    patch: { is_read?: boolean; is_starred?: boolean; folder?: EmailFolder }
  ) {
    try {
      const res = await fetch(`/api/admin/emails/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        thread?: EmailThread;
        counts?: InboxCounts;
      };
      if (!res.ok || !data.ok || !data.thread) {
        setActionNotice({
          type: "erro",
          text: data.erro || "Não foi possível atualizar a conversa.",
        });
        return;
      }

      if (data.counts) updateCounts(data.counts);
      const updated = data.thread;

      if (patch.folder && patch.folder !== folder) {
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (selectedId === threadId) {
          setSelectedId(null);
          setSelectedThread(null);
          setMessages([]);
        }
      } else {
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? updated : t))
        );
        if (selectedId === threadId) {
          setSelectedThread(updated);
        }
      }
    } catch {
      setActionNotice({
        type: "erro",
        text: "Erro de rede ao atualizar e-mail.",
      });
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      const res = await fetch(`/api/admin/emails/${threadId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        counts?: InboxCounts;
      };
      if (!res.ok || !data.ok) {
        setActionNotice({
          type: "erro",
          text: data.erro || "Não foi possível excluir a conversa.",
        });
        return;
      }

      if (data.counts) updateCounts(data.counts);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (selectedId === threadId) {
        setSelectedId(null);
        setSelectedThread(null);
        setMessages([]);
      }
      setActionNotice({
        type: "ok",
        text:
          folder === "trash"
            ? "Conversa excluída definitivamente."
            : "Conversa movida para a lixeira.",
      });
    } catch {
      setActionNotice({
        type: "erro",
        text: "Erro de rede ao excluir conversa.",
      });
    }
  }

  async function handleSendReply(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selectedThread || replyText.trim().length < 2 || sendingReply) return;

    setSendingReply(true);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/admin/emails/${selectedThread.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: replyText.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        message?: EmailMessage;
        thread?: EmailThread;
        counts?: InboxCounts;
      };

      if (!res.ok || !data.ok || !data.message || !data.thread) {
        setActionNotice({
          type: "erro",
          text: data.erro || "Falha ao enviar resposta.",
        });
        return;
      }

      setReplyText("");
      setMessages((prev) => [...prev, data.message!]);
      setSelectedThread(data.thread);
      setThreads((prev) =>
        prev.map((t) => (t.id === data.thread!.id ? data.thread! : t))
      );
      if (data.counts) updateCounts(data.counts);
      setActionNotice({
        type: "ok",
        text: `Resposta enviada para ${selectedThread.participant_email}!`,
      });
    } catch {
      setActionNotice({
        type: "erro",
        text: "Erro de rede ao enviar resposta.",
      });
    } finally {
      setSendingReply(false);
    }
  }

  async function handleComposeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sendingCompose) return;
    setSendingCompose(true);
    setActionNotice(null);

    try {
      const res = await fetch("/api/admin/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: composeTo.trim(),
          toName: composeName.trim(),
          subject: composeSubject.trim(),
          bodyText: composeBody.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        erro?: string;
        thread?: EmailThread;
        message?: EmailMessage;
        counts?: InboxCounts;
      };
      if (!res.ok || !data.ok || !data.thread) {
        setActionNotice({
          type: "erro",
          text: data.erro || "Não foi possível enviar o e-mail.",
        });
        return;
      }

      setComposeOpen(false);
      setComposeTo("");
      setComposeName("");
      setComposeSubject("");
      setComposeBody("");
      if (data.counts) updateCounts(data.counts);
      setFolder("sent");
      setSelectedId(data.thread.id);
      setSelectedThread(data.thread);
      setMessages(data.message ? [data.message] : []);
      setActionNotice({
        type: "ok",
        text: `E-mail enviado com sucesso para ${data.thread.participant_email}!`,
      });
    } catch {
      setActionNotice({
        type: "erro",
        text: "Erro de rede ao enviar novo e-mail.",
      });
    } finally {
      setSendingCompose(false);
    }
  }

  const folderCountsMap = useMemo(
    () => ({
      inbox: counts.inbox,
      starred: counts.starred,
      sent: counts.sent,
      archived: counts.archived,
      trash: counts.trash,
    }),
    [counts]
  );

  return (
    <section
      className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 ${
        embeddedInStudio
          ? "max-h-[80vh] xl:h-full xl:max-h-none"
          : "min-h-[76vh]"
      }`}
    >
      {/* Top Gmail-like Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 sm:px-5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white shadow-xs">
            <Mail className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Caixa de E-mail Artigen
              </h2>
              {counts.unread > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                  {counts.unread} {counts.unread === 1 ? "novo" : "novos"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {emailService?.from ?? "Artigen <contato@artificializar.site>"} ·{" "}
              {emailService?.configured ? "Resend conectado" : "Resend pendente"}
            </p>
          </div>
        </div>

        {/* Search + Actions */}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 min-w-[240px]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedSearch(searchInput.trim());
            }}
            className="relative flex-1 max-w-sm min-w-[180px]"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value.trim() && appliedSearch) {
                  setAppliedSearch("");
                }
              }}
              placeholder="Buscar por cliente, e-mail ou assunto..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-xs text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setAppliedSearch("");
                }}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              unreadOnly
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            Não lidos
          </button>

          <button
            type="button"
            onClick={() => {
              setSyncing(true);
              void loadThreads({ sync: true, silent: true, manual: true });
            }}
            disabled={syncing || loadingList}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:brightness-110"
          >
            <SquarePen className="h-3.5 w-3.5" />
            <span>Escrever</span>
          </button>

          {embeddedInStudio && (
            <Link
              href="/admin/parceiros"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/70 dark:bg-indigo-950/50 dark:text-indigo-300"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Área Admin</span>
            </Link>
          )}
        </div>
      </div>

      {/* Notices */}
      {migrationPending && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          Para ativar o histórico persistente da caixa de entrada, execute o script{" "}
          <code className="font-mono font-semibold">
            supabase/15_admin_email_inbox.sql
          </code>{" "}
          no SQL Editor do Supabase.
        </div>
      )}

      {actionNotice && (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 border-b px-5 py-2 text-xs font-medium ${
            actionNotice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              : actionNotice.type === "aviso"
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          }`}
        >
          <span className="flex items-center gap-1.5">
            {actionNotice.type === "ok" && (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            {actionNotice.text}
          </span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-[11px] underline underline-offset-2"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main 3-Pane Gmail Workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[190px_340px_minmax(0,1fr)]">
        {/* Left Folder Rail */}
        <nav
          aria-label="Pastas da caixa de e-mail"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200/80 bg-slate-50/70 p-2 lg:flex-col lg:border-b-0 lg:border-r lg:p-3 dark:border-slate-800 dark:bg-slate-950/40"
        >
          {FOLDERS.map((item) => {
            const Icon = item.icon;
            const active = folder === item.id;
            const badge =
              item.id === "inbox" ? counts.unread : folderCountsMap[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setFolder(item.id);
                  setSelectedId(null);
                  setSelectedThread(null);
                  setMessages([]);
                }}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : item.id === "inbox" && counts.unread > 0
                        ? "bg-rose-500 text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Thread List */}
        <div
          className={`studio-scroll min-h-0 overflow-y-auto border-b border-slate-200/80 lg:border-b-0 lg:border-r dark:border-slate-800 ${
            selectedId ? "hidden lg:block" : "block"
          }`}
        >
          {loadingList ? (
            <div className="flex flex-col items-center justify-center py-16 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="mt-2">Carregando mensagens...</span>
            </div>
          ) : listError ? (
            <div className="p-6 text-center text-xs text-rose-600 dark:text-rose-400">
              {listError}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <MailOpen className="h-9 w-9 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Nenhuma mensagem nesta pasta
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Mensagens do formulário de contato e e-mails enviados para{" "}
                <span className="font-medium">contato@artificializar.site</span>{" "}
                aparecem aqui automaticamente.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {threads.map((thread) => {
                const isSelected = selectedId === thread.id;
                const badge = getSourceBadge(thread.source);
                return (
                  <li key={thread.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => void openThread(thread.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void openThread(thread.id);
                        }
                      }}
                      className={`group flex cursor-pointer items-start gap-2.5 px-3.5 py-3 transition-colors ${
                        isSelected
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50"
                          : !thread.is_read
                          ? "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60"
                          : "bg-slate-50/40 hover:bg-slate-100/70 dark:bg-slate-900/60 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePatchThread(thread.id, {
                            is_starred: !thread.is_starred,
                          });
                        }}
                        aria-label={
                          thread.is_starred
                            ? "Remover estrela"
                            : "Marcar com estrela"
                        }
                        className="mt-0.5 shrink-0 text-slate-300 hover:text-amber-400 dark:text-slate-600"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            thread.is_starred
                              ? "fill-amber-400 text-amber-400"
                              : ""
                          }`}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            {!thread.is_read && (
                              <span
                                aria-label="Não lido"
                                className="h-2 w-2 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400"
                              />
                            )}
                            <span
                              className={`truncate text-xs ${
                                !thread.is_read
                                  ? "font-bold text-slate-950 dark:text-white"
                                  : "font-medium text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {thread.participant_name || thread.participant_email}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {formatShortTime(thread.last_message_at)}
                          </span>
                        </div>

                        <p
                          className={`mt-0.5 truncate text-xs ${
                            !thread.is_read
                              ? "font-semibold text-slate-900 dark:text-slate-100"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {thread.subject}
                        </p>

                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {thread.snippet}
                        </p>

                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          {thread.message_count > 1 && (
                            <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                              {thread.message_count} msgs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Reading Pane + Direct Inline Reply */}
        <div
          className={`flex min-h-0 flex-col bg-slate-50/40 dark:bg-slate-950/30 ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-400">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Selecione uma conversa para ler e responder
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Suas respostas são enviadas diretamente de{" "}
                <strong className="font-semibold">
                  contato@artificializar.site
                </strong>{" "}
                para o e-mail do cliente mantendo o histórico agrupado.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="flex flex-1 items-center justify-center py-16 text-xs text-slate-500 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            </div>
          ) : selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setSelectedThread(null);
                    }}
                    aria-label="Voltar para a lista"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {selectedThread.subject}
                    </h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {selectedThread.participant_name} &lt;
                      {selectedThread.participant_email}&gt;
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void handlePatchThread(selectedThread.id, {
                        is_read: !selectedThread.is_read,
                      })
                    }
                    title={
                      selectedThread.is_read
                        ? "Marcar como não lido"
                        : "Marcar como lido"
                    }
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {selectedThread.is_read ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <MailOpen className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handlePatchThread(selectedThread.id, {
                        is_starred: !selectedThread.is_starred,
                      })
                    }
                    title="Estrela"
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        selectedThread.is_starred
                          ? "fill-amber-400 text-amber-400"
                          : ""
                      }`}
                    />
                  </button>

                  {selectedThread.folder !== "archived" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handlePatchThread(selectedThread.id, {
                          folder: "archived",
                        })
                      }
                      title="Arquivar"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void handlePatchThread(selectedThread.id, {
                          folder: "inbox",
                        })
                      }
                      title="Mover para Entrada"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Entrada
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleDeleteThread(selectedThread.id)}
                    title={
                      folder === "trash"
                        ? "Excluir definitivamente"
                        : "Mover para lixeira"
                    }
                    className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Chronological Messages */}
              <div className="studio-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                {messages.map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  const showHtml = Boolean(htmlPreviewIds[msg.id]);
                  return (
                    <article
                      key={msg.id}
                      className={`rounded-2xl border p-4 shadow-2xs ${
                        isOutbound
                          ? "border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/25"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              isOutbound
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {getInitials(msg.from_name || msg.from_email)}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {msg.from_name || msg.from_email}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                &lt;{msg.from_email}&gt;
                              </span>
                              {isOutbound && (
                                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                  Respondido por Artigen
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Para:{" "}
                              {msg.to_emails.length > 0
                                ? msg.to_emails.join(", ")
                                : "contato@artificializar.site"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {msg.html_body && (
                            <button
                              type="button"
                              onClick={() =>
                                setHtmlPreviewIds((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }))
                              }
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {showHtml ? "Ver texto simples" : "Ver HTML"}
                            </button>
                          )}
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {formatFullDate(msg.created_at)}
                          </span>
                        </div>
                      </div>

                      {showHtml && msg.html_body ? (
                        <iframe
                          title={`Conteúdo HTML da mensagem ${msg.id}`}
                          sandbox=""
                          referrerPolicy="no-referrer"
                          srcDoc={sanitizeSandboxedEmailHtml(msg.html_body)}
                          className="mt-3 h-72 w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700"
                        />
                      ) : (
                        <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                          {msg.text_body}
                        </div>
                      )}

                      {Array.isArray(msg.attachments) &&
                        msg.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                            {msg.attachments.map((att, idx) => (
                              <span
                                key={`${att.id}-${idx}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                <Paperclip className="h-3 w-3" />
                                <span>{att.filename || "anexo"}</span>
                                {att.size > 0 && (
                                  <span className="text-slate-400">
                                    ({formatBytes(att.size)})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>

              {/* Direct Inline Reply Composer */}
              <form
                onSubmit={handleSendReply}
                className="shrink-0 border-t border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Responder para{" "}
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedThread.participant_email}
                    </strong>
                  </span>
                  <span className="text-[11px]">
                    Enviado via {emailService?.from ?? "contato@artificializar.site"}
                  </span>
                </div>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleSendReply();
                    }
                  }}
                  rows={3}
                  placeholder="Escreva sua resposta ao cliente aqui... (Ctrl+Enter para enviar)"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    A resposta fica salva nesta conversa e vai direto ao e-mail do cliente.
                  </span>
                  <button
                    type="submit"
                    disabled={sendingReply || replyText.trim().length < 2}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:brightness-110 disabled:opacity-50"
                  >
                    {sendingReply ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {sendingReply ? "Enviando..." : "Enviar resposta"}
                    </span>
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </div>
      </div>

      {/* Compose New Email Modal */}
      {composeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compose-email-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          onClick={() => setComposeOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SquarePen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3
                  id="compose-email-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Novo E-mail (Artigen)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Para (e-mail do cliente)
                  </label>
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="cliente@exemplo.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nome (opcional)
                  </label>
                  <input
                    type="text"
                    value={composeName}
                    onChange={(e) => setComposeName(e.target.value)}
                    placeholder="Nome do destinatário"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assunto
                </label>
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Ex.: Atendimento Artigen sobre sua assinatura"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mensagem
                </label>
                <textarea
                  required
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Escreva a mensagem que será enviada de contato@artificializar.site..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingCompose}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {sendingCompose ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>{sendingCompose ? "Enviando..." : "Enviar e-mail"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
