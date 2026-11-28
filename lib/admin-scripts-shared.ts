export type ScriptCreationMode = "curso_modulo" | "video_leads";

export type VideoDurationPreset = "short_60s" | "direto_3_5m" | "completo_8_12m";

export type LeadGoalPreset =
  | "teste_gratis_studio"
  | "assinatura_planos"
  | "programa_parceiros";

export type GeminiTtsVoiceName =
  | "Kore"
  | "Puck"
  | "Charon"
  | "Fenrir"
  | "Zephyr";

export type GeminiTtsModelId =
  | "gemini-3.8-flash-lite-tts"
  | "gemini-3.8-flash-tts";

export type ScriptSceneCue = {
  ordem: number;
  tempoEstimado: string;
  telaRota: string;
  acaoNaTela: string;
  locucao: string;
};

export type GeneratedYoutubeScript = {
  id: string;
  modo: ScriptCreationMode;
  numeroModulo?: number;
  tituloModulo: string;
  resumoAula: string;
  hookInicial: string;
  cenasGravacao: ScriptSceneCue[];
  textoNarracaoPuro: string;
  titulosYoutube: string[];
  descricaoYoutube: string;
  comentarioFixado: string;
  tagsYoutube: string[];
  idioma: string;
  duracao: VideoDurationPreset;
  criadoEm: string;
  modeloTexto?: string;
};

export type CourseModuleBlueprint = {
  numero: number;
  titulo: string;
  focoTela: string;
  objetivo: string;
};

export const OFFICIAL_COURSE_MODULES: CourseModuleBlueprint[] = [
  {
    numero: 1,
    titulo:
      "Módulo 1: Primeiros Passos no Artigen — Crie Artigos Completos em Minutos",
    focoTela:
      "Página inicial (/) -> /studio -> Menu lateral, Tema Claro/Escuro e Mascote Mulébi (/mascote)",
    objetivo:
      "Apresentar o Artigen, mostrar que visitantes podem testar grátis sem cadastro (2 artigos e 14 imagens/mês) e explicar a organização do Estúdio.",
  },
  {
    numero: 2,
    titulo:
      "Módulo 2: Método 1 — Gerando Artigos do Zero pelo Título + IA de Sugestão",
    focoTela:
      "/studio -> Painel esquerdo -> Campo Tema + Botão 'Sugerir opções com IA' + Tons, Idiomas e Pesquisa Web",
    objetivo:
      "Ensinar como digitar apenas um título, deixar a IA sugerir palavras-chave, descrição e extensão (800 a 3.200 palavras) e gerar o artigo completo.",
  },
  {
    numero: 3,
    titulo:
      "Módulo 3: Método 2 — Criando Artigos a Partir dos Seus Links (Fonte Primária)",
    focoTela:
      "/studio -> Links de Referência (até 5 URLs) -> Badges 'Fonte primária' vs 'Apoio secundário'",
    objetivo:
      "Mostrar como fornecer até 5 URLs próprias para o Artigen ler primeiro como Fonte Primária sem inventar fatos, usando a web apenas como apoio secundário.",
  },
  {
    numero: 4,
    titulo:
      "Módulo 4: Método 3 — Narração por Voz: Fale Sua Ideia e Vire Artigo",
    focoTela:
      "/studio -> Botão 'Explicar tema por voz' -> VoiceNarrationModal (gravação ao vivo ou upload até 24 MB)",
    objetivo:
      "Demonstrar a gravação ao vivo ou envio de áudio, transcrição automática, organização em parágrafos estruturados mantendo a voz do autor e geração automática.",
  },
  {
    numero: 5,
    titulo:
      "Módulo 5: Escolhendo Entre os 6 Estilos de Imagem e Entendendo as Cotas",
    focoTela:
      "/studio -> Seletor 'Design das imagens do artigo' e Configurações -> 6 estilos visuais",
    objetivo:
      "Apresentar os 6 estilos (Ilustração Editorial, Fotografia Realista, Realismo Cinematográfico, 3D Minimalista & Tech, Aquarela e Minimalista Geométrico) e a regra de 7 imagens por artigo.",
  },
  {
    numero: 6,
    titulo:
      "Módulo 6: Edição Ao Vivo, Pré-visualização de Imagens, Auditoria SEO e HTML Limpo",
    focoTela:
      "/studio -> Área de Trabalho -> Abas 'Prévia', 'Editor' (pré-visualização e regeneração de imagem), 'SEO' e 'Baixar HTML'",
    objetivo:
      "Ensinar a revisar o artigo, editar prompts e regenerar imagens com pré-visualização ao vivo no Editor, conferir os 5 critérios SEO e exportar HTML pronto para publicar.",
  },
  {
    numero: 7,
    titulo:
      "Módulo 7: Estatísticas, Planos em Real (Cakto) e Programa de Parceiros",
    focoTela:
      "/studio -> Aba Estatísticas -> Planos (Grátis, Starter, Pro, Agência) -> /parceiro",
    objetivo:
      "Explicar o painel de métricas, os planos em Real via Pix/Cartão/Boleto na Cakto e como parceiros ganham comissões recorrentes de 20% a 35%.",
  },
  {
    numero: 8,
    titulo:
      "Módulo 8: Fluxo Completo do Zero à Publicação no Blog (Caso Prático Real)",
    focoTela:
      "/studio completo do início ao arquivo .html baixado e aberto no navegador/CMS",
    objetivo:
      "Unir pesquisa web, escolha de tom/primeira pessoa, geração seção a seção, revisão SEO, download em HTML limpo e chamada final para ação levando tráfego ao site.",
  },
];

export const YOUTUBE_LEAD_PRESETS: Array<{
  label: string;
  tema: string;
  objetivo: LeadGoalPreset;
  duracao: VideoDurationPreset;
}> = [
  {
    label: "Artigo SEO em 3 min (Sem Cadastro)",
    tema: "Como criar um artigo completo de blog com pesquisa real e imagens em menos de 3 minutos sem precisar de cadastro",
    objetivo: "teste_gratis_studio",
    duracao: "direto_3_5m",
  },
  {
    label: "Links Próprios como Fonte Primária",
    tema: "Como transformar seus próprios links e notícias em artigos completos de blog sem a IA inventar informações",
    objetivo: "teste_gratis_studio",
    duracao: "direto_3_5m",
  },
  {
    label: "Falar por Voz e Virar Artigo",
    tema: "Pare de travar na página em branco: grave um áudio falando suas ideias e gere um artigo SEO pronto",
    objetivo: "teste_gratis_studio",
    duracao: "short_60s",
  },
  {
    label: "Comparando os 6 Estilos de Imagem",
    tema: "Ilustração Editorial, Fotografia Realista ou 3D Tech? Veja como gerar imagens automáticas para cada seção do seu blog",
    objetivo: "assinatura_planos",
    duracao: "direto_3_5m",
  },
  {
    label: "Renda Recorrente com Parceiros",
    tema: "Como funciona o Programa de Parceiros Artigen para criadores ganharem de 20% a 35% recorrentes",
    objetivo: "programa_parceiros",
    duracao: "completo_8_12m",
  },
];

export const GEMINI_TTS_VOICES: Array<{
  id: GeminiTtsVoiceName;
  label: string;
  perfil: string;
}> = [
  {
    id: "Kore",
    label: "Kore — Clara & Profissional",
    perfil:
      "Apresentadora nítida, ótima para tutoriais e vídeos educativos no YouTube",
  },
  {
    id: "Puck",
    label: "Puck — Dinâmica & Envolvente",
    perfil: "Energia alta e conversacional, ideal para ganchos, Shorts e retenção",
  },
  {
    id: "Charon",
    label: "Charon — Grave & Autoritativa",
    perfil: "Tom firme e confiável para demonstrações B2B, agências e análises",
  },
  {
    id: "Fenrir",
    label: "Fenrir — Expressiva & Direta",
    perfil: "Presença marcante para vídeos de conversão e chamadas para ação",
  },
  {
    id: "Zephyr",
    label: "Zephyr — Suave & Didática",
    perfil:
      "Ritmo calmo e acolhedor para módulos longos de curso passo a passo",
  },
];

export const GEMINI_TTS_MODELS: Array<{
  id: GeminiTtsModelId;
  label: string;
  detalhe: string;
}> = [
  {
    id: "gemini-3.8-flash-lite-tts",
    label: "Gemini 3.8 Flash Lite TTS (Padrão)",
    detalhe: "Baixa latência e alta eficiência para locução contínua de roteiros",
  },
  {
    id: "gemini-3.8-flash-tts",
    label: "Gemini 3.8 Flash TTS (Voice Design)",
    detalhe:
      "Maior expressividade e controle de estilo vocal para roteiros elaborados",
  },
];

export const TTS_STYLE_PRESETS = [
  "Apresentador claro, entusiasta e didático de canal de tecnologia no YouTube",
  "Instrutor calmo e objetivo de curso online explicando passo a passo na tela",
  "Locução dinâmica, ritmo ágil e persuasivo para vídeo de captação de leads",
  "Tom conversacional natural e próximo, como criador compartilhando ferramenta útil",
] as const;

/**
 * Remove marcações cênicas, colchetes, markdown e instruções visuais
 * para deixar o texto 100% pronto para copiar/colar em qualquer IA de voz (TTS).
 */
export function sanitizeForTtsNarration(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:cena|tela|corte|pausa|música|som|b-roll|zoom)[^)]*\)/gi, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+)_{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function estimateSpeechSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 138) * 60));
}

export function formatDurationMmSs(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.max(0, Math.round(seconds % 60));
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function splitTextForTts(rawText: string, maxChunkChars = 1200): string[] {
  const cleaned = sanitizeForTtsNarration(rawText);
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkChars) return [cleaned];

  const paragraphs = cleaned
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  for (const para of paragraphs) {
    if (para.length <= maxChunkChars) {
      if ((current + "\n\n" + para).trim().length <= maxChunkChars) {
        current = current ? `${current}\n\n${para}` : para;
      } else {
        pushCurrent();
        current = para;
      }
      continue;
    }

    const sentences = para.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [para];
    for (const sentenceRaw of sentences) {
      const sentence = sentenceRaw.trim();
      if (!sentence) continue;

      if (sentence.length > maxChunkChars) {
        pushCurrent();
        for (let i = 0; i < sentence.length; i += maxChunkChars) {
          chunks.push(sentence.slice(i, i + maxChunkChars).trim());
        }
        continue;
      }

      if ((current + " " + sentence).trim().length <= maxChunkChars) {
        current = current ? `${current} ${sentence}` : sentence;
      } else {
        pushCurrent();
        current = sentence;
      }
    }
  }

  pushCurrent();
  return chunks;
}
