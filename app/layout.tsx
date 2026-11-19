import "./globals.css";

export const metadata = {
  title: "Gerador de artigos",
  description: "Artigos longos com uma imagem por secção",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
