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

## Publicacao

O projeto foi publicado no Netlify com o frontend Vite preservado e as rotas backend em `/api/*`.

- frontend Vite mantido como esta;
- PWA instalavel para uso no celular dos promotores;
- rotas backend expostas em `/api/*`;
- storage de visitas funcionando no runtime do Netlify;
- segredos fora do frontend;
- fluxo de campo e supervisor validado no ambiente publicado.

Se houver migração futura para outro host, o projeto também já tem compatibilidade preparada para storage alternativo, mas a publicacao atual e a referencia operacional sao o Netlify.

## Documentação

- [Manual de Uso](./MANUAL_DE_USO.md)
- [Manual Técnico](./MANUAL_TECNICO.md)
- [Arquitetura Alvo](./ARQUITETURA_ALVO.md)

## Variáveis de ambiente

- `VITE_APP_TITLE`
- `VITE_API_BASE_URL`
- `VITE_DEFAULT_INDUSTRIES`

### Backend

- `APP_SESSION_SECRET`
- `BACKEND_GOOGLE_SHEETS_ID`
- `BACKEND_MAKE_WEBHOOK_URL`
- `BACKEND_GEMINI_API_KEY`
- `BACKEND_SUPERVISOR_USERS`
- `BACKEND_PROVISIONAL_SUPERVISORS`
- `BACKEND_PROVISIONAL_USERS`

`BACKEND_SUPERVISOR_USERS` e opcional quando a planilha ja possui coluna `ROLE` com valor `SUPERVISOR`.

`BACKEND_PROVISIONAL_SUPERVISORS` permite criar acessos temporarios de supervisor sem alterar a planilha. Use JSON ou formato compacto documentado no manual tecnico, sempre com senha em hash SHA-256 e nunca em texto puro.

`BACKEND_PROVISIONAL_USERS` permite criar acessos temporarios de teste com papel controlado, como `FIELD_OPS`, sem alterar a planilha.

### Opcional para migracao futura

- `BLOB_READ_WRITE_TOKEN`

## Observações

- A Fase 1 centraliza a configuração em variáveis de ambiente.
- A Fase 2 moveu as integrações sensíveis para Netlify Functions.
- A Fase 3 adiciona fila local persistida e retry de sincronização.
- A Fase 6 mantém a análise de imagem no backend e persiste o resultado quando possível.
- A Fase 7 publicou o projeto no Netlify sem alterar o visual do app.
- A Fase 8 fecha a documentação operacional e técnica da entrega.
- O frontend agora fala apenas com `/api/*`.
