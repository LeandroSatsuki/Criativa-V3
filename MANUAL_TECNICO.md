# Manual Técnico - Criativa Field Ops

Este documento resume a arquitetura real do projeto, o fluxo de dados e onde cada tipo de informação fica armazenado.

## 1. Arquitetura atual

- Frontend: React + Vite + TypeScript
- Backend: Netlify Functions
- Persistência operacional: Netlify Blobs
- Cadastro base: Google Sheets
- Sincronização externa: Make.com
- IA de imagem: Gemini
- Rascunho e fila local: `IndexedDB`
- Compatibilidade e configuracao leve: `localStorage`
- Instalacao no celular: PWA com manifest e service worker conservador

## 2. Fluxo de dados

### 2.1 Login

- O frontend envia as credenciais para `/api/auth/login`.
- O backend valida o usuário com a fonte cadastrada.
- O backend emite uma sessão assinada.
- A sessão fica guardada no navegador e é usada nas rotas autenticadas.

### 2.2 Configuração inicial

- O frontend chama `/api/config`.
- O backend carrega indústrias, promotores e lojas.
- Os dados podem ser lidos do cache no backend.
- O frontend usa isso para preencher o fluxo.

### 2.3 Check-in e visita

- Quando o promotor escolhe uma loja, o app cria ou reaproveita um `visitId`.
- As etapas seguintes atualizam o estado local da visita.
- O estado completo, incluindo fotos, fica no `IndexedDB` do navegador.
- A chave `criativa_v5_state` no `localStorage` mantém apenas uma copia leve, sem o conteudo das fotos, para compatibilidade e migracao.
- Cada alteracao de etapa, resposta ou foto entra em uma sequencia de gravacao para preservar a ordem correta do rascunho.
- Ao reabrir o app, o estado completo e a etapa ativa sao restaurados antes da continuidade operacional.

### 2.4 Fotos

- As imagens são capturadas no navegador.
- O app redimensiona e comprime a imagem antes de salvar.
- Cada foto é armazenada como string base64 dentro de:
  - `visitState.photos`
  - rascunho e fila no `IndexedDB`
  - payload da visita no backend

### 2.5 Sincronização

- O frontend monta o payload final.
- A sincronização passa por `/api/visits/sync`.
- O backend:
  - atualiza o status da visita
  - transforma o payload para o formato do destino
  - envia ao webhook da Make
  - marca `pendente`, `enviando`, `enviado`, `erro` ou `reenviar`

### 2.6 IA

- A rota `/api/ai/analyze` recebe a imagem e a lista de indústrias.
- Se houver `visitId`, o resultado da IA é persistido junto da visita.
- Se a IA falhar, o fluxo não bloqueia a operação.

### 2.7 PWA

- O app possui `manifest.webmanifest`, icones e `sw.js`.
- O service worker registra somente em build de producao.
- Chamadas `/api/*` nao sao cacheadas pelo service worker.
- O cache da PWA e limitado ao shell e assets estaticos.
- A continuidade de visita offline continua dependendo do estado local e da fila de sincronizacao.

## 3. Onde os dados ficam

### 3.1 Navegador

No navegador o app usa:

- banco `criativa-field-ops`, store `visit-drafts`
- banco `criativa-field-ops-sync`, store `queued-visits`
- `criativa_v5_state`, somente como copia leve sem fotos
- `CRIATIVA_APP_CONFIG_CACHE`
- `criativa_session`

Esses dados servem para:

- restaurar a última visita
- manter fila de reenvio
- guardar sessão
- evitar repetir chamadas desnecessárias

O rascunho fica vinculado ao ID do usuario que iniciou a visita. Uma sessao expirada ou uma saida manual nao apaga a coleta; o mesmo usuario pode autenticar novamente e continuar na etapa salva. Um usuario diferente nao recebe o rascunho anterior.

### 3.2 Backend

No backend, a visita é persistida em uma store JSON abstrata.

Na prática:

- no Netlify, isso usa Netlify Blobs
- na estrutura preparada para migração futura, existe compatibilidade com Vercel Blob

Os registros são armazenados com chaves do tipo:

- `visits/<visitId>`
- `criativa-config/latest`

## 4. Como acessar os dados

### 4.1 Pela aplicação

Rotas principais:

- `GET /api/health`
- `GET /api/config`
- `POST /api/auth/login`
- `GET /api/stores`
- `POST /api/visits`
- `PATCH /api/visits/:id`
- `POST /api/visits/sync`
- `GET /api/sync/:id/status`
- `POST /api/sync/:id/retry`
- `GET /api/sync/queue`
- `GET /api/supervisor/dashboard`
- `GET /api/supervisor/promoters/:id`
- `POST /api/ai/analyze`

### 4.2 Via Netlify

O deploy de produção está publicado no projeto Netlify do repositório.

Para inspeção operacional:

- use o dashboard do projeto no Netlify
- use os logs de função
- use as rotas da API acima para validar o estado da aplicação

## 5. Como os arquivos de foto são tratados

Não existe uma pasta de imagens local no servidor para cada visita.

O fluxo real funciona assim:

1. O navegador captura a imagem.
2. A imagem é comprimida e convertida para base64.
3. O base64 entra no estado da visita.
4. Na sincronização, o backend transforma a visita em payload operacional.
5. Os campos de foto são enviados com nomes padronizados.

Quando o JSON completo da visita ultrapassa 4 MB, o frontend nao usa mais uma
unica requisicao. Ele divide o conteudo em fragmentos de ate 1,5 MB, envia cada
fragmento para `/api/visits/upload` e solicita a remontagem no backend.

O backend:

1. associa os fragmentos ao usuario autenticado;
2. limita a quantidade e o tamanho de cada parte;
3. verifica o SHA-256 do conteudo reconstruido;
4. salva a visita completa no storage;
5. remove os fragmentos temporarios;
6. sincroniza usando a visita ja salva, sem reenviar todo o JSON pelo navegador.

O limite seguro atual de uma visita reconstruida e 64 MB. Visitas pequenas
continuam usando `/api/visits`, preservando compatibilidade.

Isso significa que, para acessar a foto, você deve olhar:

- o estado local da visita no navegador
- o payload salvo da visita no backend
- o payload enviado ao webhook da Make

## 6. Estrutura do payload operacional

O backend monta campos como:

- `DATA_VISITA`
- `ID_VISITA`
- `NOME_PROMOTOR`
- `NOME_LOJA`
- `HORA_ENTRADA_CHECK_IN`
- `HORA_SAIDA_CHECK_OUT`
- `TEMPO_PERMANENCIA`
- `QTD_ESTOQUE`
- `TEVE_TROCAS`
- `FOTO_CHECKIN`
- `FOTO_ANTES`
- `FOTO_ESTOQUE`
- `FOTO_DEPOIS`
- `FOTO_TROCA`
- `FOTO_CHECKOUT`

## 7. Variáveis de ambiente

Obrigatórias no backend:

- `APP_SESSION_SECRET`
- `BACKEND_GOOGLE_SHEETS_ID`
- `BACKEND_MAKE_WEBHOOK_URL`

Opcional:

- `BACKEND_GEMINI_API_KEY`
- `BACKEND_SUPERVISOR_USERS`
- `BACKEND_PROVISIONAL_SUPERVISORS`
- `BACKEND_PROVISIONAL_USERS`

Opcional para migração futura:

- `BLOB_READ_WRITE_TOKEN`

## 8. Regras de segurança

- Não expor webhook da Make no frontend.
- Não expor chave do Gemini no frontend.
- Não confiar em dados do navegador como fonte final.
- Não aceitar sync sem autenticação.
- Não usar senha fixa em produção.

## 9. Acesso supervisor

O backend aceita três formas de identificar supervisor:

- coluna `ROLE` na aba `CADASTRO_PROMOTORES`, com valor `SUPERVISOR`;
- compatibilidade antiga com coluna de região igual a `SUPERVISOR`;
- variável `BACKEND_SUPERVISOR_USERS` com usuários ou IDs separados por vírgula.

Exemplo:

```text
BACKEND_SUPERVISOR_USERS="usuario.supervisor,22"
```

O uso por variável de ambiente é útil quando o cadastro do Google Sheets ainda não tem coluna própria para perfil.

Para criar um supervisor temporario sem alterar a planilha, use `BACKEND_PROVISIONAL_SUPERVISORS` com JSON. A senha deve ser salva como SHA-256 do valor normalizado em minusculas.

Exemplo:

```json
[
  {
    "id": "provisorio-luana-coelho",
    "name": "Luana Coelho",
    "user": "luana.coelho",
    "passHash": "hash_sha256_da_senha",
    "region": "SUPERVISOR",
    "expiresAt": "2026-07-31T23:59:59-03:00"
  }
]
```

Esse acesso nao aparece na lista de promotores, mas pode acessar o painel supervisor enquanto a variavel existir e nao estiver expirada.

Quando configurar pelo CLI em ambiente Windows, tambem e aceito o formato compacto abaixo, que evita problemas de escape de aspas:

```text
provisorio-luana-coelho|Luana Coelho|luana.coelho|hash_sha256_da_senha|SUPERVISOR|2026-07-31T23:59:59-03:00
```

Para criar um usuario provisorio de promotor, use `BACKEND_PROVISIONAL_USERS` com papel `FIELD_OPS`.

Exemplo em JSON:

```json
[
  {
    "id": "provisorio-leandro-pinheiro",
    "name": "Leandro Pinheiro",
    "user": "leandro.pinheiro",
    "passHash": "hash_sha256_da_senha",
    "region": "Vila Velha",
    "storeResponsible": "Nome do responsavel da rota na planilha",
    "role": "FIELD_OPS",
    "expiresAt": "2026-07-31T23:59:59-03:00"
  }
]
```

Formato compacto aceito:

```text
provisorio-leandro-pinheiro|Leandro Pinheiro|leandro.pinheiro|hash_sha256_da_senha|Vila Velha|FIELD_OPS|2026-07-31T23:59:59-03:00|Nome do responsavel da rota na planilha
```

O campo `storeResponsible` e opcional, mas recomendado para testes. Ele permite que um usuario provisorio veja uma rota real sem assumir o nome ou ID de um promotor cadastrado.

## 10. Observações de manutenção

- O build pode emitir warning de chunk grande, mas isso não impede a operação.
- O `localStorage` continua sendo importante para continuidade offline, mas não deve ser a única fonte de verdade.
- O backend deve permanecer como camada de proteção para integrações sensíveis.
- Alteracoes no `sw.js` devem ser conservadoras para nao cachear respostas autenticadas ou payloads de visita.
- A Netlify Function sincronica possui limite de corpo bufferizado. Nao volte a
  enviar a visita completa diretamente para `/api/visits/sync`.
- O Make deve receber cada arquivo individualmente na Etapa B. Nao agrupe todas
  as fotos base64 em um unico webhook, pois isso volta a criar limite de tamanho.
- O cenario Make atual ainda usa uma foto principal por etapa. As demais ficam
  preservadas no payload da visita ate a rota individual de fotos ser concluida.
