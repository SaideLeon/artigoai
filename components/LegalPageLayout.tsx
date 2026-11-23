import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Cookie,
  FileText,
  Handshake,
  Info,
  Mail,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggleButton from "@/components/ThemeToggleButton";
import CookieSettingsButton from "@/components/CookieSettingsButton";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export type LegalDocNavItem = {
  href: string;
  label: string;
  shortLabel: string;
};

export const LEGAL_DOC_LINKS: LegalDocNavItem[] = [
  { href: "/sobre", label: "Sobre o Artigen", shortLabel: "Sobre" },
  { href: "/termos-de-uso", label: "Termos de Uso", shortLabel: "Termos" },
  {
    href: "/privacidade",
    label: "Política de Privacidade (LGPD)",
    shortLabel: "Privacidade",
  },
  {
    href: "/politica-de-cookies",
    label: "Política de Cookies",
    shortLabel: "Cookies",
  },
  {
    href: "/reembolso-e-cancelamento",
    label: "Reembolso e Cancelamento",
    shortLabel: "Reembolso",
  },
  {
    href: "/termos-parceiros",
    label: "Termos de Parceiros",
    shortLabel: "Parceiros",
  },
];

export type LegalSectionAnchor = {
  id: string;
  title: string;
};

type LegalPageLayoutProps = {
  currentPath: string;
  badge: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: LegalSectionAnchor[];
  children: React.ReactNode;
};

function renderDocIcon(href: string) {
  switch (href) {
    case "/sobre":
      return <Info className="h-4 w-4 shrink-0" />;
    case "/termos-de-uso":
      return <FileText className="h-4 w-4 shrink-0" />;
    case "/privacidade":
      return <ShieldCheck className="h-4 w-4 shrink-0" />;
    case "/politica-de-cookies":
      return <Cookie className="h-4 w-4 shrink-0" />;
    case "/reembolso-e-cancelamento":
      return <RotateCcw className="h-4 w-4 shrink-0" />;
    case "/termos-parceiros":
      return <Handshake className="h-4 w-4 shrink-0" />;
    default:
      return <FileText className="h-4 w-4 shrink-0" />;
  }
}

export default function LegalPageLayout({
  currentPath,
  badge,
  title,
  subtitle,
  lastUpdated,
  sections,
  children,
}: LegalPageLayoutProps) {
  const canonicalUrl = `${SITE_URL}${currentPath}`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: `${title} — ${SITE_NAME}`,
        description: subtitle,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#organization` },
        dateModified: "2026-11-22",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: `${SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6FB] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {SITE_NAME}
            </span>
          </Link>

          <nav
            aria-label="Documentos legais"
            className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <Link
              href="/"
              className="hover:text-slate-950 hover:underline underline-offset-4 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              Início
            </Link>
            {LEGAL_DOC_LINKS.map((item) => {
              const isActive = item.href === currentPath;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? "font-semibold text-indigo-600 dark:text-indigo-400"
                      : "hover:text-slate-950 hover:underline underline-offset-4 dark:hover:text-white"
                  }`}
                >
                  {item.shortLabel}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#5B4AF4] to-[#2563EB] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:brightness-110 active:scale-[0.98] whitespace-nowrap shrink-0"
          >
            <span>Abrir Estúdio</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Breadcrumb */}
        <nav
          aria-label="Caminho de navegação"
          className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          <Link href="/" className="hover:text-slate-900 dark:hover:text-white">
            Início
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span>Transparência e Termos</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-slate-900 dark:text-slate-200">{title}</span>
        </nav>

        {/* Hero Heading */}
        <div className="mb-10 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {badge}
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-950 dark:text-white text-balance">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              Última atualização:{" "}
              <strong className="font-semibold text-slate-700 dark:text-slate-200">
                {lastUpdated}
              </strong>
            </span>
            <span>Domínio oficial: criador.artificializar.site</span>
            <span>Legislação aplicável: República Federativa do Brasil</span>
          </div>
        </div>

        {/* Two-column editorial layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Nesta página
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block rounded-lg px-2.5 py-1.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-indigo-400"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Central Legal e Confiança
              </h2>
              <ul className="mt-3 space-y-1.5">
                {LEGAL_DOC_LINKS.map((doc) => {
                  const isActive = doc.href === currentPath;
                  return (
                    <li key={doc.href}>
                      <Link
                        href={doc.href}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/60 dark:text-indigo-300"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
                        }`}
                      >
                        {renderDocIcon(doc.href)}
                        <span>{doc.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/60 p-5 text-xs leading-relaxed text-slate-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-slate-300">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Canal de Atendimento e DPO</span>
              </div>
              <p className="mt-2">
                Dúvidas sobre privacidade, direitos LGPD, faturamento via Pix/Cakto
                ou denúncias de abuso podem ser enviadas pelo formulário oficial
                ou para{" "}
                <a
                  href="mailto:contato@artificializar.site"
                  className="font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
                >
                  contato@artificializar.site
                </a>
                .
              </p>
              <Link
                href="/#contato"
                className="mt-3 inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
              >
                <span>Ir para formulário de contato</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>

          {/* Main Document Article */}
          <article className="lg:col-span-8 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-9 dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-8 text-sm sm:text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
              {children}
            </div>
          </article>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0B1124] text-slate-300">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B4AF4] to-[#2563EB] text-white">
              <BrandLogo className="size-5 text-white" />
            </span>
            <div>
              <span className="block text-sm font-bold text-white">
                {SITE_NAME}
              </span>
              <span className="block text-xs text-slate-400">
                Gerador de Artigos para Blogs com IA
              </span>
            </div>
          </div>

          <nav
            aria-label="Links institucionais e legais"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400"
          >
            <Link href="/" className="hover:text-white transition-colors whitespace-nowrap">
              Início
            </Link>
            {LEGAL_DOC_LINKS.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className={`transition-colors whitespace-nowrap ${
                  doc.href === currentPath
                    ? "text-white font-semibold"
                    : "hover:text-white"
                }`}
              >
                {doc.label}
              </Link>
            ))}
            <Link
              href="/studio"
              className="text-indigo-300 hover:text-white transition-colors whitespace-nowrap"
            >
              Estúdio
            </Link>
            <CookieSettingsButton />
          </nav>

          <div className="flex flex-wrap items-center gap-4">
            <ThemeToggleButton />
            <span className="text-xs text-slate-500">
              © 2026 {SITE_NAME}. Todos os direitos reservados.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
