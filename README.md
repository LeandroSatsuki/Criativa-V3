# Criativa Field Ops

Sistema operacional de campo para promotores da Criativa.

## Rodar localmente

**Pré-requisitos:** Node.js

1. Instale as dependências:
   `npm install`
2. Copie [.env.example](.env.example) para `.env.local` e preencha as variáveis necessárias.
3. Inicie o app:
   `npm run dev`

## Rodar com backend local

Para testar frontend + funções serverless no mesmo ambiente:

1. Configure as variáveis de backend.
2. Inicie com:
   `npm run dev:full`

O comando usa `netlify dev` por baixo e expõe as rotas em `/api/*`.

## Variáveis de ambiente

- `VITE_APP_TITLE`
- `VITE_API_BASE_URL`
- `VITE_DEFAULT_INDUSTRIES`

### Backend

- `APP_SESSION_SECRET`
- `BACKEND_GOOGLE_SHEETS_ID`
- `BACKEND_MAKE_WEBHOOK_URL`
- `BACKEND_GEMINI_API_KEY`

## Observações

- A Fase 1 centraliza a configuração em variáveis de ambiente.
- A Fase 2 moveu as integrações sensíveis para Netlify Functions.
- A Fase 3 adiciona fila local persistida e retry de sincronização.
- A Fase 6 mantém a análise de imagem no backend e persiste o resultado quando possível.
- O frontend agora fala apenas com `/api/*`.
