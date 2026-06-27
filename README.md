# Criativa Field Ops

Sistema operacional de campo para promotores da Criativa.

## Rodar localmente

**Pré-requisitos:** Node.js

1. Instale as dependências:
   `npm install`
2. Copie [.env.example](.env.example) para `.env.local` e preencha as variáveis necessárias.
3. Inicie o app:
   `npm run dev`

## Variáveis de ambiente

- `VITE_APP_TITLE`
- `VITE_GOOGLE_SHEETS_ID`
- `VITE_MAKE_WEBHOOK_URL`
- `VITE_GEMINI_API_KEY`
- `VITE_DEFAULT_INDUSTRIES`

## Observações

- A Fase 1 centraliza a configuração em variáveis de ambiente.
- A Fase 2 vai mover integrações sensíveis para um backend seguro, reduzindo a exposição no cliente.
