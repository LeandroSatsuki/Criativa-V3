# Metodologia Segura para PWA e Operacao Offline

## Objetivo

Evoluir o Criativa Field Ops para um aplicativo instalavel em Android e iOS,
com operacao offline e sincronizacao posterior, sem regredir o fluxo online que
ja esta em producao.

Esta metodologia e obrigatoria para todas as subfases da evolucao. Nenhuma
subfase pode seguir para producao sem cumprir seus gates de validacao.

## Baseline protegido

- Branch de producao: `main`.
- Commit funcional de referencia: `dde4d53cd045e5197e541ea20b7b366ea8fc5611`.
- Tag de rollback prevista: `pwa-offline-baseline-2026-08-04`.
- Site de producao: `https://criativa-field-ops-574.netlify.app`.
- Deploy funcional de referencia: `6a71e39ad81552799bd99bdd`.

O baseline deve permanecer recuperavel durante toda a evolucao. Rollback sera
feito por reversao de commit ou restauracao do deploy anterior no Netlify.
Comandos destrutivos, exclusao de dados e reducao de versao do IndexedDB nao
fazem parte do procedimento.

## Invariantes de nao regressao

1. Rascunhos, fotos e itens da fila nunca podem ser apagados por uma migracao.
2. Um item so pode sair da fila depois da confirmacao persistida de envio.
3. Filas e rascunhos permanecem isolados pelo proprietario autenticado.
4. Os identificadores idempotentes existentes devem ser preservados.
5. Respostas de login, tokens e APIs autenticadas nunca entram no cache do
   service worker.
6. O fluxo online atual permanece como caminho principal ate o aceite da
   respectiva subfase offline.
7. Make V2, Drive e planilha nao serao alterados na evolucao PWA sem uma
   necessidade comprovada e um teste controlado separado.
8. Nenhuma senha, token, foto ou payload operacional pode aparecer em logs.
9. O backend sempre revalida identidade, propriedade e permissao no envio.
10. O painel supervisor nao usara dados offline antigos como se fossem atuais.
11. Nenhuma alteracao visual relevante sera feita; mensagens e indicadores
    novos devem reutilizar o design existente.

## Estrategia de entrega

Cada subfase deve ser pequena, aditiva e independente. Um novo comportamento
de risco deve iniciar protegido por configuracao nao sensivel, permitindo
desativacao sem apagar dados locais. A configuracao nao substitui testes nem
autorizacao do backend.

### Protocolo obrigatorio por subfase

1. Registrar escopo, arquivos envolvidos e comportamento que nao pode mudar.
2. Ler o fluxo existente antes da edicao.
3. Criar ou ajustar testes de regressao antes de publicar.
4. Fazer apenas migracoes aditivas no IndexedDB.
5. Executar testes, lint, build Vite e build Netlify.
6. Publicar primeiro em deploy de preview.
7. Executar a matriz manual da subfase no preview.
8. Conferir que filas, rascunhos e fotos anteriores continuam legiveis.
9. Atualizar `CHANGELOG.md`, checklist e documentacao operacional.
10. Criar commit pequeno e publicar no GitHub.
11. Publicar em producao somente depois dos gates aprovados.
12. Fazer smoke test em producao e monitorar a primeira operacao real.

## Subfases e gates

### PWA-0 - Baseline e metodologia

Escopo:

- Documentar invariantes, testes, rollback e condicoes de parada.
- Criar tag imutavel do estado funcional atual.
- Nao alterar comportamento do aplicativo.

Gate:

- Testes, lint e builds do baseline aprovados.
- Tag publicada no repositorio remoto.

### PWA-1 - Instalacao e app shell offline

Escopo:

- Tornar o cache do app shell compativel com os arquivos versionados do Vite.
- Controlar atualizacao do service worker sem interromper uma visita.
- Manter APIs, autenticacao e dados privados fora do cache HTTP.
- Validar instalacao no Chrome Android e no Safari iOS.

Gate:

- Aplicativo instalado abre sem rede depois de uma carga online completa.
- Atualizacao de versao nao perde visita, fila ou fotos.
- Fluxo online permanece identico ao baseline.

### PWA-2 - Perfil operacional offline

Escopo:

- Persistir somente o perfil operacional necessario, lojas atribuidas e
  industrias depois do primeiro acesso online.
- Isolar o cache por usuario.
- Usar rede primeiro e cache somente como fallback offline.
- Manter o supervisor online para indicadores que exigem dados atuais.

Gate:

- Primeiro acesso sem internet continua bloqueado com mensagem clara.
- Usuario ja validado consegue iniciar uma visita offline apenas em lojas
  previamente autorizadas.
- Troca de usuario nao herda lojas, rascunhos ou filas de outro usuario.

### PWA-3 - Sessao offline segura

Escopo:

- Separar permissao local offline de autenticacao valida no servidor.
- Implementar renovacao online segura e expiracao controlada.
- Manter revogacao por novo login e regra de dispositivo unico.
- Nunca armazenar senha para autenticar offline.

Gate:

- Sessao valida sobrevive a bloqueio e fechamento do aplicativo.
- Sessao expirada nao sincroniza sem nova validacao online.
- Revogacao no servidor impede novos envios do dispositivo anterior.

### PWA-4 - Finalizacao offline e outbox

Escopo:

- Permitir finalizar a visita localmente sem rede.
- Criar coordenador unico da fila com estados rastreaveis.
- Aplicar retry com backoff exponencial e limite de concorrencia.
- Preservar idempotencia para impedir duplicidade em Drive e planilha.

Gate:

- Visita finalizada offline libera uma nova operacao sem perder dados.
- Fechar, bloquear e reabrir o celular restaura o ponto exato do fluxo.
- Reconexao envia todos os arquivos e uma unica linha por visita.
- Falha parcial retoma apenas o que ainda nao foi confirmado.

### PWA-5 - Tentativas automaticas multiplataforma

Escopo:

- Tentar envio ao finalizar, ao abrir o app, ao recuperar conexao, ao receber
  foco e periodicamente enquanto o aplicativo estiver aberto.
- Usar Background Sync apenas como melhoria quando houver suporte.
- Manter o coordenador em primeiro plano como fallback obrigatorio para iOS.

Gate:

- Android e iOS retomam a fila sem acao manual quando o app volta a ficar
  ativo e conectado.
- Ausencia de Background Sync nao bloqueia nem perde a operacao.
- O usuario visualiza quantidade, progresso, erro e opcao de reenvio.

### PWA-6 - Homologacao em aparelhos reais

Escopo:

- Executar o roteiro completo em pelo menos um iPhone e um Android.
- Testar rede instavel, modo aviao, bloqueio, fechamento e pouco espaco.
- Atualizar manuais de instalacao, contingencia e suporte.

Gate:

- Matriz de homologacao assinada sem perda, duplicidade ou vazamento.
- Cliente consegue instalar, operar offline e acompanhar pendencias.

## Matriz minima de regressao

### Fluxo funcional

- Login de promotor online.
- Login e indicadores reais de supervisor.
- Selecao de loja autorizada.
- Check-in e foto.
- Antes com uma e varias industrias.
- Estoque independente do fluxo de industrias.
- Depois para todas as industrias abertas.
- Trocas e avarias para todas as industrias abertas.
- Check-out e finalizacao.
- Nova visita depois da finalizacao.

### Persistencia

- Bloquear e desbloquear em cada etapa.
- Fechar e reabrir em cada etapa.
- Reiniciar aparelho com rascunho e fila pendentes.
- Atualizar versao com rascunho e fila pendentes.
- Alternar usuarios no mesmo aparelho.

### Sincronizacao

- Envio online imediato.
- Finalizacao totalmente offline.
- Queda de conexao no meio das fotos.
- Retorno da conexao com app aberto.
- Retorno da conexao com app reaberto.
- Erro temporario do backend, Make e Drive.
- Confirmacao de todas as fotos no Drive.
- Confirmacao de uma unica linha da visita na planilha.
- Reenvio sem duplicidade.

### Aparelhos

- Chrome Android instalado.
- Safari iOS adicionado a Tela de Inicio.
- Camera e galeria em ambos.
- Foto de aparelho com camera de alta resolucao.
- Restricao de dados e armazenamento reduzido.

## Migracao de dados locais

- Cada mudanca de schema aumenta a versao do IndexedDB.
- Object stores existentes nao devem ser removidos ou renomeados na mesma
  entrega que introduz o novo fluxo.
- Migracoes devem copiar ou complementar campos dentro de uma transacao.
- Leitores novos devem aceitar registros no formato anterior.
- A limpeza de registros antigos so pode ocorrer depois de enviados, fora da
  migracao e com criterio documentado.
- Falha de migracao deve abortar a abertura da nova versao sem apagar a antiga.

## Observabilidade segura

Podem ser registrados:

- ID da visita.
- Estado da fila.
- Numero de fotos total e confirmado.
- Numero da tentativa.
- Codigo de erro sanitizado.
- Horario da transicao.

Nao podem ser registrados:

- Base64 de fotos.
- Senhas e tokens.
- Webhooks e chaves.
- Dados pessoais desnecessarios.
- Resposta integral de provedores externos.

## Condicoes de parada

A publicacao deve ser interrompida se ocorrer qualquer um destes eventos:

- Contagem de fotos local e remota divergente sem explicacao rastreavel.
- Rascunho, fila ou foto antiga deixa de ser lido.
- Visita duplicada no Drive ou na planilha.
- Usuario visualiza dados de outro usuario.
- Login, permissao ou regra de dispositivo unico sofre regressao.
- Build, lint ou teste obrigatorio falha.
- Aplicativo online deixa de completar o fluxo atual.
- Atualizacao do service worker interrompe uma visita.
- Segredo ou payload sensivel aparece no cliente ou nos logs.
- Alteracao visual relevante nao prevista.

## Rollback

1. Suspender novas publicacoes.
2. Desativar a configuracao da nova funcionalidade, quando aplicavel.
3. Restaurar o deploy funcional anterior no Netlify.
4. Reverter o commit causador com `git revert`, preservando o historico.
5. Nao limpar IndexedDB, fila ou fotos durante o rollback.
6. Validar que a versao anterior consegue ler os registros existentes.
7. Registrar causa, impacto e recuperacao no `CHANGELOG.md`.

## Regra de aprovacao

Uma subfase somente e concluida quando codigo, testes, preview, matriz manual,
documentacao, commit e verificacao de producao estiverem completos. Uma falha
mantem a subfase aberta e impede o inicio da seguinte.
