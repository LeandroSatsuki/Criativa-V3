# Backlog tecnico - Criativa Field Ops

Data da auditoria: 2026-06-27

## Diagnostico tecnico atual

O projeto esta funcionando como um frontend React + Vite + TypeScript com persistencia local e integracoes diretas no cliente.

O app ja possui o fluxo visual principal do promotor, mas hoje a confianca operacional ainda depende de recursos expostos no navegador:

- login validado por dados carregados de Google Sheets publicados;
- sincronizacao enviada diretamente do frontend para um webhook da Make;
- analise de imagem com Gemini acessada pelo cliente;
- dashboard supervisor alimentado por dados mockados e `Math.random`;
- estado principal salvo em `localStorage`;
- fallback de autenticacao `admin/admin` dentro do frontend;
- `vite.config.ts` expondo `process.env` no bundle.

O build atual passa, mas a base ainda nao esta pronta para uso real com seguranca e rastreabilidade completas.

Status da fase atual:
- Fase 6 concluida e validada.
- Proxima fase recomendada: Fase 7, com implantacao e configuracao de ambiente.

## Arquivos principais e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `src/App.tsx` | Shell principal do app, login, carregamento de configuracao, persistencia local e troca de seccoes. |
| `src/components/ContentArea.tsx` | Fluxo operacional do promotor: check-in, fachada, antes, estoque, depois, trocas, check-out e sincronizacao. |
| `src/components/SupervisorDashboard.tsx` | Painel supervisor atual, hoje ainda baseado em dados nao reais. |
| `src/services/apiService.ts` | Camada de integracao atual: Google Sheets, login, stores, sync com Make e dados do supervisor. |
| `src/services/geminiService.ts` | Chamadas para Gemini para analise de imagem. |
| `src/services/logService.ts` | Log de auditoria em memoria para o fluxo de sincronizacao. |
| `src/types.ts` | Tipos centrais, enum de secoes e estrutura do estado de visita. |
| `src/components/Sidebar.tsx` | Navegacao lateral e bloqueios basicos de fluxo. |
| `src/main.tsx` | Bootstrap do React. |
| `src/index.css` | Base visual global ja definida. |
| `vite.config.ts` | Configuracao do Vite. Hoje possui risco de exposicao de ambiente via `process.env`. |
| `package.json` | Scripts, dependencias e alvo do build. |
| `.env.example` | Exemplo de variaveis de ambiente, ainda generico e ligado ao fluxo atual de Gemini/AI Studio. |

## Mapa do fluxo de negocio existente

1. Login
   - O usuario entra com usuario e senha.
   - `apiService.getAppConfig()` carrega cadastros de planilhas publicadas.
   - `apiService.login()` valida credenciais em memoria/cache.
   - Existe atalho fixo para `admin/admin`.

2. Selecao de loja / rota
   - `apiService.getStores()` filtra lojas com base no promotor carregado do cache.
   - Supervisor recebe todas as lojas.
   - Promotor recebe lojas por responsavel ou regiao.

3. Check-in
   - A loja e selecionada em `SectionId.CheckIn`.
   - O horario de entrada e salvo no estado local.
   - O usuario captura a foto da fachada em `SectionId.Facade`.
   - O restante do fluxo so fica disponivel apos confirmar a fachada.

4. Antes
   - O usuario escolhe a industria.
   - Captura fotos da situacao inicial.
   - Pode disparar analise por IA em background.

5. Estoque
   - O usuario registra quantidades por industria.
   - Pode anexar fotos de estoque.
   - A etapa e marcada como concluida no estado local.

6. Depois
   - O usuario captura fotos finais.
   - A analise de imagem pode ser executada sem bloquear a visao.
   - O resultado fica em `aiResults`.

7. Trocas / avarias
   - O usuario responde sim ou nao.
   - Se sim, adiciona fotos.
   - Se nao, a lista de fotos da etapa e limpa.

8. Check-out
   - O usuario captura a foto de saida.
   - O horario de saida e salvo.
   - O tempo de permanencia e calculado no payload de sync.

9. Sincronizacao
   - `apiService.syncVisit()` monta o payload final.
   - O envio vai diretamente para o webhook da Make.
   - Ha logs de progresso, timeout e erro.
   - Nao existe fila persistida nem reenvio estruturado.

10. Painel supervisor
   - `SupervisorDashboard` consome dados sinteticos.
   - Status, online/offline e progresso sao gerados por `Math.random`.
   - Em producao isso nao e confiavel para acompanhamento real.

## Riscos tecnicos

- Persistencia apenas em `localStorage`, sem backup server-side.
- Sem fila de reenvio persistente.
- Sem controle de versao de schema para visitas.
- Login e dados de acesso dependem de planilha publicada.
- Dashboard supervisor nao representa dados reais.
- Estados de `any` e payloads amplos dificultam validacao forte.
- Bundle final acima de 500 kB com warning no build.
- Integracoes criticas vivem no cliente e aumentam superficie de erro.

## Riscos de seguranca

- Webhook da Make hardcoded no frontend.
- `GEMINI_API_KEY` acessada via `process.env` no cliente.
- `vite.config.ts` expoe `process.env` inteiro no bundle.
- Fallback `admin/admin` fraco e inseguro.
- Google Sheets com dado operacional sendo consultado diretamente pelo cliente.
- Estado local pode armazenar informacoes operacionais sensiveis sem criptografia.
- Ausencia de autenticao baseada em token, sessao ou expiracao.
- Ausencia de controle de permissao por rota no backend.

## Integracoes externas

- Google Sheets via endpoint `gviz` para `INDUSTRIAS`, `CADASTRO_PROMOTORES` e `CADASTRO_LOJAS`.
- Make.com via webhook hardcoded para recebimento da visita.
- Gemini via pacote `@google/genai`.
- Browser APIs para camera, arquivo e canvas.

## Proposta de arquitetura minima para backend e sincronizacao

Recomendacao inicial: manter o frontend React + Vite e adicionar uma camada de backend simples, barata e segura.

### Opcao recomendada

- Backend serverless em Netlify Functions ou Vercel Functions.
- Banco principal em Supabase free tier.
- Google Sheets mantido apenas como origem inicial de cadastro, se o cliente ainda precisar.
- Make.com acionado somente pelo backend, nao pelo navegador.
- Gemini acionado somente pelo backend.

### Fluxo sugerido

1. Frontend autentica usuario no backend.
2. Backend devolve perfil, permissao e rota.
3. Frontend cria visita em estado `rascunho` no backend.
4. Fotos e eventos ficam associados a essa visita.
5. Sync envia o job para Make pelo backend.
6. Backend atualiza status:
   - `pendente`
   - `enviando`
   - `enviado`
   - `erro`
   - `reenviar`
7. Supervisor consulta dados agregados no backend.
8. Se a rede falhar, a visita continua salva localmente e o backend recebe o reenvio depois.

### Por que essa opcao

- Menor impacto no frontend atual.
- Protege segredos.
- Permite persistencia real.
- Facilita fila e reenvio.
- Suporta painel supervisor com dados coerentes.
- Mantem custo baixo no inicio.

### Nao recomendado nesta fase

- Reescrever o app em outro framework.
- Trocar tudo para Firebase sem necessidade clara.
- Manter Make e Gemini expostos no cliente.
- Centralizar tudo em Google Sheets como banco operacional final.

## Prioridades do backlog

1. Fase 1: remover segredos e centralizar configuracao.
2. Fase 2: criar backend minimo seguro.
3. Fase 3: persistencia e fila de sincronizacao.
4. Fase 4: endurecer o fluxo completo do promotor.
5. Fase 5: substituir mock do supervisor por dados reais.
6. Fase 6: mover Gemini para camada segura.
7. Fase 7: preparar deploy.
8. Fase 8: documentacao final e entrega.
