import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Source_Serif_4,
  JetBrains_Mono,
} from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { BrandLogoDefs } from "@/components/BrandLogo";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Gerador de Artigos — Estúdio de Conteúdo com IA",
  description:
    "Crie artigos longos, bem estruturados e ilustrados secção a secção com auxílio de inteligência artificial.",
  icons: {
    icon: "/logo.svg",
  },
};

const themeInitScript = `
(function() {
  try {
    var saved = localStorage.getItem("artigoai:theme:v1");
    var isDark = saved === "dark" || (!saved && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-[#F4F6FB] text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased transition-colors duration-150">
        <BrandLogoDefs />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
