# Checklist do Projeto - Criativa Field Ops

Data da ultima auditoria: 2026-08-14

## Homologacao - Pastas por PDV e devolucoes

- [x] Contrato adiciona nome seguro da pasta do PDV.
- [x] Fotos `TROCAS` recebem destino logico `DEVOLUCOES`.
- [x] Link agregado prioriza a pasta raiz do PDV.
- [x] Compatibilidade com respostas antigas do Make preservada.
- [x] Contrato 2.1 mantido para nao invalidar manifestos pendentes.
- [x] Testes e typecheck aprovados.
- [x] Build e preview Netlify aprovados.
- [ ] Confirmar que nao existem visitas parcialmente enviadas.
- [ ] Atualizar os modulos de pasta no Make.
- [ ] Testar uma visita com fotos normais e devolucao.
- [ ] Confirmar idempotencia ao reenviar a mesma visita.
- [ ] Publicar em producao somente depois da homologacao do Make.

## Producao - Fuso horario das visitas

- [x] Diferenca de tres horas confirmada em `RELATORIO_VISITAS`.
- [x] Causa localizada em timestamps locais enviados sem offset.
- [x] Novos registros passam a transportar instante ISO com fuso explicito.
- [x] Filas e rascunhos antigos sem fuso sao interpretados como Brasilia.
- [x] Datas de arquivo e pasta usam `America/Sao_Paulo`.
- [x] Testes, typecheck, build, preview e smoke test aprovados.
- [x] Correcao publicada em producao.
- [ ] Nova visita real conferida na planilha pelo cliente.
- [ ] Correcao retroativa dos tres registros antigos autorizada, se necessaria.

## Homologacao - Roteirizacao diaria de lojas

- [x] Origem `.xls` baixada e auditada em modo leitura.
- [x] Destino `Sistema Criativa / CADASTRO_LOJAS` identificado.
- [x] 153 linhas da origem mapeadas para IDs existentes sem ambiguidade.
- [x] Linha exclusiva do destino identificada para preservacao.
- [x] Nome fantasia definido como `NOME_LOJA`.
- [x] Filtro por dia de Brasilia implementado sem fallback regional.
- [x] Roteiro de sabado adicionado em `CADASTRO_LOJAS!R:R` e no backend.
- [x] Promotor sem visita ativa direcionado para a selecao de loja apos entrar.
- [x] Compatibilidade por nome normalizado e ID estavel implementada.
- [x] Supervisor preservado sem filtro de roteiro.
- [x] Testes, lint, build e preview Netlify aprovados.
- [x] Conexao Google reautorizada com escopo de edicao.
- [x] Backup completo da aba criado e relido.
- [x] Migracao `A1:U155` aplicada e verificada.
- [ ] Promotora Giovana cadastrada ou rotas formalmente realocadas.
- [ ] Doze lojas sem dia confirmadas pelo cliente.
- [ ] Fluxo real de segunda a sabado homologado.
- [ ] Preview aprovado para producao.

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
- [x] Migrar rascunho completo e fila offline para `IndexedDB`.
- [x] Preservar visita em expiracao de sessao e saida da conta.
- [ ] Separar armazenamento de fotos em storage dedicado.
- [ ] Avaliar banco operacional para relatorios e auditoria.

## Automacao de relatorios - Etapa A

- [x] Limite de entrada da Netlify reproduzido com payloads de 1 MB a 7 MB.
- [x] Persistencia fracionada implementada para visitas acima de 4 MB.
- [x] Fragmentos limitados a 1,5 MB e protegidos por autenticacao.
- [x] Integridade SHA-256 validada antes de salvar a visita reconstruida.
- [x] Segundo envio integral da visita removido do fluxo de sincronizacao.
- [x] Teste integrado com 20 fotos e 6.654.940 bytes concluido.
- [x] Teste integrado com 30 fotos e 9.982.290 bytes concluido.
- [x] Abas `MANIFESTOS_VISITA`, `ANALISES_VISITA` e `RELATORIOS_INDUSTRIA` preparadas.
- [x] Novos campos de industria e resumo de visita adicionados sem apagar dados.
- [x] Etapa B: contrato de upload individual e fechamento unico implementado no backend.
- [x] Etapa B: retry idempotente e confirmacao estrita de Drive/planilha testados localmente.
- [x] Etapa B: modelo da planilha corrigido para uma linha por visita.
- [x] Etapa B: configurar e validar o cenario v2 no Make com Google Drive real.
- [ ] Etapa B: ativar `visit-v2` somente apos o teste controlado no Make.

## Isolamento da fila por usuario

- [x] Itens locais identificados por proprietario.
- [x] Filas legadas vinculadas pelo usuario salvo no payload.
- [x] Contagem, popup e reenvio filtrados pelo usuario autenticado.
- [x] Limpeza restrita a fila do usuario atual e protegida por confirmacao.
- [x] Rotas backend por visita protegidas por proprietario ou papel supervisor.
- [x] Testes automatizados com usuarios distintos.
- [ ] Validacao manual com dois usuarios reais no mesmo celular publicado.

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
- [x] Implementar fila de reenvio confiavel.
- [ ] Validar permissao por papel e por rota.
- [ ] Garantir que o supervisor veja dados reais.
- [x] Reduzir dependencia de `localStorage` como fonte unica.
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

## Evolucao PWA e operacao offline

- [x] Baseline funcional identificado antes de qualquer alteracao de runtime.
- [x] Metodologia de nao regressao, rollback e condicoes de parada documentada.
- [x] Tag de rollback `pwa-offline-baseline-2026-08-04` publicada.
- [ ] PWA-1: app shell e instalacao validados sem cache de APIs autenticadas.
- [ ] PWA-2: perfil, lojas e industrias disponiveis offline por usuario.
- [ ] PWA-3: sessao offline segura, renovacao e revogacao validadas.
- [ ] PWA-4: finalizacao offline e outbox idempotente validadas.
- [ ] PWA-5: retries automaticos e fallback para iOS validados.
- [ ] PWA-6: homologacao concluida em iPhone e Android reais.

### PWA-1 em homologacao

- [x] `skipWaiting` removido para nao interromper visita aberta.
- [x] App shell inclui os arquivos JS e CSS versionados do Vite.
- [x] Cache isolado pelo hash de cada bundle.
- [x] `/api/*` e `/.netlify/functions/*` excluidos do cache.
- [x] Headers de revalidacao do service worker configurados no Netlify.
- [x] Preview `6a71f05972b672208276f792` publicado e validado.
- [x] `APP_SESSION_SECRET` e Google Sheets habilitados no contexto de preview.
- [x] Smoke test do login retornou `401` para credencial invalida, sem erro de
  configuracao do backend.
- [x] Perda de rede simulada em Chromium com app shell restaurado do cache.
- [x] Atualizacao simulada manteve a versao atual ativa e a nova em `waiting`.
- [x] Instalacao e reabertura sem rede validadas em Android real pelo cliente.
- [ ] Instalacao e reabertura sem rede validadas em iPhone real.
- [ ] Preview aprovado para promocao a producao.

### PWA-5 - Compatibilidade iOS em homologacao

- [x] Registro do service worker iniciado sem aguardar `window.load`.
- [x] Navegacao usa app shell versionado do cache antes da rede.
- [x] Atualizacao do shell executada em segundo plano sem `skipWaiting`.
- [x] Manifesto servido como `application/manifest+json` no CDN.
- [x] APIs, autenticacao e dados operacionais permanecem fora do cache estatico.
- [x] Perfil limpo preparou o cache online e reabriu com rede bloqueada.
- [x] Testes, lint, build e preview Netlify aprovados.
- [ ] Safari/WebKit validado em iPhone real.
- [ ] Preview aprovado para promocao a producao.

### PWA-2 em homologacao

- [x] Causa do erro offline localizada na consulta exclusivamente remota de lojas.
- [x] Lojas e industrias persistidas por usuario depois da consulta autenticada.
- [x] Cache limitado a sete dias e ao papel `FIELD_OPS`.
- [x] Cache de outro usuario, supervisor, futuro ou expirado rejeitado.
- [x] Erro HTTP e `401` nao sao mascarados pelo fallback offline.
- [x] Preview estavel `pwa-offline` publicado.
- [x] Contexto Netlify `branch-deploy` validado com sessao, Sheets e Make V2.
- [x] Chromium offline restaurou promotor e loja autorizada sem erro de conexao.
- [x] Login online e reabertura offline validados com promotor real no celular.
- [ ] Cache renovado depois de recuperar conexao validado no celular.

### PWA-4 em homologacao

- [x] Fila IndexedDB confirmada antes da tentativa de rede.
- [x] Falha de rede classificada como `pending`, e nao como perda ou envio.
- [x] Payload, proprietario, loja, fotos e `visitId` preservados na fila.
- [x] Retorno para `Selecao de Unidade` liberado somente depois da gravacao.
- [x] Erro HTTP, autorizacao ou falha local continuam bloqueando o reset.
- [x] Evento da fila atualiza o indicador de pendencias no cabecalho.
- [x] Chromium offline concluiu a operacao com uma visita pendente preservada.
- [ ] Fluxo repetido com duas visitas offline reais no celular.
- [ ] Recuperacao da rede e envio das duas visitas validados no celular.

### Gates obrigatorios por subfase PWA

- [ ] Escopo e arquivos envolvidos registrados antes da edicao.
- [ ] Testes automatizados do comportamento novo e da regressao aprovados.
- [ ] Compatibilidade com registros anteriores do IndexedDB confirmada.
- [ ] `npm.cmd test`, lint, build e `netlify build` aprovados.
- [ ] Preview Netlify validado antes da producao.
- [ ] Fluxo online completo preservado.
- [ ] Fluxo offline da subfase validado em aparelho real.
- [ ] Contagem de fotos local, backend, Drive e planilha conferida.
- [ ] `CHANGELOG.md` e manuais atualizados.
- [ ] Commit, push, deploy e smoke test registrados.

## Homologacao - Painel supervisor interativo

- [x] Cards conectados aos dados reais retornados pelo backend.
- [x] Total de visitas concluidas corrigido para `completedVisits`.
- [x] Busca combinada por promotor, ID, regiao e loja implementada.
- [x] Filtro ativo identificado e removivel ao clicar novamente.
- [x] Detalhe do promotor preservado.
- [x] Sessao restaurada de supervisor abre `Gestao de Equipe`.
- [x] Rotulo visivel alterado para `Finalizacao da Visita`.
- [x] Contratos tecnicos de checkout com backend, Make e Sheets preservados.
- [x] Testes, lint, build e preview Netlify aprovados.
- [x] Chromium movel validado sem overflow horizontal.
- [ ] Login supervisor real e indicadores do cliente validados no preview.
- [ ] Preview aprovado para promocao a producao.

## Homologacao - Orientacao vertical das fotos

- [x] Captura horizontal normalizada para retrato.
- [x] Captura que ja esta vertical preservada.
- [x] Marca d'agua desenhada depois da restauracao do canvas.
- [x] Resolucao e compressao existentes preservadas.
- [x] Fotos antigas e filas pendentes preservadas sem migracao.
- [x] Testes e lint aprovados.
- [ ] Captura real validada no Android.
- [ ] Captura real validada no iPhone.
- [ ] Preview aprovado para promocao a producao.

## Homologacao - Sessao supervisor consistente

- [x] Sessao invalida retorna `401`.
- [x] Promotor autenticado em rota supervisor retorna `403`.
- [x] Supervisor valido permanece autorizado.
- [x] Token invalido removido automaticamente do aparelho.
- [x] Ultimo usuario preservado e senha limpa depois do login.
- [x] Rascunho e fila local preservados.
- [x] Testes, lint e Chromium controlado aprovados.
- [ ] Sessao unica validada com dois aparelhos reais.
- [ ] Preview aprovado para promocao a producao.

## Homologacao - Indicadores diarios e contato supervisor

- [x] Cadastrados separados de usuarios historicos.
- [x] Pendencias de sync listam as pessoas envolvidas e envios acumulados.
- [x] `Em Atividade Hoje` definido sem alegar GPS.
- [x] Concluidas e pendentes limitadas ao dia de Brasilia.
- [x] Clique no promotor abre popup sem sair do painel.
- [x] Popup mostra cadastro, metricas do dia e visitas recentes.
- [x] Telefone normalizado e WhatsApp habilitado somente quando valido.
- [x] Coluna `PROMOTORES!G:G` criada sem mover campos existentes.
- [x] Tabela, filtro, formato texto e cabecalho da planilha validados.
- [x] Testes, lint, build e Chromium movel aprovados.
- [ ] Telefones reais preenchidos pelo cliente.
- [ ] Painel validado com login supervisor real.
- [ ] Preview aprovado para promocao a producao.

## Homologacao - Navegacao dos cards supervisor

- [x] Clique no card limpa uma busca antiga.
- [x] Lista filtrada recebe foco sem alterar o layout principal.
- [x] Tela movel rola automaticamente ate os resultados.
- [x] Estado vazio tambem permanece visivel depois do clique.
- [x] Clique no resultado continua abrindo o popup do promotor.
- [x] Testes, lint, build e Chromium movel aprovados.
- [ ] Comportamento validado com o login supervisor real.
- [ ] Preview aprovado para promocao a producao.

## Homologacao - Concorrencia de login

- [x] Evidencia de requisicoes concorrentes confirmada nos logs Netlify.
- [x] Trava imediata impede novo submit durante a autenticacao.
- [x] Campos e botao ficam desabilitados ate a resposta.
- [x] Regra de sessao unica preservada no backend.
- [x] Motivos de `401` registrados sem credenciais, tokens ou identificadores.
- [x] Cinco submits simultaneos resultaram em uma unica chamada de login.
- [x] Testes, lint, build e preview Netlify aprovados.
- [ ] Login `Philipe.almeida` validado no aparelho real.
- [ ] Preview aprovado para promocao a producao.
