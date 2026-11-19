# artigoai

Aplicação web (Next.js) que gera artigos com mais de 2000 palavras e uma imagem para cada secção, usando modelos do OpenRouter.

## Como funciona

1. `/api/outline` cria o título e as secções do artigo.
2. `/api/section` escreve uma secção de cada vez, sabendo o que já foi escrito.
3. `/api/image` gera a imagem de cada secção com um estilo visual fixo.

A página coordena os passos, mostra a contagem de palavras e permite descarregar o artigo em HTML.

## Executar

```bash
npm install
cp .env.local.example .env.local   # colocar a chave em OPENROUTER_API_KEY
npm run dev
```

Abrir http://localhost:3000.

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `OPENROUTER_API_KEY` | Chave da API do OpenRouter (só usada no servidor) |
| `TEXT_MODEL` | Modelo de texto (padrão: `openrouter/free`) |
| `IMAGE_MODEL` | Modelo de imagem (padrão: `sourceful/riverflow-v2.5-fast:free`) |
