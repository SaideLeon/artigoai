export type Secao = {
  titulo: string;
  objetivo: string;
  texto?: string;
  prompt?: string;
  img?: string;
  erro?: string;
  aGerarImagem?: boolean;
};

export type FaixaPalavrasId = "800-1200" | "1200-1800" | "2000-2500" | "2500-3200";

export type FaixaPalavrasOpcao = {
  id: FaixaPalavrasId;
  label: string;
  alvoPalavras: number;
  numSecoes: number;
};

export const FAIXAS_PALAVRAS: FaixaPalavrasOpcao[] = [
  {
    id: "800-1200",
    label: "800 – 1.200 palavras",
    alvoPalavras: 1050,
    numSecoes: 4,
  },
  {
    id: "1200-1800",
    label: "1.200 – 1.800 palavras",
    alvoPalavras: 1550,
    numSecoes: 5,
  },
  {
    id: "2000-2500",
    label: "2.000 – 2.500 palavras",
    alvoPalavras: 2300,
    numSecoes: 7,
  },
  {
    id: "2500-3200",
    label: "2.500 – 3.200 palavras",
    alvoPalavras: 2850,
    numSecoes: 8,
  },
];

export const TONS_TEXTO = [
  "Informativo e Didático",
  "Notícia e Atualidade",
  "Jornalístico e Analítico",
  "Profissional e Corporativo",
  "Conversacional e Acessível",
  "Persuasivo e Marketing",
] as const;

export type ModoPesquisa = "auto" | "sempre" | "desativada";

export type FontePesquisa = {
  titulo: string;
  url: string;
};

export const IDIOMAS = [
  { id: "Português (Brasil)", label: "Português (Brasil)", codigo: "pt-BR" },
  { id: "Português (Portugal)", label: "Português (Portugal)", codigo: "pt-PT" },
  { id: "English", label: "English", codigo: "en" },
  { id: "Español", label: "Español", codigo: "es" },
  { id: "Français", label: "Français", codigo: "fr" },
] as const;

export type ArtigoSalvo = {
  id: string;
  tema: string;
  titulo: string;
  descricao: string;
  palavrasChave: string[];
  tom: string;
  idioma: string;
  faixaPalavras: FaixaPalavrasId;
  primeiraPessoa?: boolean;
  pesquisaUsada?: boolean;
  fontes?: FontePesquisa[];
  secoes: Secao[];
  criadoEm: string;
  favorito: boolean;
  totalPalavras: number;
};

export type ConfiguracoesPadrao = {
  tomPadrao: string;
  idiomaPadrao: string;
  faixaPalavrasPadrao: FaixaPalavrasId;
  incluirImagensPadrao: boolean;
  primeiraPessoaPadrao?: boolean;
  pesquisaWebPadrao?: ModoPesquisa;
};

export type NavTab =
  | "inicio"
  | "artigos"
  | "favoritos"
  | "estatisticas"
  | "configuracoes";

export type WorkspaceTab = "previa" | "editor" | "seo";

export type NotificacaoItem = {
  id: string;
  titulo: string;
  detalhe: string;
  hora: string;
  lida: boolean;
};
