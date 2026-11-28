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

export type PlanoGeracao = "free" | "paid";

export type ModoPesquisa = "auto" | "sempre" | "desativada";

export type EstiloImagemId =
  | "editorial-flat"
  | "fotografia-realista"
  | "realismo-cinematografico"
  | "render-3d-moderno"
  | "aquarela-editorial"
  | "minimalista-geometrico";

export type EstiloImagemOpcao = {
  id: EstiloImagemId;
  label: string;
  descricao: string;
  swatches: [string, string, string];
  promptPrefix: string;
  sectionHint: string;
};

export const DEFAULT_ESTILO_IMAGEM: EstiloImagemId = "editorial-flat";

export const ESTILOS_IMAGEM: EstiloImagemOpcao[] = [
  {
    id: "editorial-flat",
    label: "Ilustração Editorial (Padrão)",
    descricao:
      "Traço limpo com paleta azul-petróleo e areia, ideal para guias e blogs modernos.",
    swatches: ["#0F766E", "#E6D5B8", "#1E293B"],
    promptPrefix:
      "Flat editorial illustration, muted teal and sand palette, clean modern composition, balanced depth, strictly no text, no letters, no numbers, no watermarks. ",
    sectionHint:
      "Descreve uma cena de ilustração editorial moderna e limpa em inglês, sem pedir texto escrito na imagem.",
  },
  {
    id: "fotografia-realista",
    label: "Fotografia Realista",
    descricao:
      "Fotos naturais em alta definição com iluminação de estúdio ou luz do dia.",
    swatches: ["#334155", "#CBD5E1", "#D97706"],
    promptPrefix:
      "High-resolution photorealistic editorial photography, natural daylight or soft studio lighting, authentic textures, 35mm DSLR shallow depth of field, realistic skin and material tones, strictly no text, no letters, no numbers, no watermarks. ",
    sectionHint:
      "Descreve uma cena fotográfica realista e autêntica em inglês (enquadramento, sujeito, ambiente e luz natural), sem pedir texto escrito na imagem.",
  },
  {
    id: "realismo-cinematografico",
    label: "Realismo Cinematográfico",
    descricao:
      "Atmosfera dramática, contraste refinado e estética de cinema contemporâneo.",
    swatches: ["#0F172A", "#F59E0B", "#0284C7"],
    promptPrefix:
      "Cinematic photorealistic scene, atmospheric golden hour or moody studio lighting, anamorphic depth, rich editorial color grading, ultra-detailed realism, strictly no text, no letters, no numbers, no watermarks. ",
    sectionHint:
      "Descreve uma cena cinematográfica realista com atmosfera e iluminação marcante em inglês, sem pedir texto escrito na imagem.",
  },
  {
    id: "render-3d-moderno",
    label: "3D Minimalista & Tech",
    descricao:
      "Objetos 3D suaves com acabamento fosco para SaaS, tecnologia e negócios.",
    swatches: ["#5B4AF4", "#60A5FA", "#E0E7FF"],
    promptPrefix:
      "Minimalist 3D isometric render, smooth matte clay and frosted glass materials, soft ambient occlusion studio lighting, clean indigo and sky accents, modern tech aesthetic, strictly no text, no letters, no numbers, no watermarks. ",
    sectionHint:
      "Descreve uma composição 3D minimalista com objetos simbólicos em inglês, sem pedir texto escrito na imagem.",
  },
  {
    id: "aquarela-editorial",
    label: "Aquarela & Arte Orgânica",
    descricao:
      "Pinceladas suaves em papel texturizado para cultura, saúde e bem-estar.",
    swatches: ["#EA580C", "#10B981", "#FEF3C7"],
    promptPrefix:
      "Contemporary watercolor and fine ink editorial artwork on textured cotton paper, expressive soft brush strokes, warm natural pigment washes, refined composition, strictly no text, no letters, no numbers, no watermarks. ",
    sectionHint:
      "Descreve uma cena artística em aquarela editorial em inglês, sem pedir texto escrito na imagem.",
  },
  {
    id: "minimalista-geometrico",
    label: "Minimalista Geométrico",
    descricao:
      "Formas modernas e alto contraste visual para finanças, análise e estratégia.",
    swatches: ["#1D4ED8", "#DC2626", "#F8FAFC"],
    promptPrefix:
      "Bold minimalist geometric editorial artwork, crisp architectural forms, generous negative space, refined cobalt, terracotta and off-white palette, strictly no text, no letters, no numbers, no watermarks. ",
    sectionHint:
      "Descreve uma metáfora visual geométrica e minimalista em inglês, sem pedir texto escrito na imagem.",
  },
];

export function isValidEstiloImagemId(value: unknown): value is EstiloImagemId {
  return (
    typeof value === "string" &&
    ESTILOS_IMAGEM.some((style) => style.id === value)
  );
}

export function getEstiloImagemConfig(value?: unknown): EstiloImagemOpcao {
  if (typeof value === "string") {
    const found = ESTILOS_IMAGEM.find((s) => s.id === value);
    if (found) return found;
  }
  return ESTILOS_IMAGEM[0];
}

export type FontePesquisa = {
  titulo: string;
  url: string;
  tipo?: "primaria" | "secundaria";
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
  estiloImagemPadrao?: EstiloImagemId;
  primeiraPessoaPadrao?: boolean;
  pesquisaWebPadrao?: ModoPesquisa;
};

export type NavTab =
  | "inicio"
  | "artigos"
  | "favoritos"
  | "estatisticas"
  | "configuracoes"
  | "emails";

export type WorkspaceTab = "previa" | "editor" | "seo";

export type NotificacaoItem = {
  id: string;
  titulo: string;
  detalhe: string;
  hora: string;
  lida: boolean;
};
