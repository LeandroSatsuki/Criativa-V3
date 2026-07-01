# Checklist do Projeto - Criativa Field Ops

Data da ultima auditoria: 2026-06-27

## Situacao atual

- [x] Estrutura do projeto mapeada.
- [x] Fluxo principal do frontend entendido.
- [x] Integracoes externas identificadas.
- [x] Riscos tecnicos registrados.
- [x] Riscos de seguranca registrados.
- [x] Build validado.
- [x] Typecheck validado.
- [x] Nenhuma alteracao visual foi feita nesta fase.
- [x] CHANGELOG criado e atualizado.

## Fase 1 - Configuracao e limpeza de exposicao

- [x] Segredos removidos do codigo-fonte.
- [x] Configuracao centralizada em `src/config/appConfig.ts`.
- [x] `vite.config.ts` sem exposicao de `process.env`.
- [x] `index.html` com titulo correto.
- [x] `.env.example` atualizado com variaveis reais do projeto.
- [x] `README.md` atualizado com orientacoes tecnicas.
- [x] Validacao local de build e runtime executada.

## Fase 2 - Backend minimo seguro

- [x] Camada backend criada com Netlify Functions.
- [x] Autenticacao assinada centralizada no backend.
- [x] Google Sheets acessado somente pelo backend.
- [x] Make.com acessado somente pelo backend.
- [x] Gemini acessado somente pelo backend.
- [x] Storage de visitas criado com Netlify Blobs.
- [x] Painel supervisor passou a consultar dados reais do backend.
- [x] Frontend passou a usar `/api/*` em vez de integrar servicos sensiveis diretamente.
- [x] `npm.cmd run lint` concluido com sucesso.
- [x] `npm.cmd run build` concluido com sucesso.
- [x] Smoke check do frontend puro retornou `200`.
- [x] Smoke check do backend local retornou `200` em `/api/health` e `/api/config`.

## Fase 3 - Persistencia e fila de sincronizacao

- [x] Fila local persistida criada para visitas nao sincronizadas.
- [x] Reenvio manual da fila local adicionado na tela de sincronizacao.
- [x] Backend recebeu endpoint de retry dedicado.
- [x] Backend recebeu endpoint para consulta da fila operacional.
- [x] Estados da fila local atualizados para pendente, enviando, enviado e erro.
- [x] `npm.cmd run lint` executado apos a implementacao da Fase 3.
- [x] `npm.cmd run build` executado apos a implementacao da Fase 3.
- [x] Smoke check do fluxo de fila e retry executado.

## Fase 4 - Fluxo de campo completo

- [x] Etapa Antes exige industria selecionada para concluir.
- [x] Etapa Depois bloqueia conclusao sem industria vinculada.
- [x] Etapa Estoque exige industria selecionada e quantidade valida.
- [x] Analise de imagem agora atualiza estado de processamento.
- [x] `npm.cmd run lint` executado apos a implementacao da Fase 4.
- [x] `npm.cmd run build` executado apos a implementacao da Fase 4.
- [x] `npm.cmd run dev` validado com smoke check local em `200`.

## Fase 5 - Painel supervisor com dados reais

- [x] Backend supervisor passou a entregar resumo estruturado real.
- [x] Gráfico do supervisor passou a usar series reais de visitas.
- [x] Cards do supervisor passaram a usar contagens operacionais reais.
- [x] Detalhe do promotor passou a usar métricas reais de execucao.
- [x] `npm.cmd run lint` executado apos a implementacao da Fase 5.
- [x] `npm.cmd run build` executado apos a implementacao da Fase 5.
- [x] Smoke check autenticado do dashboard supervisor executado.

## Fase 6 - IA e analise de imagem segura

- [x] `visitId` estabilizado no fluxo antes da analise.
- [x] Rota de IA persiste resultado no backend quando possivel.
- [x] Falha da IA continua sem bloquear a visita.
- [x] Frontend continua sem acesso direto ao segredo da Gemini.
- [x] `npm.cmd run lint` executado apos a implementacao da Fase 6.
- [x] `npm.cmd run build` executado apos a implementacao da Fase 6.
- [x] Smoke check de persistencia de `aiResults` no backend executado.
- [x] Smoke check da rota de IA sem chave configurada executado.

## Fase 7 - Publicacao e implantacao

- [x] Projeto autenticado no Netlify.
- [x] Variaveis de ambiente configuradas no host de producao.
- [x] Deploy de producao concluido com sucesso.
- [x] Smoke check do ambiente publicado concluido.
- [x] URL publica validada em navegador.
- [x] README e instrucoes de operacao atualizados para o host final.
- [x] CHANGELOG atualizado com a fase 7 concluida.

## Fase 8 - Entrega final e documentacao

- [x] Manual de uso criado com o fluxo do promotor e supervisor.
- [x] Manual tecnico criado com arquitetura, fluxo de dados e acesso aos registros.
- [x] Arquitetura alvo documentada para PWA do promotor e web do supervisor.
- [x] README final atualizado com links para os manuais.
- [x] CHANGELOG atualizado com a fase 8 concluida.
- [x] Backlog tecnico atualizado com o status final do projeto.
- [x] Checklist do projeto atualizado com a entrega concluida.

## Evolucao segura pos-entrega

- [x] Definir arquitetura alvo preservando o app atual.
- [x] Habilitar PWA instalavel para promotores.
- [ ] Validar PWA em celular real.
- [ ] Revisar sessao, login e rate limit.
- [ ] Separar armazenamento de fotos em storage dedicado.
- [ ] Avaliar banco operacional para relatorios e auditoria.

## Checklist da fase 0

- [x] Li os arquivos diretamente envolvidos.
- [x] Entendi o fluxo atual.
- [x] Identifiquei risco de regressao.
- [x] Defini escopo minimo da alteracao.
- [x] Nao alterei o visual.
- [x] Nao removi funcionalidade.
- [x] Nao deixei segredo novo no frontend.
- [x] Nao criei mock novo em producao.
- [x] Nao deixei codigo temporario.
- [x] Mantive nomes claros e consistentes.

## Validacoes executadas

- [x] `npm.cmd install`
- [x] `npm.cmd run lint`
- [x] `npm.cmd run build`
- [x] `npm.cmd run dev` com resposta `200` na raiz via smoke check local.

## Checklist manual do fluxo atual

- [ ] Login do promotor validado em navegador.
- [ ] Login do supervisor validado em navegador.
- [ ] Filtro de lojas por usuario validado em navegador.
- [ ] Check-in com foto da fachada validado em navegador.
- [ ] Etapa Antes com selecao de industria validada em navegador.
- [ ] Etapa Estoque com quantidades validada em navegador.
- [ ] Etapa Depois com analise de imagem validada em navegador.
- [ ] Etapa Trocas / avarias validada em navegador.
- [ ] Check-out com foto de saida validado em navegador.
- [ ] Sincronizacao com Make validada em navegador.
- [ ] Painel supervisor com dados reais validado em navegador.

## Checklist de risco para as proximas fases

- [ ] Remover exposicao de webhook no frontend.
- [ ] Remover exposicao de chave Gemini no frontend.
- [ ] Remover fallback de senha fixa `admin/admin`.
- [ ] Eliminar uso de `Math.random` em dashboard de producao.
- [ ] Definir persistencia real para visitas e status de sync.
- [ ] Implementar fila de reenvio confiavel.
- [ ] Validar permissao por papel e por rota.
- [ ] Garantir que o supervisor veja dados reais.
- [ ] Reduzir dependencia de `localStorage` como fonte unica.
- [ ] Revisar bundle grande e dividir quando necessario.

## Observacoes operacionais

- O ambiente local aceitou o projeto com build aprovado.
- O `npm.cmd install` reportou 8 vulnerabilidades no inventario de dependencias.
- O build ainda emite warning sobre chunk grande acima de 500 kB.
- A fila de retry manual dedicada agora existe e segue para validacao final.
- A fila local e o endpoint de retry foram validados em runtime com `401` sem autenticacao na fila e `200` nos endpoints basicos.
- O fluxo principal do promotor ficou mais travado contra conclusao incompleta.
- O painel supervisor deixou de depender de `chartData` fixo e numeros sinteticos.
- O smoke check autenticado do supervisor retornou `PROMOTERS=25`, `TOTAL_VISITS=0`, `PENDING_SYNC=0`, `TIMELINE_POINTS=6`.
- O smoke check de IA retornou `AI_SAVED=Bom` na persistencia de visita e `AI_ROUTE=503` sem chave Gemini configurada.
- A Fase 7 foi publicada no Netlify e validada na URL publica.
- A chave de Gemini continua opcional e ausente no ambiente de producao, mantendo a rota de IA em fallback seguro.
- A Fase 8 fechou a documentacao de uso, tecnica e operacao do projeto.
