# CHANGELOG

## [2026-08-08] - Roteirizacao diaria de lojas em homologacao

### Alterado
- O backend de homologacao passa a interpretar `Segunda` a `Sexta` e o fuso
  `America/Sao_Paulo` ao listar lojas para o promotor.
- Removido no novo fluxo o fallback regional que poderia liberar lojas sem
  atribuicao direta quando o nome do responsavel nao coincidisse.
- Schema de configuracao elevado para `7`, invalidando caches anteriores sem
  informacao de roteiro.

### Adicionado
- Vinculo opcional e estavel por `ROTA_PROMOTOR_ID`, com compatibilidade por
  nome normalizado quando o ID ainda nao estiver preenchido.
- Quatro testes de dia de Brasilia, atribuicao, ausencia de `X` e visao do
  supervisor.
- Plano auditavel em `MIGRACAO_LOJAS.md`.

### Corrigido
- Comparacao de responsavel passa a ignorar caixa, acentos e espacos quando o
  cadastro ainda depende do nome.
- Supervisor continua vendo todas as lojas, sem filtro de roteiro.

### Seguranca
- IDs atuais das lojas foram definidos como imutaveis no plano de migracao.
- Nenhum dado da origem ou de `CADASTRO_LOJAS` foi alterado: a conexao Google
  atual bloqueou a criacao do backup por falta de escopo de escrita.
- Producao nao foi publicada.

### Validacao
- Auditoria local somente leitura: 153 linhas de origem e 154 no destino.
- 153 linhas mapeadas sem ambiguidade; uma linha exclusiva do destino sera
  preservada.
- `npm.cmd test`: 62 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Preview `6a77961feeb48f4eca22cd50` publicado no alias `pwa-offline`.
- `/api/config` e `/api/health` responderam `200` na homologacao.

### Pendencias
- Reautorizar Google Drive/Sheets com permissao de edicao.
- Criar e verificar `BACKUP_LOJAS_2026-08-08_ANTES_ROTEIRO` antes da escrita.
- Migrar e reler `CADASTRO_LOJAS!A1:U155`.
- Resolver o cadastro da promotora Giovana Silveira Pessoa, ausente em
  `PROMOTORES`; as lojas dela nao devem ser entregues a outro usuario.
- Validar 12 lojas sem `X`, que corretamente nao aparecerao em nenhum dia.
- Homologar com usuarios reais antes de promover para producao.

## [2026-08-04] - Concorrencia de login corrigida em homologacao

### Alterado
- O formulario bloqueia usuario, senha e botao enquanto uma autenticacao esta
  em andamento.
- O backend registra somente o motivo tecnico de rejeicoes de sessao para
  diagnostico, sem registrar usuario, senha ou token.

### Adicionado
- Trava imediata por referencia, anterior a nova renderizacao do React, para
  impedir requisicoes duplicadas mesmo em toques muito rapidos.
- Diagnosticos `missing_token`, `expired_token`, `session_replaced` e demais
  causas seguras de `401` nos logs das Functions.

### Corrigido
- Multiplos submits simultaneos deixam de criar sessoes concorrentes nas quais
  uma requisicao podia invalidar o token retornado por outra.

### Seguranca
- A regra de uma unica sessao ativa por usuario foi preservada.
- Nenhuma credencial ou identificador pessoal foi adicionado aos logs.

### Validacao
- Logs Netlify mostraram tres chamadas de `auth-login` em menos de um segundo.
- `npm.cmd test`: 58 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Teste controlado disparou cinco submits simultaneos e confirmou apenas uma
  chamada de login, botao bloqueado e sessao gravada.
- Preview `6a7237b8be8b87210b585d90` publicado no alias `pwa-offline`.

### Pendencias
- Repetir o login com `Philipe.almeida` no aparelho real.
- Promover para producao somente depois da aprovacao da homologacao.

## [2026-08-04] - Compatibilidade offline do iOS em homologacao

### Alterado
- O service worker passa a ser registrado imediatamente ao iniciar o app, sem
  aguardar o carregamento completo da pagina.
- Navegacoes passam a abrir primeiro o app shell versionado ja confirmado no
  cache e atualizam esse shell em segundo plano quando houver internet.

### Adicionado
- Testes para abertura pelo cache, primeiro acesso sem cache, atualizacao segura
  do shell e tipo de conteudo do manifesto.
- Procedimento de homologacao do iPhone sem apagar rascunhos ou filas locais.

### Corrigido
- `manifest.webmanifest` passa a ser servido pelo Netlify como
  `application/manifest+json`, em vez de `application/octet-stream`.
- Removida a janela em que o app podia ser fechado no iOS antes de iniciar a
  preparacao do modo offline.

### Seguranca
- APIs, login, visitas e rotas `/.netlify/functions/*` permanecem fora do cache.
- `skipWaiting` continua proibido para nao trocar a versao durante uma visita.
- Nenhum rascunho, fila ou armazenamento existente foi migrado ou removido.

### Validacao
- `npm.cmd test`: 58 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- CDN confirmou `Content-Type: application/manifest+json; charset=UTF-8`.
- Chromium com armazenamento limpo confirmou worker ativo e cache versionado;
  depois, com rede bloqueada, reabriu a tela `ACESSAR` pelo service worker.
- Preview `6a723461835d8524ff5fc242` publicado no alias `pwa-offline`.

### Pendencias
- Repetir a homologacao no Safari/WebKit de um iPhone real.
- Promover para producao somente depois da aprovacao no aparelho.

## [2026-08-04] - Navegacao dos cards supervisor em homologacao

### Alterado
- Ao selecionar um card, o painel agora leva automaticamente o supervisor ate
  a lista de pessoas correspondente ao indicador.
- Uma busca anterior e limpa ao trocar de card para nao esconder resultados do
  novo recorte.

### Adicionado
- Foco acessivel e aviso dinamico na regiao de resultados do painel.

### Corrigido
- Corrigida a percepcao de que o card apenas recebia uma borda vermelha em
  telas moveis, enquanto a lista filtrada permanecia fora da area visivel.

### Seguranca
- Nenhum contrato de API, dado cadastral, permissao ou regra de acesso foi
  alterado.

### Validacao
- `npm.cmd test`: 54 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Chromium movel `390x844`: card de visitas concluidas rolou de `0` para
  `1450px`, exibiu 1 resultado correto e abriu o popup do promotor.
- Preview `6a722bb8f1995116663f6cbf` publicado no alias `pwa-offline`.

### Pendencias
- Validar o comportamento com o login supervisor e os dados reais do cliente.
- Promover para producao somente depois da aprovacao da homologacao.

## [2026-08-04] - Indicadores diarios e contato supervisor em homologacao

### Alterado
- `Promotores Cadastrados` passa a contar e listar somente linhas atuais da aba
  `PROMOTORES`, sem misturar usuarios historicos.
- `Promotores em Rota` foi substituido por `Em Atividade Hoje`, definido como
  pessoas com ao menos uma visita registrada no dia; nao representa GPS.
- Visitas concluidas, pendentes, tempo medio, curva e totais passam a considerar
  somente o dia atual no fuso `America/Sao_Paulo`.
- Pendencias de sincronizacao continuam abrangendo qualquer data para nao
  ocultar envios antigos e mostram pessoas e quantidade de envios.
- `Visitas em Andamento` foi renomeado para `Envios em Processamento`, refletindo
  o dado que o backend realmente consegue observar.

### Adicionado
- Popup do promotor com ID, login, regional, telefone, indicadores do dia e
  visitas recentes.
- Link direto para WhatsApp quando o telefone cadastrado e valido.
- Suporte aos cabecalhos `TELEFONE`, `CELULAR`, `WHATSAPP` e `CONTATO`.
- Coluna `TELEFONE` criada em `PROMOTORES!G:G`, como texto e integrada a tabela.
- Testes de cadastro versus historico, recortes diarios e telefone brasileiro.

### Corrigido
- O detalhe agora associa visitas por ID ou login, preservando historico quando
  o identificador cadastral muda.
- Cards diarios deixam de exibir acumulados de todos os dias.

### Seguranca
- Telefone e retornado somente pelas rotas autenticadas de supervisor.
- Link externo usa `wa.me`, numero normalizado e `noopener noreferrer`.
- Nenhum campo existente da planilha foi movido ou sobrescrito.

### Validacao
- `npm.cmd test`: 54 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Planilha `Sistema Criativa`, aba `PROMOTORES`, intervalo `F1:G4` relido apos
  a escrita; tabela e filtro confirmados ate a coluna `G`.
- Chromium movel confirmou os cinco recortes de pessoas, popup, WhatsApp,
  visitas recentes e ausencia de overflow.
- Preview `6a722a11d10e8f0c5c342485` publicado no alias `pwa-offline`.

### Pendencias
- Preencher os telefones reais em `PROMOTORES!G2:G`.
- Validar o painel com o login supervisor e dados reais do cliente.
- Promover para producao somente depois da aprovacao da homologacao.

## [2026-08-04] - Sessao supervisor consistente em homologacao

### Alterado
- Respostas das rotas supervisor agora distinguem sessao invalida (`401`) de
  usuario autenticado sem papel supervisor (`403`).
- Ao receber `401` em uma chamada autenticada, o app encerra somente a sessao
  invalida e retorna ao login com uma explicacao objetiva.

### Adicionado
- Politica compartilhada de autorizacao das rotas supervisor.
- Evento interno para comunicar expiracao ou substituicao de sessao ao app.
- Tres testes para sessao ausente, promotor autenticado e supervisor valido.

### Corrigido
- Corrigida a mensagem intermitente `Acesso restrito ao supervisor` quando o
  perfil local ainda era supervisor, mas o token havia expirado ou sido
  invalidado por um novo login.
- O ultimo usuario passa a aparecer preenchido ao retornar ao login.

### Seguranca
- A regra de apenas uma sessao ativa por usuario foi preservada.
- A senha e removida do estado do formulario depois do login bem-sucedido.
- Rascunhos e filas locais nao sao apagados quando a sessao e encerrada.

### Validacao
- `npm.cmd test`: 47 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Chromium controlado com perfil supervisor e token invalido confirmou retorno
  ao login, remocao do token, usuario preenchido, senha vazia e ausencia da
  mensagem incorreta de permissao.
- Preview `6a721d18692cdc15d364884a` publicado no alias `pwa-offline`.

### Pendencias
- Repetir no preview o login do mesmo supervisor em dois aparelhos antes da
  promocao para producao.

## [2026-08-04] - Orientacao vertical das fotos em homologacao

### Alterado
- Novas fotos horizontais passam a ser giradas 90 graus no sentido horario
  antes da marca d'agua e da compressao.
- Fotos que ja chegam em formato retrato preservam sua orientacao.

### Adicionado
- Regra central de layout vertical com dimensoes de desenho independentes das
  dimensoes finais do canvas.
- Testes para imagem horizontal, imagem vertical e sequencia de transformacao
  do canvas.

### Corrigido
- Corrigido o salvamento de novas capturas em formato paisagem quando o padrao
  dos relatorios exige retrato.

### Seguranca
- Resolucao, limite de tamanho, qualidade, marca d'agua e contratos de envio
  nao foram alterados.
- Fotos ja processadas e visitas presentes na fila nao sao regravadas.

### Validacao
- `npm.cmd test`: 44 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Layout horizontal `4032 x 3024` validado com saida vertical `624 x 832`.
- Layout vertical `3024 x 4032` validado sem rotacao adicional.
- Preview `6a72149ece193f00d3302e83` publicado no alias `pwa-offline` com o
  bundle `index-BUNS3CZt.js` confirmado pela URL publica.

### Pendencias
- Validar uma nova captura real no Android e no iPhone antes de promover para
  producao.

## [2026-08-04] - Painel supervisor interativo em homologacao

### Alterado
- Os oito indicadores do painel supervisor passaram a atuar como filtros da
  lista de promotores; selecionar novamente o mesmo card limpa o recorte.
- O painel passou a exibir o indicador selecionado, sua regra, a quantidade de
  promotores no recorte e uma busca por nome, identificador, regiao ou loja.
- O nome visivel da etapa `Check-out` passou a ser `Finalizacao da Visita` e o
  item lateral foi abreviado para `Finalizacao`.

### Adicionado
- Politica testavel para restaurar a tela correta de acordo com o papel da
  sessao.
- Testes de filtros do painel, busca sem acentos e restauracao da navegacao.
- Estado vazio quando nenhum promotor corresponde ao indicador e a busca.

### Corrigido
- O card `Visitas Concluidas` agora mostra `completedVisits`, em vez de contar
  somente promotores cujo ultimo status era concluido.
- Uma sessao restaurada de supervisor volta diretamente para `Gestao de
  Equipe`, sem abrir incorretamente o painel operacional do promotor.
- O rotulo `Promotores Off Line` foi substituido por `Sem Atualizacao Recente`,
  refletindo a regra real de ausencia de atualizacao por 15 minutos.

### Seguranca
- Os filtros sao aplicados apenas aos dados autorizados retornados pelo backend.
- Identificadores tecnicos `CHECKOUT`, `checkOutTime`, `FOTO_CHECKOUT` e os
  contratos existentes com Make e Sheets foram preservados.
- Nenhuma credencial, permissao ou regra de autenticacao foi alterada.

### Validacao
- `npm.cmd test`: 41 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 15 Functions empacotados com sucesso.
- Chromium movel controlado confirmou oito cards, filtro de concluidas, busca
  por regiao, detalhe do promotor, restauracao da sessao e ausencia de overflow.
- Preview `6a72106362a54cb62aa86414` publicado no alias `pwa-offline`.

### Pendencias
- Validar os indicadores com o login supervisor e os dados reais do cliente.
- Promover para producao somente depois da aprovacao da homologacao.
- O build mantem o aviso conhecido de chunk JavaScript acima de `500 KB`.

## [2026-08-04] - PWA-4 em homologacao: liberacao segura apos envio offline

### Alterado
- A tentativa de sincronizacao passa a distinguir falha de rede de erro HTTP,
  autorizacao ou armazenamento local.
- Depois de uma falha de rede, a visita confirmada na fila volta para `Selecao
  de Unidade`, permitindo iniciar outra operacao.

### Adicionado
- Politica central de falha de sincronizacao com status, mensagem e decisao de
  liberar ou preservar a visita atual.
- Atualizacao imediata do indicador da fila quando a tentativa offline termina.
- Dois testes para garantir liberacao em falha de rede e bloqueio em erro HTTP.

### Corrigido
- Corrigido o estado em que `Failed to fetch` mantinha o promotor preso na tela
  de sincronizacao mesmo depois de a visita estar salva no IndexedDB.

### Seguranca
- O reset so acontece depois de `upsertQueuedVisit` e da atualizacao persistida
  do item da fila.
- Falha ao gravar localmente, `401` e demais respostas HTTP nao apagam nem
  liberam o rascunho atual.
- A fila continua isolada por proprietario e preserva o `visitId` idempotente.

### Validacao
- `npm.cmd test`: 35 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 14 Functions empacotados com sucesso.
- Preview `6a71f71882d36e00e8e15a60` publicado no alias `pwa-offline`.
- Chromium offline confirmou uma visita `pending` com proprietario, loja,
  payload e foto de check-out, seguida de retorno a selecao de unidade.
- Reabertura offline confirmou fila pendente e nova operacao disponivel.

### Pendencias
- Repetir duas visitas completas sem rede em um celular real.
- Recuperar a conexao e confirmar o envio integral das duas visitas antes de
  promover para producao.
- O build mantem o aviso conhecido de chunk JavaScript acima de `500 KB`.

## [2026-08-04] - PWA-2 em homologacao: cadastro operacional offline

### Alterado
- A carga inicial do promotor usa a rede como fonte principal e, somente em
  falha de conexao, consulta o cadastro operacional salvo no aparelho.
- O preview passa a usar o alias estavel `pwa-offline`, evitando perder sessao
  e cache a cada novo deploy de homologacao.

### Adicionado
- Cache de lojas e industrias isolado por `user.id`, com versao, proprietario,
  papel, data de gravacao e validade maxima de sete dias.
- Seis testes para chave por usuario, validade, rejeicao de dados indevidos,
  preservacao do cadastro, classificacao de falha e persistencia local.

### Corrigido
- Corrigida a tela `Erro de Conexao` depois que um promotor ja autenticado
  reabria o aplicativo sem internet.

### Seguranca
- O fallback e exclusivo de `FIELD_OPS` e rejeita cache de outro usuario,
  supervisor, data futura ou registro expirado.
- Respostas HTTP e erros de autorizacao nao usam dados locais como alternativa;
  um `401` continua exigindo nova autenticacao.
- Nenhuma senha ou token novo e armazenado no cache operacional.

### Validacao
- `npm.cmd test`: 33 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npx.cmd netlify build`: build e 14 Functions empacotados com sucesso.
- Preview `6a71f453aad1cc00807215bc` publicado no alias `pwa-offline`.
- Contexto Netlify `branch-deploy` confirmado com sessao, Google Sheets, Make
  V2 e modo `visit-v2`; smoke de login retornou `401` sem erro de configuracao.
- Chromium controlado confirmou app shell, sessao local, promotor e loja
  autorizada restaurados com rede bloqueada e sem tela de erro.

### Pendencias
- Repetir o ciclo online/offline com um promotor real no celular.
- Finalizacao de visita totalmente offline pertence a PWA-4 e ainda nao esta
  liberada.
- O build mantem o aviso conhecido de chunk JavaScript acima de `500 KB`.

## [2026-08-04] - PWA-1 em homologacao: app shell offline seguro

### Alterado
- O service worker descobre e armazena os arquivos JS e CSS versionados que o
  Vite referencia no HTML de cada deploy.
- O registro inclui o hash do bundle na URL do worker e ignora caches HTTP ao
  procurar atualizacoes.
- O manifesto passa a declarar identificador estavel e idioma `pt-BR`.

### Adicionado
- Cache separado por versao do bundle, mantendo simultaneamente os arquivos da
  versao ativa e de uma atualizacao em espera.
- Headers Netlify de revalidacao para `sw.js` e `manifest.webmanifest`.
- Quatro testes automatizados para ciclo seguro, rotas sensiveis, politica de
  assets e descoberta dos hashes do Vite.

### Corrigido
- Removido `skipWaiting()`, que poderia trocar o aplicativo durante uma visita.
- Corrigido o app shell incompleto, que nao incluia o JavaScript e CSS do build.
- Ampliada a exclusao de cache para cobrir tambem `/.netlify/functions/*`.
- A limpeza agora remove somente caches antigos do proprio Criativa.
- Corrigido o escopo Netlify de `APP_SESSION_SECRET` e
  `BACKEND_GOOGLE_SHEETS_ID`, que estavam disponiveis em producao, mas ausentes
  no primeiro deploy de homologacao.

### Seguranca
- Login, APIs, Functions e respostas operacionais permanecem sempre fora do
  cache do service worker.
- Atualizacoes usam caches imutaveis separados e so assumem depois que a versao
  anterior deixa de controlar telas abertas.
- O preview reutiliza os mesmos valores seguros de producao para sessao e ID da
  planilha, sem imprimir, regenerar ou colocar segredos no repositorio.

### Validacao
- `npm.cmd test`: 27 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido com sucesso.
- `npx.cmd netlify build`: build e 14 Functions empacotados com sucesso.
- Preview Netlify `6a71f05972b672208276f792` respondeu `200` para app shell,
  manifesto, service worker, CSS e JavaScript.
- Healthcheck do novo preview confirmou sessao, Google Sheets e Make V2
  configurados.
- Smoke test de login com credencial deliberadamente invalida retornou `401`
  por credencial, sem erro de configuracao do backend.
- Chromium controlado confirmou worker `activated`, tela carregada offline e
  sete recursos presentes no cache versionado.
- Simulacao de atualizacao confirmou worker atual em `active`, novo worker em
  `waiting` e caches separados.

### Pendencias
- Validar instalacao e reabertura offline em um Android real.
- Validar instalacao e reabertura offline em um iPhone real.
- Promover para producao somente depois desses dois testes.
- O build mantem o aviso conhecido de chunk JavaScript acima de `500 KB`.

## [2026-08-04] - PWA-0: metodologia segura e baseline offline

### Alterado
- O backlog e o checklist passam a dividir a evolucao instalavel/offline em
  subfases independentes, cada uma com gate de nao regressao.

### Adicionado
- `METODOLOGIA_PWA_OFFLINE.md` com invariantes, protocolo de entrega, matriz de
  testes, migracao aditiva, observabilidade, condicoes de parada e rollback.
- Baseline de referencia para preservar a versao funcional anterior ao trabalho
  offline.

### Corrigido
- Eliminado o risco de iniciar uma alteracao ampla de PWA sem criterios formais
  de aceite, recuperacao e compatibilidade com dados locais existentes.

### Seguranca
- Definido que APIs autenticadas, tokens e login nunca serao armazenados pelo
  cache HTTP do service worker.
- Definidas regras de isolamento por usuario, idempotencia, logs sanitizados e
  revalidacao obrigatoria no backend.

### Validacao
- `npm.cmd test`: 23 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido com sucesso.
- `npx.cmd netlify build`: build e empacotamento de 14 Functions concluidos.
- Tag `pwa-offline-baseline-2026-08-04` criada no commit funcional
  `dde4d53cd045e5197e541ea20b7b366ea8fc5611` e publicada no GitHub.
- Revisao documental confirmou ausencia de mudanca em arquivos de runtime.

### Pendencias
- Iniciar PWA-1 somente depois da conclusao formal de PWA-0.
- O build mantem o aviso conhecido de chunk JavaScript acima de `500 KB`.

## [2026-08-04] - Ajuste: reducao de 35% na resolucao das fotos

### Alterado
- O lado maior padrao das fotos passa de `1280 px` para `832 px`.
- Os fallbacks foram reduzidos proporcionalmente para `749`, `666`, `624`,
  `582` e `520 px`, preservando a proporcao original da captura.

### Adicionado
- Teste de regressao para garantir a reducao linear exata de 35% e os novos
  degraus de resolucao.

### Corrigido
- Reduzido o volume potencial de dados e armazenamento para aparelhos com
  cameras de alta resolucao, sem alterar o formato JPEG ou o carimbo.

### Seguranca
- O alvo de `100 KB` e o teto obrigatorio de `120 KB` continuam ativos.

### Validacao
- `npm.cmd test`: 23 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o aviso conhecido de chunk
  JavaScript acima de 500 KB.

### Pendencias
- Conferir legibilidade do carimbo e dos produtos em uma captura feita por
  iPhone e outra por aparelho Android.

## [2026-08-04] - Correcao: retorno imediato e painel de envios no cabecalho

### Alterado
- Depois que a visita e persistida e o background e aceito, o promotor retorna
  imediatamente para `Selecao de Unidade`, sem aguardar o upload das fotos.
- O reset da visita preserva usuario, industrias e lojas ja carregadas.
- O acompanhamento da fila passa de 15 para 5 segundos enquanto o aplicativo
  esta aberto, alem de atualizar ao recuperar foco ou conexao.

### Adicionado
- Icone de upload no cabecalho com contador de visitas pendentes.
- Modal de status com loja, ID da visita, fotos confirmadas, total, percentual,
  barra de progresso e eventual erro de sincronizacao.
- Botao para atualizar o status sob demanda sem reiniciar o envio.

### Corrigido
- Removida a navegacao incorreta para o painel de progresso depois de iniciar o
  envio em segundo plano.
- O promotor pode iniciar a selecao da proxima loja enquanto o servidor conclui
  a visita anterior.

### Seguranca
- O painel consulta apenas visitas da fila local pertencentes ao usuario atual.
- O percentual vem do manifesto seguro do backend e nao considera uma foto
  enviada ate existir confirmacao persistida do Drive.

### Validacao
- `npm.cmd test`: 23 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece somente o aviso conhecido de chunk
  JavaScript acima de 500 KB.

### Pendencias
- Validar em um aparelho real o retorno imediato com um envio grande em curso e
  conferir a progressao do indicador no cabecalho.

## [2026-08-04] - Correcao: pastas por industria, envio em segundo plano e nome do PDV

### Alterado
- O cenario Make V2 organiza fotos em `INDUSTRIA/DATA_DA_VISITA`, como no fluxo
  operacional anterior, e reutiliza pastas e arquivos existentes.
- Fachada e checkout sao arquivados em cada industria com evidencia na visita.
- A sincronizacao passa a ser iniciada por Netlify Background Function e deixa
  a interface livre depois que a visita completa foi salva no backend.
- A fila local consulta o status do backend e remove automaticamente visitas
  confirmadas como enviadas.

### Adicionado
- Funcao `visit-sync-background` com limite operacional de 100 lotes e duracao
  maxima gerenciada pelo runtime de background do Netlify.
- Contrato Make `2.1` com `PASTA_INDUSTRIA_NOME` e links das pastas por industria
  no fechamento agregado da visita.
- Teste do formato GViz usado pela planilha real.

### Corrigido
- O carimbo da foto e a visita deixam de usar `GRUPO_REDE` como nome do PDV.
  O leitor agora usa o rotulo real `NOME_LOJA`, preservando nomes como
  `EXTRABOM SUPERMERCADOS - JD AMERICA`.
- A primeira linha de promotores retornada pelo GViz deixa de ser descartada.
- Corrigidos tambem os mapeamentos de `REGIONAL_LOJA` e
  `ID_PROMOTOR_RESPONSAVEL`.

### Seguranca
- A funcao de background recebe somente o ID da visita ja persistida e exige a
  mesma autenticacao e regra de acesso do promotor ou supervisor.
- Base64, webhook e credenciais continuam fora da URL e do frontend.
- O cenario legado permanece ativo e nao foi alterado.

### Validacao
- Planilha real conferida: `GRUPO_REDE` na coluna B e `NOME_LOJA` na coluna C.
- Make real: criacao de industria/data, reutilizacao da data, segundo arquivo e
  reenvio idempotente aprovados.
- Preview Netlify `6a71daebf3d78a601bb1fe68`: healthcheck aprovado e rota
  de background respondeu HTTP 202.
- `npm.cmd test`: 23 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build` e `npx.cmd netlify build`: concluidos; permanece apenas o
  aviso conhecido de chunk JavaScript acima de 500 KB.

### Pendencias
- Remover manualmente a industria tecnica `_TESTE_ORGANIZACAO_V2` do Drive
  depois da conferencia visual da hierarquia. Ela nao participa da producao.

## [2026-08-03] - Etapa B concluida: envio integral de fotos

### Alterado
- A producao passa a usar `BACKEND_MAKE_SYNC_MODE=visit-v2` com webhook exclusivo.
- Cada foto e enviada em uma requisicao confirmada pelo Google Drive e a visita
  somente e finalizada depois de todas as confirmacoes.
- A aba `RELATORIO_VISITAS` permanece com uma linha por visita e agora usa
  `ID_VISITA` para criar ou atualizar o mesmo registro.

### Adicionado
- Cenario Make `Criativa Field Ops - Upload V2`, separado do cenario legado.
- Busca idempotente de pasta e arquivo antes do upload.
- Busca da visita na planilha antes de adicionar ou atualizar a linha.
- Manifesto persistente com IDs e links de cada arquivo confirmado.

### Corrigido
- Removida da operacao nova a limitacao que enviava somente a primeira foto de
  cada etapa.
- Reenvios da mesma foto deixam de gerar arquivos duplicados.
- Reenvios da finalizacao deixam de gerar linhas duplicadas na planilha.
- O painel supervisor exibe o total de promotores cadastrados no primeiro
  indicador, sem confundir cadastro com atividade nos ultimos 15 minutos.

### Seguranca
- O webhook V2 foi configurado somente nas variaveis protegidas do Netlify.
- O token administrativo do Make permanece criptografado localmente e ignorado
  pelo Git.
- O cenario legado foi preservado para rollback por variavel, sem edicao ou
  desativacao.

### Validacao
- Teste de contrato: 90 fotos preservadas, incluindo 30 imagens identicas.
- Upload real: HTTP 200 com `PHOTO_UPLOADED`, `fileId` e `folderId`.
- Reenvio real: o mesmo arquivo foi localizado e reutilizado em 4 operacoes.
- Planilha real: primeira finalizacao criou a linha 59 e a segunda atualizou a
  mesma linha pelo `ID_VISITA`; os 30 campos e acentos foram conferidos.
- A linha tecnica criada para validacao foi removida apos a conferencia.
- Preview Netlify `6a713a9188d577e6159d2cd4`: healthcheck com
  `makeV2=true` e `makeSyncMode=visit-v2`.
- `npm.cmd test`: 22 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.

### Pendencias
- Remover manualmente do Drive as seis pastas `_TESTE_TECNICO_V2_*`; a conexao
  usada pela auditoria nao possui permissao para excluir arquivos criados pela
  conexao do Make. Elas nao participam do fluxo de producao.

## [2026-08-03] - Correcao emergencial: fotos completas e cadastro no supervisor

### Alterado
- O contrato Make V2 preserva todas as capturas na ordem registrada, inclusive
  quando duas fotos possuem conteudo identico.
- O primeiro indicador do painel supervisor passa a exibir promotores
  cadastrados, em vez de apresentar como "ativos" somente usuarios com visita
  atualizada nos ultimos 15 minutos.

### Adicionado
- Teste de regressao com 90 fotos de uma industria, incluindo 30 capturas
  identicas, garantindo IDs distintos e nenhuma perda por deduplicacao.

### Corrigido
- Removida a deduplicacao por conteudo que poderia descartar uma captura valida
  no envio individual V2.
- Corrigida a interpretacao incorreta de promotor cadastrado como promotor
  online no resumo supervisor.

### Seguranca
- O modo de producao permanece `legacy` ate o webhook V2 ser criado e validado
  no Make; ativar o contrato sem o cenario correspondente interromperia os
  envios existentes.
- Nenhuma credencial foi adicionada ao codigo.

### Validacao
- `npm.cmd test`: 22 testes aprovados, incluindo 90 fotos preservadas.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.

### Pendencias
- Configurar e testar o cenario Make V2, definir
  `BACKEND_MAKE_WEBHOOK_V2_URL` e somente entao alterar
  `BACKEND_MAKE_SYNC_MODE` para `visit-v2`.

## [2026-08-03] - Correcao: dados reais do supervisor e diagnostico de fotos

### Alterado
- O painel supervisor passa a associar visitas por ID ou usuario e atualiza os
  dados automaticamente a cada 60 segundos.
- Contas com `ROLE=SUPERVISOR` deixam de ser contadas como promotores de campo.
- O horario de atualizacao do painel passa a considerar a visita mais recente.

### Adicionado
- Promotores historicos continuam visiveis quando possuem visitas, mesmo que o
  acesso provisorio tenha expirado ou sido removido do cadastro atual.
- Contagem unica de fotos no payload geral, nos fluxos por industria e nas
  devolucoes.
- Guia separado para token da API Make, Google OAuth e ativacao do webhook V2.
- Testes automatizados para associacao historica, exclusao de supervisores e
  contagem completa de fotos.

### Corrigido
- Quatorze visitas do antigo usuario provisorio deixam de ficar sem promotor na
  lista do supervisor.
- O detalhe da visita deixa de contar apenas as fotos do formato legado.

### Seguranca
- Nenhuma credencial real foi lida ou adicionada ao repositorio.
- O modo de sincronizacao permaneceu `legacy` porque o webhook V2 ainda nao esta
  configurado; a ativacao prematura bloquearia os envios atuais.
- O token Make deve ser armazenado em cofre de segredos ou gerenciador de
  senhas, nunca no Git, frontend ou planilha.

### Validacao
- Auditoria de 34 visitas reais: 30 enviadas, 3 com erro e 1 pendente; 14 eram
  do usuario provisorio historico.
- Auditoria de fotos: 96 referencias no formato geral, 607 nos fluxos por
  industria e nenhum manifesto V2, confirmando que o V2 nunca foi ativado.
- `npm.cmd test`: 21 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.
- Deploy de preview `6a71248ce4aab4cb4506a9ae`: pagina, healthcheck e
  configuracao `200`; painel sem sessao `403`.
- Deploy de producao `6a7124cd2ac43ea1629ff1a5` realizado no Project ID
  `84267a1b-133d-44c9-b5e8-1a3182c19307` da equipe `Criativa`.

### Pendencias
- Criar e validar o cenario Make V2 antes de configurar
  `BACKEND_MAKE_WEBHOOK_V2_URL` e alterar o modo para `visit-v2`.
- Publicar o cliente OAuth Google usado pelo Make como `In production` e
  reautorizar a conexao uma vez para remover a expiracao de sete dias.

## [2026-08-03] - Implantacao: transferencia do Netlify para o cliente

### Alterado
- A propriedade do projeto Netlify foi transferida da equipe `Zylo` para a
  equipe `Criativa` (`philipe-almeida19`).
- A documentacao tecnica passou a registrar equipe, projeto, URL e Project ID
  oficiais de producao.

### Adicionado
- Inventario pre e pos-transferencia de configuracao e persistencia.
- Regra operacional para conferir equipe e Project ID antes de cada deploy.

### Corrigido
- A infraestrutura de producao deixou de depender da equipe pessoal de
  desenvolvimento, mantendo o projeto sob propriedade do cliente.

### Seguranca
- Os valores das oito variaveis de ambiente nao foram exibidos nem gravados no
  repositorio; somente os nomes foram conferidos.
- A transferencia manteve o mesmo Project ID, evitando copia manual de segredos
  e de dados operacionais.
- Nenhum login real foi usado nos smoke tests, preservando as sessoes ativas.

### Validacao
- Baseline antes da transferencia: pagina, healthcheck e configuracao `200`;
  rotas protegidas sem sessao `401`/`403`.
- `npm.cmd test`: 19 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.
- Inventario preservado antes e depois: 8 variaveis, 1 cache, 11 sessoes, 33
  visitas e 33 uploads em Netlify Blobs.
- Deploy de preview na equipe `Criativa` `6a70d52fbde11d15bdac3fc0`: pagina,
  healthcheck e configuracao `200`; rotas protegidas `401`/`403`.
- Deploy de producao `6a70d565da2e2ccab6413a53`: Google Sheets, Make e segredo
  de sessao ativos; login inexistente retornou `401`.
- Producao confirmada na equipe `Criativa`, Project ID
  `84267a1b-133d-44c9-b5e8-1a3182c19307` e URL original preservada.

### Pendencias
- Nenhuma pendencia funcional ou de infraestrutura conhecida nesta
  transferencia.

## [2026-08-03] - Correcao: atualizacao de cadastros e perfis

### Alterado
- O cache cadastral do backend passou a ter validade de dois minutos, em vez de
  permanecer valido indefinidamente.
- A leitura do Google Sheets passou a solicitar uma resposta sem cache HTTP.

### Adicionado
- Registro interno de horario do cache, separado do horario exibido no app.
- Testes automatizados para cache valido, expirado, ausente, invalido e futuro.

### Corrigido
- Novos usuarios cadastrados na aba `PROMOTORES` passam a ser reconhecidos apos
  a renovacao automatica do cache.
- Alteracoes de `ROLE` passam a ser carregadas pelo backend sem exigir novo
  deploy ou mudanca manual da versao do cache.

### Seguranca
- Se o Google Sheets estiver temporariamente indisponivel, o ultimo cadastro
  operacional valido continua sendo usado.
- O perfil da sessao ativa nao e alterado silenciosamente; uma mudanca de
  `ROLE` entra em vigor no proximo login.

### Validacao
- Leitura real da aba `PROMOTORES`: 25 cadastros validos, dois supervisores e
  nenhum usuario duplicado.
- `npm.cmd test`: 19 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.
- Deploy de preview `6a70d06ac92acc73f0490652`: pagina, healthcheck e
  configuracao responderam `200`; login inexistente retornou `401`.
- Deploy de producao `6a70d0adbde11deffdac411d`: Google Sheets, Make e segredo
  de sessao permaneceram configurados; rotas protegidas sem sessao retornaram
  `401`/`403`.
- O timestamp cadastral de producao mudou de `14:06` para `14:33`, confirmando
  a leitura da planilha e a gravacao do cache schema 4.

### Pendencias
- Nenhuma pendencia funcional conhecida nesta correcao.

## [2026-08-03] - Correcao: cadastro real de promotores e perfis

### Alterado
- O backend passou a ler primeiro a aba real `PROMOTORES` e manteve
  `CADASTRO_PROMOTORES` como fallback legado.
- O mapeamento de ID, nome, usuario, senha, regional e perfil agora usa os
  cabecalhos, sem depender rigidamente da ordem das colunas.
- O cache cadastral passou para o schema 3; se a leitura nova falhar, o cadastro
  operacional anterior continua sendo usado.

### Adicionado
- Coluna `ROLE` na aba `PROMOTORES`, com lista restrita a `FIELD_OPS` e
  `SUPERVISOR`.
- Testes automatizados para o formato atual, perfis, colunas reordenadas, linhas
  incompletas e compatibilidade com o nome antigo da aba.

### Corrigido
- Novos cadastros deixam de depender de um cache criado quando a aba ainda tinha
  outro nome.
- O cabecalho acentuado `USUÁRIO` nao pode mais ser interpretado como um login.

### Seguranca
- Nenhum ID, usuario, senha, regional ou perfil existente foi alterado.
- Cadastros sem `ROLE` continuam como `FIELD_OPS`, preservando as regras antigas
  de supervisor por regional e variavel segura.
- Nao foi realizado login com conta real durante os testes, evitando invalidar
  sessoes ativas pela regra de usuario unico.

### Validacao
- Leitura real da aba `PROMOTORES`: 24 cadastros validos, nenhum usuario
  duplicado e nenhuma linha incompleta.
- Verificacao da planilha apos a escrita: `ROLE` em `F1` e validacao de lista em
  `F2:F990`; demais celulas permaneceram inalteradas.
- `npm.cmd test`: 16 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.
- `npx.cmd netlify functions:build --src netlify/functions`: todas as Functions
  compiladas com sucesso.
- Deploy de preview `6a70c9e3bbcb06348c7c84a4`: pagina e configuracao
  publica `200`, lojas sem sessao `401` e painel supervisor `403`.
- Deploy de producao `6a70ca572b15f2aa93b03275`: pagina, healthcheck e
  configuracao `200`; Google Sheets e Make permaneceram configurados.
- O timestamp cadastral de producao foi atualizado para `03/08/2026`,
  confirmando a reconstrucao do cache v3 pela aba real `PROMOTORES`.
- Tentativa de login com os textos do cabecalho `USUÁRIO`/`SENHA` retornou
  `401`, confirmando que o cabecalho nao e mais um cadastro.

### Pendencias
- Definir `ROLE` explicitamente nos supervisores permanentes. As linhas vazias
  permanecem como promotor por compatibilidade.

## [2026-07-28] - Correcao: padronizacao adaptativa das fotos

### Alterado
- O processamento de fotos passou a buscar a maior qualidade JPEG que atende ao
  alvo de 100 KB, em vez de depender apenas de uma porcentagem fixa.
- Fotos complexas agora reduzem progressivamente o lado maior de 1280 ate 800
  pixels somente quando a reducao de qualidade nao for suficiente.
- O arquivo original e lido por URL temporaria, reduzindo o pico de memoria em
  aparelhos com cameras de alta resolucao.

### Adicionado
- Teto tecnico de 120 KB por foto processada.
- Servico isolado de compressao de imagens e testes para seus limites.
- Medicao da amostra real do Drive e projecao para 8.000 fotos por dia no
  diagnostico tecnico.

### Corrigido
- Fotos detalhadas de aparelhos como iPhone nao podem mais chegar ao payload com
  200 a 250 KB apesar da qualidade JPEG configurada.
- A documentacao da Etapa B agora confirma upload individual das fotos e apenas
  uma linha agregada por visita na planilha.

### Seguranca
- Nenhuma credencial, URL de webhook ou regra de autenticacao foi alterada.
- O teto impede que uma foto excepcional aumente sem controle o payload local e
  o consumo da sincronizacao.

### Validacao
- `npm.cmd test`: 12 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk
  grande.
- Smoke test no Chrome com o modulo real: imagem simples em 10.639 bytes a
  1280x960 e imagem de estresse em 95.478 bytes a 800x600, ambas abaixo do teto.
- Deploy de preview `6a68204c06bf269602a4fd5d`: pagina e healthcheck `200`;
  rota de visitas protegida retornou `401`.
- Deploy de producao `6a682090cbecba85ef76e7c3`: pagina, healthcheck e
  configuracao publica `200`; Google Sheets e Make legado permaneceram
  configurados e a rota de visitas sem sessao retornou `401`.

### Pendencias
- Homologar visualmente fotos reais de iPhone e Android nos relatorios antes de
  avaliar qualquer reducao adicional.
- Ativar o contrato Make v2 somente depois do teste real de Drive, planilha,
  idempotencia e uma linha por visita.

## [2026-07-27] - Correcao: isolamento e limpeza da fila por usuario

### Alterado
- A fila local passou a identificar explicitamente o proprietario de cada visita.
- Contagem, popup, reenvio, atualizacao e remocao agora usam apenas a fila do
  usuario autenticado.
- Filas antigas sem `ownerId` usam o ID existente no payload da propria visita;
  itens sem dono identificavel nao sao exibidos a outro usuario.

### Adicionado
- Acao `Limpar minha fila` no popup e na tela de sincronizacao, com confirmacao.
- Regra compartilhada de autorizacao para visitas persistidas no backend.
- Testes automatizados para dois promotores, fila legada e acesso de supervisor.

### Corrigido
- Trocar de usuario no mesmo celular nao mostra nem reenvia a fila do usuario anterior.
- Consultas de fila iniciadas antes da troca de login nao podem reabrir o popup
  para o novo usuario.
- Limpar a fila de um usuario preserva as filas dos demais usuarios do aparelho.
- Promotores nao podem listar, consultar, alterar, sobrescrever ou reenviar
  visitas pertencentes a outro promotor no backend.

### Seguranca
- O backend valida propriedade da visita nas rotas de listagem, status, update,
  upload fracionado, sincronizacao e retry.
- Tentativas de usar um `visitId` de outro usuario retornam visita nao encontrada.
- Supervisores mantem acesso geral para acompanhamento e auditoria.
- Nenhum dado pendente foi apagado automaticamente durante a migracao.

### Validacao
- `npm.cmd test`: 10 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk grande.
- A compilacao isolada das Functions gerou todos os bundles, mas a CLI nao
  encerrou dentro do limite local.
- Deploy de preview `6a680a2469b5e71ea9269ed3`: pagina e healthcheck `200`;
  bundle confirmou o controle de limpeza e cinco rotas protegidas retornaram `401`.
- Deploy de producao `6a680aa2bc233b87dbe0ac61`: pagina e healthcheck `200`,
  Google Sheets e Make configurados e sincronizacao preservada em `legacy`.
- O build das Functions foi validado durante os dois deploys Netlify.

### Pendencias
- Validar em dois logins reais no mesmo celular depois da publicacao.
- A limpeza e local ao aparelho e ao usuario autenticado; registros preservados
  no backend nao sao apagados por essa acao.

## [2026-07-17] - Etapa B: contrato seguro para Drive e linha unica por visita

### Alterado
- O modelo da planilha foi consolidado para uma linha por visita, sem linha por foto.
- As abas vazias `FOTOS_VISITA` e `ANALISES_FOTO` foram renomeadas para
  `MANIFESTOS_VISITA` e `ANALISES_VISITA`, com cabecalhos de resumo por visita.
- Os campos adicionais de `RELATORIO_VISITAS` agora guardam industrias, estoque,
  trocas, contagens, pasta do Drive e status do upload de forma agregada.
- O frontend passou a continuar as chamadas de sincronizacao enquanto o backend
  confirma lotes de fotos, sem alterar o fluxo visual das etapas de campo.

### Adicionado
- Contrato Make v2 com um evento `PHOTO_UPLOAD` por foto e um unico evento
  `VISIT_FINALIZE` por visita.
- IDs deterministicos, nomes de arquivo com hash e manifesto persistente para
  permitir retry sem repetir fotos ja confirmadas.
- `BACKEND_MAKE_WEBHOOK_V2_URL`, isolada do webhook legado.
- Validacao estrita das respostas do Drive e do `UPSERT_BY_ID_VISITA`.
- `CONFIGURACAO_MAKE_ETAPA_B.md` com mapeamentos, respostas e rollback.
- Testes automatizados do contrato v2 e da regra de linha unica.

### Corrigido
- O novo fluxo nao considera mais uma resposta HTTP 200 antecipada como prova de
  que a foto chegou ao Drive.
- O fechamento v2 nao envia base64 e so ocorre depois da confirmacao de todas as fotos.
- Reenvios v2 ignoram fotos ja confirmadas no manifesto e atualizam a mesma linha.

### Seguranca
- O modo `visit-v2` exige um webhook exclusivo e nao reutiliza silenciosamente o legado.
- Producao permanece em `legacy` ate o cenario externo estar configurado e validado.
- Nenhum webhook, token, chave ou credencial foi adicionado ao repositorio ou frontend.

### Validacao
- `npm.cmd test`: 7 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido; permanece apenas o warning conhecido de chunk grande.
- `npx.cmd netlify functions:build --src netlify/functions`: Functions compiladas.
- Teste integrado local com duas industrias e oito fotos: progresso `3/8`, `6/8`
  e `8/8`, oito confirmacoes de foto e exatamente um fechamento.
- Retry apos o sucesso nao emitiu novos eventos, confirmando idempotencia local.
- Cabecalhos das tres abas alteradas foram relidos depois da gravacao.
- Deploy de preview `6a5a23207b3bd562858a378a`: pagina e healthcheck `200`,
  com modo `legacy` e webhook v2 desativado.
- Deploy de producao `6a5a23754840b269b602867f`: pagina e healthcheck `200`.
- Producao confirmou Google Sheets e Make legado configurados,
  `BACKEND_MAKE_SYNC_MODE=legacy` e `makeV2=false`.
- Endpoint de retry em producao rejeitou requisicao sem sessao com `401`.

### Pendencias
- Configurar o novo cenario no Make e posicionar `Webhook response` depois do Drive/Sheets.
- Executar uma visita controlada contra o Google Drive real e comprovar arquivos abrindo.
- Comprovar exatamente uma linha por `ID_VISITA` e um retry sem duplicacao no ambiente real.
- Somente depois dessas validacoes ativar `BACKEND_MAKE_SYNC_MODE=visit-v2`.
- Linhas historicas duplicadas nao foram consolidadas para evitar perda de dados sem
  uma regra de reconciliacao aprovada.

## [2026-07-16] - Etapa A: payload grande e estrutura de relatorios

### Alterado
- Visitas acima de 4 MB passaram a ser persistidas em fragmentos de ate 1,5 MB.
- A sincronizacao passou a usar a visita ja salva no backend, eliminando o segundo envio integral do navegador.
- O payload de relatorio passou a incluir ID por visita/industria, contagens de fotos e estados de analise, revisao e relatorio.
- A identidade salva em novos uploads passa a ser obtida da sessao autenticada, e nao do corpo enviado pelo navegador.

### Adicionado
- Endpoint autenticado `/api/visits/upload` para receber e remontar visitas grandes.
- Verificacao SHA-256 do payload reconstruido antes da persistencia.
- Testes automatizados de divisao UTF-8 e remontagem de payload.
- `DIAGNOSTICO_ENVIO_FOTOS.md` com matriz de testes, causa comprovada e limites operacionais.
- Abas `FOTOS_VISITA`, `ANALISES_FOTO` e `RELATORIOS_INDUSTRIA` na planilha Sistema Criativa.
- Novos campos de referencia na aba `INDUSTRIAS` e de resumo na aba `RELATORIO_VISITAS`.

### Corrigido
- Payloads proximos ou superiores a 6 MB deixam de depender de uma unica requisicao Netlify.
- Visitas com 20 ou 30 fotos deixam de falhar antes de chegar ao backend.
- Uploads grandes corrompidos ou incompletos passam a ser rejeitados antes de salvar a visita.

### Seguranca
- Fragmentos ficam isolados pelo ID do usuario autenticado.
- Upload, finalizacao e retry continuam exigindo sessao valida.
- IDs, quantidade de fragmentos e limite total recebem validacao no backend.
- Nenhum segredo ou webhook foi movido para o frontend.

### Validacao
- Limite publicado reproduzido com corpos de 1 MB, 4 MB, 5 MB, 5,8 MB, 6 MB, 6,2 MB e 7 MB.
- `npm.cmd test`: 3 testes aprovados.
- `npm.cmd run lint`: concluido sem erros.
- `npm.cmd run build`: concluido, mantendo apenas o warning conhecido de chunk grande do Vite.
- Netlify Functions compiladas com sucesso usando `npx.cmd netlify functions:build --src netlify/functions`.
- Teste integrado local com 20 fotos: 6.654.940 bytes, 5 fragmentos e integridade confirmada.
- Teste integrado local com 30 fotos: 9.982.290 bytes, 7 fragmentos e integridade confirmada.
- Deploy de preview `6a592566b5288eca18a7ec54`: pagina e healthcheck retornaram `200`.
- Novo endpoint no preview retornou `401` para fragmento de 1,5 MB sem autenticacao, conforme esperado.
- Deploy de producao `6a59264eee20c2c93be59837` concluido com sucesso.
- Producao validada com pagina `200`, healthcheck `ok=true`, Google Sheets, Make e segredo de sessao configurados.
- Bundle de producao confirmado com a nova rota fracionada e verificacao SHA-256.
- Novo endpoint em producao rejeitou corretamente um fragmento de 1,5 MB sem autenticacao com `401`.
- Novas abas e cabecalhos da planilha relidos apos a gravacao e confirmados.

### Pendencias
- Etapa B: adaptar o Make para enviar cada foto individualmente e gravar `FOTOS_VISITA`.
- Etapa B: preencher `LINK_FOTO_CHECKIN` com a URL retornada pelo Google Drive.
- O Make atual ainda processa somente uma foto principal por etapa; as demais ficam preservadas no backend.
- Os acessos provisorios continuam configurados, mas o healthcheck indica zero acessos validos na data desta entrega; criar ou renovar somente quando houver novo teste autorizado.

## [2026-07-14] - Analise: automacao de relatorios por industria

### Alterado
- Nenhuma funcionalidade, integracao ou dado de producao foi alterado.
- O fluxo de relatorios foi redesenhado a partir da planilha real e do book `VENEZA 70.pdf`.

### Adicionado
- `PROPOSTA_AUTOMACAO_RELATORIOS.md` com diagnostico, modelo de dados, fluxo de IA, revisao humana e geracao automatica de PDF.
- Proposta de manter `RELATORIO_VISITAS` como indice e registrar cada foto e analise em estruturas proprias.

### Corrigido
- Documentado que a IA atual analisa somente a primeira foto de `Depois` e nao usa a referencia cadastrada em `INDUSTRIAS`.
- Documentado que colunas de foto unica nao representam corretamente o limite de ate 30 fotos por etapa.

### Seguranca
- A consulta da planilha foi somente leitura e limitada aos cabecalhos e cinco linhas de amostra.
- Nenhuma credencial, webhook, permissao do Drive ou variavel de ambiente foi alterada.

### Validacao
- Planilha `Sistema Criativa`, aba `RELATORIO_VISITAS`, faixa `A1:AD6`, inspecionada em modo somente leitura.
- Planilha `Sistema Criativa`, aba `INDUSTRIAS`, faixa `A1:Z10`, inspecionada em modo somente leitura.
- As 26 paginas de `VENEZA 70.pdf` foram analisadas para mapear a estrutura do book atual.
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- `git diff --check` concluido sem erros de whitespace; houve apenas o aviso de conversao LF/CRLF do Git no Windows.
- Nenhum deploy de producao foi realizado, pois esta entrega e exclusivamente de arquitetura e documentacao.

### Pendencias
- Aprovar a arquitetura proposta antes de criar abas, alterar o Make, modificar a IA ou gerar o primeiro book automatico.
- Obter catalogos e regras de compliance versionados; o site institucional nao deve ser a unica referencia da IA.

## [2026-07-14] - Correcao: nome completo da loja no carimbo

### Alterado
- O cadastro de lojas deixou de depender exclusivamente da coluna fixa `c[1]`.
- A coluna do nome completo passou a ser localizada pelo cabecalho da aba `CADASTRO_LOJAS`.

### Adicionado
- Reconhecimento de cabecalhos como `NOME_LOJA`, `NOME_DA_LOJA`, `NOME_DO_PDV`, `NOME_PDV`, `PDV` e `LOJA`.
- Fallback para os indices antigos quando a planilha nao tiver cabecalho reconhecido.

### Corrigido
- O carimbo das fotos deixa de usar somente o nome da rede, como `PERIM`, quando a planilha possui o nome completo do PDV, como `Itapoa Supermercado - Mata da Praia`.

### Seguranca
- Nenhuma credencial, webhook ou chave foi alterada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify de producao `6a5635b920e1e2af2f1a9587` concluido com sucesso.
- `/api/health` validado em producao com `ok=true` e integracoes Google Sheets/Make configuradas.

### Pendencias
- Confirmar no aparelho uma nova foto apos a atualizacao do cadastro.

## [2026-07-14] - Correcao: fotos de devolucoes por empresa

### Alterado
- Fotos de `Trocas/Avarias` passaram a manter um indice explicito por industria selecionada.

### Adicionado
- Compatibilidade com o formato anterior de fotos dentro de `industryExecutions`.

### Corrigido
- Alternar entre duas ou mais empresas nao remove mais as fotos registradas na empresa anterior.
- A validacao de devolucoes continua baseada na resposta e nas fotos da empresa correspondente.

### Seguranca
- Nenhuma credencial, webhook ou chave foi alterada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify de producao `6a56203d7b3fd2489830eb02` concluido com sucesso.
- Producao validada com pagina `200` e `/api/health` com `ok=true`.

### Pendencias
- O erro `400 Invalid Value` do Make depende da configuracao do modulo Google Drive e sera corrigido no cenario, conforme orientacao registrada na entrega.

## [2026-07-12] - Correcao: continuidade da visita e limite de 30 fotos

### Alterado
- Rascunho completo da visita, incluindo fotos, migrado de `localStorage` para `IndexedDB`.
- Fila offline de sincronizacao migrada para `IndexedDB`, com migracao automatica de filas antigas.
- Limite de fotos centralizado em 30 para `Antes`, `Estoque`, `Depois` e `Trocas/Avarias`.
- Manuais e checklist atualizados com o funcionamento real da continuidade offline.

### Adicionado
- Persistencia sequencial do rascunho para evitar que gravacoes concorrentes restaurem uma versao antiga.
- Solicitacao de armazenamento persistente ao navegador quando a plataforma oferece esse recurso.
- Vinculo do rascunho ao ID do usuario que iniciou a visita.
- Aviso operacional caso o aparelho nao consiga salvar o progresso local.

### Corrigido
- `Trocas/Avarias` deixou de bloquear novas fotos ao atingir 10 e agora respeita o limite esperado de 30.
- Bloquear a tela, fechar a PWA, sair da conta ou expirar a sessao nao apaga mais uma visita em andamento.
- Apos nova autenticacao do mesmo usuario, o app retoma a etapa exata salva.
- Um login de outro usuario no mesmo aparelho nao herda o rascunho anterior.
- Fotos e payloads grandes deixaram de depender do limite reduzido do `localStorage`.

### Seguranca
- A expiracao de sessao continua exigindo nova autenticacao; somente o rascunho local e preservado.
- O rascunho fica associado ao usuario original para evitar continuidade por outra conta.
- Nenhuma credencial, webhook ou chave foi alterada ou exposta.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- `npx.cmd netlify status` confirmou autenticacao e vinculo ao projeto `criativa-field-ops-574`.
- Deploy de previa `6a545386fd98e0dae3e31f5b` validado com pagina `200`, healthcheck `ok=true` e bundle contendo as stores novas.
- Deploy Netlify de producao `6a5453e16508f4daeeb94ded` concluido com sucesso.
- Producao validada com pagina `200`, manifest PWA `200`, `/api/health` com `ok=true` e bundle correto.
- Busca estatica confirmou que todas as etapas usam `MAX_PHOTOS_PER_SECTION = 30` e nao restou limite de 10 em `Trocas/Avarias`.

### Pendencias
- Validar em celular real a restauracao apos capturar varias fotos, bloquear a tela e encerrar completamente a PWA.
- O armazenamento remoto dedicado das fotos continua como evolucao futura; o ajuste atual protege o rascunho e a fila no aparelho.

## [2026-07-02] - Ajuste: compressao fina das fotos

### Alterado
- Qualidade JPEG das fotos reduzida de `0.68` para `0.62`, mantendo resolucao maxima em `1280px`.

### Adicionado
- Nada.

### Corrigido
- Reduzido levemente o peso das fotos sem alterar carimbo, formato ou fluxo de envio.

### Seguranca
- Nenhuma credencial, webhook ou chave foi alterada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify producao `6a46d0e3b3ae3e2613078aeb` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Validar manualmente uma foto nova no aparelho para confirmar peso e legibilidade.

## [2026-07-02] - Ajuste: padrao de fotos e carimbo visual

### Alterado
- As fotos capturadas pelo app passam por processamento unico antes de serem salvas/enviadas.
- Resolucao padrao definida para lado maior de `1280px`, mantendo proporcao original.
- Qualidade JPEG padronizada em `0.68`, equilibrando relatorio visual e reducao de consumo de dados.
- Todas as fotos processadas passam a receber carimbo visual com data/hora de Brasilia e nome da loja atual.
- O carimbo usa texto branco com sombra, inspirado na referencia enviada, sem bloquear a area central da imagem.

### Adicionado
- Funcoes internas para processar foto, aplicar carimbo e quebrar texto longo da loja em ate 3 linhas.
- Tratamento de erro caso o navegador nao consiga ler ou processar a foto.

### Corrigido
- Removida duplicacao de processamento especifica de `Estoque`, que agora usa o mesmo padrao das demais etapas.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O processamento acontece no navegador antes do envio ao backend/Make.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Link Drive informado foi testado: a URL de download direto responde `Content-Type: image/jpeg`, mas a visualizacao `/view` pode exigir login/permissao no Drive.
- Deploy Netlify producao `6a46b7f8913e078c11f755bc` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Confirmar no Make/Google Drive se os links gravados na planilha devem usar formato direto de download/visualizacao publica para evitar tela de login.
- Validar manualmente foto nova no aparelho, conferindo carimbo, peso e legibilidade para relatorio.

## [2026-07-02] - Correcao: estoque independente e popup de reenvio

### Alterado
- A etapa `Estoque` deixou de alterar a empresa ativa do fluxo principal (`Antes`, `Depois`, `Trocas`).
- Registros de estoque passam a usar uma selecao propria de empresa, independente da industria em execucao no fluxo principal.
- Estoque deixou de criar/travar fluxo obrigatorio de industria quando a empresa ainda nao foi aberta em `Antes`.
- O popup de envios pendentes agora exibe o botao `Depois` somente depois de uma tentativa de sincronizacao falhar.

### Adicionado
- Estado local separado para a empresa selecionada em `Estoque`.
- Conclusao visual de `Estoque` baseada em qualquer quantidade/foto de estoque salva, sem depender da empresa ativa em `Antes`.

### Corrigido
- Corrigido caso em que preencher `Estoque` de outra industria fazia o app aparentar perder a validacao de `Antes`.
- Corrigido comportamento do popup que permitia adiar antes de tentar sincronizar.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- A sincronizacao continua usando os endpoints autenticados existentes.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify producao `6a46ad3d6425aca6a79992e5` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Validar manualmente: salvar `Antes`, registrar `Estoque` de outra industria e confirmar que `Antes` permanece concluido sem exigir fluxo da industria de estoque.

## [2026-07-02] - Ajuste: fila pendente e reset da sincronizacao

### Alterado
- A tela final de sincronizacao agora reseta estado visual sempre que for acessada, evitando manter `Sucesso` de uma operacao anterior.
- Ao abrir o app com envios pendentes na fila local, o sistema exibe um popup perguntando se deseja sincronizar agora ou deixar para depois.
- O popup de fila pendente mostra uma barra de carregamento durante o envio.
- O botao `Depois` fica disponivel desde o inicio do popup para permitir continuar sem internet.
- Se o reenvio falhar, o popup mostra a mensagem de erro e deixa apenas a opcao `Depois`.

### Adicionado
- Sincronizacao da fila local diretamente pelo popup de abertura do app.
- Evento local para atualizar o contador da fila quando a sincronizacao for feita fora da tela final.

### Corrigido
- Corrigido estado visual antigo de sucesso aparecendo ao entrar novamente na tela de sincronizacao.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O popup reutiliza os endpoints autenticados existentes.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify producao `6a46a37b081dcb790a972f53` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Validar manualmente em aparelho com uma visita pendente na fila local.

## [2026-07-02] - Correcao: persistencia da validacao entre etapas

### Alterado
- Os cards de `Antes`, `Estoque` e `Depois` passaram a considerar evidencia real da etapa, como foto salva, alem da flag interna de tarefa.
- Ao capturar foto de uma etapa de industria, o app agora marca a tarefa correspondente junto com a foto e recalcula o status da industria.
- O salvamento de `Antes` e `Depois` passou a usar atualizacao funcional para nao sobrescrever flags recentes.

### Adicionado
- Flags derivadas de conclusao para a industria selecionada, reduzindo dependencia de estado intermediario defasado.

### Corrigido
- Corrigido caso em que finalizar `Depois` podia remover a marcacao verde de `Antes`, mesmo com `Antes` ja completo.
- Reduzida a chance de perda visual de validacao ao alternar entre etapas ou receber atualizacoes assincronas de foto/IA.

### Seguranca
- Nenhuma credencial, webhook ou regra sensivel foi alterada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify producao `6a46a1e3c3dd653bc4289541` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Validar manualmente no aparelho: salvar `Antes`, salvar `Depois` e confirmar que a marcacao verde de `Antes` permanece.

## [2026-07-02] - Ajuste: cabecalho responsivo

### Alterado
- O cabecalho do app passou a limitar e truncar o nome do promotor/supervisor para evitar vazamento fora do layout.
- Os botoes de atualizar e sair ficaram mais compactos em telas pequenas, mantendo os icones visiveis.

### Adicionado
- Classes responsivas de largura minima, truncamento e reducao de texto no cabecalho.

### Corrigido
- Corrigido overflow visual do nome do promotor no topo do app.

### Seguranca
- Nenhuma credencial, webhook ou regra sensivel foi alterada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify producao `6a46a108514d8e1dc0b6749f` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Validar visualmente em aparelho com nome longo de promotor/supervisor.

## [2026-07-02] - Ajustes: Trocas, checkout e sincronizacao

### Alterado
- O card de `Trocas` no progresso da visita passou a usar a regra real de conclusao das empresas abertas, evitando perder a marcacao verde quando o fluxo ja esta completo.
- A tela de `Finalizar Visita` deixou de exibir o horario de check-in para o promotor.
- O indicador do painel principal passou a mostrar apenas `Check-in realizado`, sem horario.
- A tela de `Sincronizar Agora` deixou de exibir o log de auditoria tecnico e passou a mostrar apenas uma barra simples de progresso.
- A mensagem de erro da Make para o promotor ficou operacional, informando que a visita foi salva para reenvio.

### Adicionado
- Tratamento de mensagem para falha `Make retornou HTTP 500: Scenario failed to initialize`, orientando verificacao do cenario ativo/conexoes da Make.

### Corrigido
- Corrigida divergencia visual em que `Trocas` podia aparecer pendente mesmo com o fluxo completo.
- Removida exposicao de horario de check-in no fluxo visivel ao promotor.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O erro da Make continua sendo tratado sem expor URL sensivel no frontend.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy Netlify producao `6a4692ba67c58fbd1bfe4983` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`.

### Pendencias
- Corrigir no Make.com o erro externo `Scenario failed to initialize`, verificando se o webhook esta associado a cenario ativo e se as conexoes/modulos inicializam corretamente.

## [2026-07-02] - Correcao: sincronizacao multiindustria com Make

### Alterado
- A sincronizacao com a Make passou a enviar uma chamada por industria quando a visita tem multiplos fluxos.
- O payload enviado em cada chamada voltou a ser simples, sem array `RELATORIO_VISITAS_LINHAS`.
- As rotas de sincronizacao deixaram de retornar `HTTP 502` para falhas controladas da Make; agora retornam o status da visita com `syncStatus=erro` para o app exibir a causa real e manter reenvio.

### Adicionado
- Transformador `buildTransformedPayloads` para separar a visita em payloads compativeis por industria.
- Metadados `LINHA_INDUSTRIA_INDICE` e `LINHA_INDUSTRIA_TOTAL` no payload enviado.
- Mensagem de erro com o HTTP real retornado pela Make, por exemplo `Make retornou HTTP 500`.

### Corrigido
- Corrigida a exibicao generica de `HTTP 502` no app quando a Make recusa a execucao.
- Reduzido o tamanho e a complexidade de cada chamada enviada ao webhook.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O webhook continua sendo chamado apenas pelo backend.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Retry em producao da visita `VISIT-C9EF2B7B` executado apos o deploy inicial: a Make ainda retornou `Scenario failed to initialize`.
- Deploy Netlify producao `6a466555d65e444d655d6206` concluido com sucesso.
- `/api/health` em producao retornou `ok=true`, com Google Sheets, Make e segredo de sessao configurados.
- Retry em producao da visita `VISIT-C9EF2B7B` retornou HTTP `200` controlado com `syncStatus=erro` e `syncError=Make retornou HTTP 500: Scenario failed to initialize.`.

### Pendencias
- Verificar no Make.com se o webhook esta associado a um cenario ativo e se alguma conexao/modulo do cenario precisa ser reautenticado.
- Reenviar a visita `VISIT-C9EF2B7B` depois da correcao do cenario Make para confirmar aceite final.

## [2026-07-02] - Correcao: conclusao real de multiplas industrias

### Alterado
- A regra de conclusao do fluxo por industria passou a considerar evidencias reais: foto de `Antes`, foto de `Depois` e resposta/foto de `Trocas`.
- O salvamento final de `Trocas` passou a recalcular o status completo de todas as industrias abertas.

### Adicionado
- Validacao de foto obrigatoria quando `Trocas` for respondido como `Sim`.

### Corrigido
- Corrigido caso em que a visita com duas industrias podia aparentar finalizar apenas uma industria no final do fluxo.
- Reduzida dependencia de flags intermediarias que podiam ficar inconsistentes durante troca rapida entre empresas.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- A sincronizacao continua bloqueada ate todos os fluxos ativos estarem completos.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar em celular real o fluxo com duas industrias completas na mesma visita.

## [2026-07-02] - Ajuste: retomada de fluxo e sessao unica

### Alterado
- O dashboard passou a listar as empresas iniciadas na visita em vez de exibir apenas `Empresa atual`.
- O app passou a restaurar o usuario salvo da sessao local quando reaberto.
- O login passou a manter o ultimo usuario preenchido sem armazenar senha.
- A autenticacao do backend passou a validar uma sessao ativa unica por usuario.

### Adicionado
- `sessionId` no token de sessao do backend.
- Registro de sessao ativa por usuario no armazenamento seguro do backend.

### Corrigido
- As etapas `Antes` e `Depois` passaram a marcar a empresa como concluida na primeira confirmacao de salvar.
- Se o app fechar durante a visita, o estado local continua sendo retomado ao abrir novamente enquanto a sessao for valida.
- Um novo login com o mesmo usuario invalida o token anterior.

### Seguranca
- Nenhuma senha e salva no navegador.
- Apenas o ultimo nome de usuario fica preservado para facilitar novo acesso.
- O backend bloqueia tokens antigos quando a mesma conta faz novo login.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Usuarios que estavam com sessao antiga antes deste deploy podem precisar entrar novamente.

## [2026-07-02] - Ajuste: Trocas exige resposta de todas as empresas

### Alterado
- A tela `Trocas` agora so permite salvar e continuar quando todas as empresas abertas em `Antes` tiverem resposta registrada.

### Adicionado
- Aviso visual com a lista das empresas que ainda nao responderam `Sim` ou `Nao`.

### Corrigido
- Evitado o salvamento parcial de `Trocas` com apenas uma empresa respondida.
- Ao concluir, o sistema marca `Trocas` em todas as empresas abertas e segue para o dashboard.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O backend continua recebendo o fechamento apenas quando a visita esta de fato completa.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar no celular se a mensagem de pendentes fica clara quando houver muitas empresas abertas.

## [2026-07-02] - Ajuste: Trocas lista empresas abertas em Antes

### Alterado
- A tela `Trocas` passou a exibir as empresas que abriram fluxo em `Antes`.
- A resposta `sim/não` agora e aplicada a empresa escolhida na lista da propria tela.

### Adicionado
- Lista visual de empresas abertas em `Antes` dentro da tela `Trocas`.

### Corrigido
- `Trocas` nao depende mais da ultima empresa global selecionada.
- O usuario consegue registrar trocas por empresa, seguindo o mesmo padrao de `Depois`.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O backend continua recebendo apenas dados de empresas realmente abertas.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar no celular se a leitura da lista de empresas em `Trocas` fica clara com muitas empresas abertas.

## [2026-07-02] - Ajuste: Depois lista empresas abertas em Antes

### Alterado
- A tela `Depois` passou a exibir apenas as empresas que abriram fluxo em `Antes`.
- O anexo de fotos em `Depois` agora depende da empresa escolhida nessa lista.

### Adicionado
- Lista visual de empresas abertas em `Antes` dentro da tela `Depois`.

### Corrigido
- `Depois` nao depende mais apenas do ultimo valor global de industria selecionada.
- O usuario agora escolhe explicitamente qual empresa deseja finalizar em `Depois`.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O backend continua recebendo apenas execucoes vinculadas a empresas realmente abertas.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar em aparelho real se a lista de empresas em `Depois` fica suficientemente clara quando houver muitas empresas abertas.

## [2026-07-02] - Ajuste: botao de voltar nas telas do fluxo

### Alterado
- As telas internas do fluxo passaram a exibir um botao de voltar no estilo do app.
- O botao foi inserido nas etapas de `Check-in`, `Fachada`, `Antes`, `Estoque`, `Depois`, `Trocas`, `Check-out` e `Sincronizacao`.

### Adicionado
- Componente de retorno visual padronizado com seta e estilo discreto do cliente.

### Corrigido
- O usuario agora consegue retornar com mais facilidade entre as telas do fluxo sem depender apenas do menu lateral.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- A navegacao de retorno respeita os destinos internos do fluxo, sem criar atalhos novos de permissao.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar no celular se a posicao do botao ficou ergonomica em telas menores.

## [2026-07-02] - Ajuste: estoque com selecao autonoma de empresa

### Alterado
- A etapa `Estoque` passou a permitir selecao de empresa dentro da propria tela, no mesmo padrao das demais etapas.
- O anexo de foto do estoque foi movido para um bloco inferior, igual ao comportamento de `Antes` e `Depois`.

### Adicionado
- Selecionador de empresa dentro de `Estoque`.
- Bloco de anexo de foto abaixo do registro de quantidade.

### Corrigido
- O estoque nao fica mais preso a uma unica empresa vinda do `Antes`.
- O usuario consegue alternar a empresa diretamente no estoque sem depender do fluxo anterior.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O backend continua aceitando apenas dados persistidos por execucao real.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar no celular se o bloco de foto do estoque ficou no ponto esperado pelo time de campo.

## [2026-07-02] - Ajuste: trava somente para empresas com fotos

### Alterado
- A trava de check-out passou a considerar apenas empresas que realmente possuem fotos em alguma etapa da execução.
- A simples seleção de uma empresa nao cria mais um fluxo pendente.

### Adicionado
- Remocao automatica de execucoes vazias, sem fotos, ao desfazer a captura.
- Filtro no backend para gerar linhas de relatorio somente para empresas com fotos registradas.

### Corrigido
- Escolher uma empresa por engano, sem tirar foto, nao bloqueia mais o fechamento da visita.
- Apagar todas as fotos de uma empresa remove essa execucao do bloqueio.

### Seguranca
- Nenhuma credencial, webhook ou chave foi exposta.
- O backend continua filtrando o que vai para o relatorio, sem confiar em selecao vazia do frontend.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.

### Pendencias
- Validar no celular se o fluxo apagado desaparece imediatamente da trava do check-out.
- Confirmar no relatorio da Make que execucoes sem fotos deixam de gerar linha.

## [2026-07-02] - Correcao: sessao expirada exibida como sem conexao

### Alterado
- O carregamento inicial passou a diferenciar erro de sessao expirada de erro real de conexao.

### Adicionado
- Nenhum arquivo novo nesta etapa.

### Corrigido
- Quando havia usuario salvo no navegador/PWA, mas o token local estava expirado, o app mostrava mensagem generica de conexao.
- Agora, nesses casos, a sessao local e limpa e o usuario volta para a tela de login.

### Seguranca
- Nenhuma credencial, token ou webhook foi exposto.
- A correcao remove sessoes expiradas do navegador em vez de tentar reutiliza-las.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- URL de producao respondeu `200`.
- `/api/health` retornou `ok=true`.
- `/api/config` retornou industrias e timestamp corretamente.

### Pendencias
- Se o celular ainda mostrar tela antiga, limpar cache/fechar e abrir novamente a PWA para receber o novo bundle.

## [2026-07-01] - Ajuste: multiplas industrias por visita

### Alterado
- A visita de campo passou a aceitar varios fluxos de industria/empresa dentro do mesmo check-in.
- As etapas `Antes`, `Estoque`, `Depois` e `Trocas` passaram a salvar fotos, tarefas, estoque, IA e resposta de trocas por industria selecionada.
- O check-out passou a ser liberado somente quando todas as industrias abertas tiverem `Antes`, `Depois` e `Trocas` concluidos.
- O dashboard passou a exibir resumo de industrias abertas, concluidas e pendentes sem alterar a estrutura visual principal.
- O payload enviado ao backend/Make passou a incluir `RELATORIO_VISITAS_LINHAS`, com uma linha por industria, mantendo campos antigos no topo por compatibilidade.

### Adicionado
- Modelo `IndustryExecution` no estado da visita.
- Campo `industryExecutions` para armazenar os fluxos por industria dentro da mesma visita.
- Trava de seguranca na tela de check-out e na sincronizacao para impedir envio com fluxo de industria pendente.

### Corrigido
- Evitada mistura de fotos, quantidades de estoque, resposta de trocas e resultado de IA entre industrias diferentes.
- Preservada compatibilidade com visitas antigas em andamento que ainda nao possuem `industryExecutions`.

### Seguranca
- Nenhuma credencial, webhook, chave ou regra sensivel foi exposta no frontend.
- A sincronizacao continua passando pelo backend seguro antes de acionar integrações externas.
- A regra de fechamento impede registro parcial de visita com empresas abertas.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande do Vite.
- Deploy de producao `6a459a8c0ab5e9665cbbca2d` concluido com sucesso.
- Producao respondeu `200` na URL principal.
- `/api/health` retornou `ok=true`, com Google Sheets, Make e segredo de sessao configurados.

### Pendencias
- Validar em aparelho real o fluxo com duas industrias na mesma loja.
- Ajustar o cenario Make/planilha para consumir `RELATORIO_VISITAS_LINHAS` e inserir uma linha por industria na aba `RELATORIO_VISITAS`.

## [2026-06-28] - Ajuste: payload para RELATORIO_VISITAS

### Alterado
- O payload enviado para a Make passou a incluir aliases com os nomes exatos das colunas da aba `RELATORIO_VISITAS`.
- A resposta da Make passou a armazenar um trecho do corpo retornado para melhorar auditoria de sincronizacao.

### Adicionado
- Objeto `RELATORIO_VISITAS` no payload transformado, com os campos na ordem/nomenclatura esperada pela planilha.
- Campos `LINK_FOTO_*` como aliases dos campos de foto enviados para a Make.

### Corrigido
- Reduzida a chance de a Make ignorar campos por divergencia de nomes como `HORA_ENTRADA_CHECK_IN` versus `HORA_ENTRADA_CHECK-IN`.

### Seguranca
- Nenhuma chave, webhook ou credencial foi exposta.
- As fotos continuam trafegando pelo backend e pela Make, sem chamada direta do frontend para a planilha.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande.
- Deploy de producao `6a41d6c8cf65a0c6278714d4` concluido com sucesso.
- `/api/health` retornou `ok=true` em producao.
- A aba `RELATORIO_VISITAS` segue com 11 linhas e sem os IDs antigos, pois visitas antigas nao foram reprocessadas.

### Pendencias
- Confirmar se o cenario da Make esta configurado para inserir linha na aba `RELATORIO_VISITAS`.
- Reprocessar visitas antigas somente com decisao explicita, para evitar duplicidade em destinos da Make.

## [2026-06-28] - Operacional: validade dos acessos provisorios

### Alterado
- A validade dos acessos provisorios de `luana.coelho` e `leandro.pinheiro` foi ajustada para 1 semana a partir da data local.

### Adicionado
- Nenhum arquivo novo nesta etapa.

### Corrigido
- Nenhuma correcao funcional nesta etapa.

### Seguranca
- As senhas nao foram alteradas nem gravadas no codigo.
- As variaveis continuam configuradas como secret no Netlify.
- A nova expiracao ficou definida para `2026-07-05T23:59:59-03:00`.

### Validacao
- Deploy de producao `6a41c5e2e986205a51aa573d` concluido com sucesso.
- `/api/health` retornou 1 supervisor provisorio valido e 1 usuario provisorio valido.
- Login de `luana.coelho` retornou `SUPERVISOR` e painel com 25 promotores.
- Login de `leandro.pinheiro` retornou `FIELD_OPS`, 6 lojas e `403` no painel supervisor.

### Pendencias
- Remover os acessos provisorios quando os testes terminarem.

## [2026-06-28] - Ajuste: anexos por industria no fluxo principal

### Alterado
- Na etapa `Antes`, a acao de adicionar fotos agora aparece somente depois da selecao da industria e abaixo do bloco de industria.
- Na etapa `Depois`, a industria vinculada ao `Antes` passou a ser exibida explicitamente antes do anexo de fotos.
- O campo de anexar foto de `Antes` e `Depois` foi padronizado como bloco abaixo do contexto da industria.
- A navegacao para `Depois` passou a validar a industria selecionada no `Antes`.

### Adicionado
- Nenhum arquivo novo nesta etapa.

### Corrigido
- A validacao de salvar `Antes`/`Depois` agora prioriza a ausencia de industria antes da ausencia de foto.

### Seguranca
- Nenhuma credencial, webhook ou chave foi alterada.
- Nenhuma regra de autenticacao ou permissao foi relaxada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande.
- Deploy de producao `6a41c4ffd1fce09a6fbaa9c0` concluido com sucesso.
- `/api/health` retornou `ok=true` em producao.
- Consulta autenticada em `/api/visits` encontrou a visita `VISIT-09A9FA2E` com `syncStatus=enviado` e `makeResponse.ok=true`.

### Pendencias
- Validar visualmente em celular real apos deploy.

## [2026-06-28] - Operacional: promotor provisorio de teste

### Alterado
- O login passou a aceitar usuarios provisorios com papel controlado em `BACKEND_PROVISIONAL_USERS`.
- O diagnostico seguro em `/api/health` passou a indicar tambem se ha usuarios provisorios configurados.
- A rota de lojas passou a aceitar `storeResponsible` vindo da sessao para usuarios provisorios de teste.

### Adicionado
- Suporte a promotor provisorio `FIELD_OPS` sem alterar a planilha operacional.
- Documentacao de `BACKEND_PROVISIONAL_USERS` no `.env.example`, README e manual tecnico.
- Suporte a `storeResponsible` para vincular usuario provisorio a uma rota real sem usar ID de promotor existente.

### Corrigido
- Nenhuma correcao funcional nesta etapa.

### Seguranca
- A senha provisoria continua armazenada apenas como hash SHA-256 no ambiente do backend.
- O papel do usuario provisorio e definido no backend e validado como `FIELD_OPS` ou `SUPERVISOR`.
- O acesso provisorio pode expirar por `expiresAt`.
- O promotor provisorio fica limitado a rota do `storeResponsible` configurado.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande.
- Deploy de producao `6a41c0dc0c3f5951f901f6a3` concluido com sucesso.
- `/api/health` retornou 1 supervisor provisorio valido e 1 usuario provisorio valido.
- Login de `leandro.pinheiro` retornou `FIELD_OPS`, regiao `Vila Velha` e 6 lojas.
- Acesso de `leandro.pinheiro` ao painel supervisor retornou `403`.
- Login de `luana.coelho` continuou retornando `SUPERVISOR` e painel com 25 promotores.

### Pendencias
- Remover o acesso provisorio apos os testes do Leandro Pinheiro.

## [2026-06-28] - Evolucao: PWA instalavel para promotores

### Alterado
- O HTML base recebeu metadados de PWA, idioma `pt-BR`, tema e links para manifest/icones.
- A inicializacao do frontend passou a registrar service worker apenas em build de producao.
- A documentacao passou a explicar instalacao no celular e limites do cache offline.

### Adicionado
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons/icon.svg`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `src/services/registerServiceWorker.ts`

### Corrigido
- Nenhuma correcao funcional nesta etapa.

### Seguranca
- O service worker nao intercepta nem cacheia chamadas `/api/*`.
- O cache da PWA foi limitado a shell e assets estaticos.
- Nenhum segredo ou endpoint sensivel foi adicionado ao frontend.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande.
- Manifest validado como JSON e com `display=standalone`.
- Preview local respondeu `200` para `/`, `/manifest.webmanifest` e `/sw.js`.
- Deploy de producao `6a41bce248c4638d7f4de46b` concluido com sucesso.
- Producao respondeu `200` para `/`, `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png` e `/icons/icon-512.png`.
- `/api/health` continuou retornando `ok=true`.
- Login supervisor `luana.coelho` retornou `SUPERVISOR` e painel com 25 promotores.
- Login promotor real retornou `FIELD_OPS`, 6 lojas e `403` no painel supervisor.

### Pendencias
- Validar instalacao em celular real Android e iOS.

## [2026-06-28] - Planejamento: arquitetura alvo segura

### Alterado
- O README passou a referenciar o documento de arquitetura alvo.
- O checklist e o backlog tecnico passaram a registrar a evolucao pos-entrega de forma controlada.

### Adicionado
- `ARQUITETURA_ALVO.md` com a recomendacao de app PWA para promotores, acesso web para supervisor e backend centralizado.
- Ordem segura para proximas implementacoes: PWA, validacao em celular real, fortalecimento de sessao, storage de fotos, banco operacional e relatorios.

### Corrigido
- Nenhuma correcao funcional nesta etapa.

### Seguranca
- A arquitetura alvo reforca backend como camada obrigatoria para autenticacao, permissoes, segredos, sync e auditoria.
- Nenhum segredo, webhook ou chave foi alterado.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande.
- Nenhum arquivo funcional do frontend ou backend foi alterado nesta etapa.

### Pendencias
- Implementar PWA instalavel em uma etapa separada, com validacao em celular real.

## [2026-06-28] - Operacional: supervisor provisorio seguro

### Alterado
- O login passou a consultar supervisores provisorios configurados no backend quando o usuario nao existe no Google Sheets.

### Adicionado
- Suporte a `BACKEND_PROVISIONAL_SUPERVISORS` com lista JSON de supervisores temporarios.
- Documentacao da nova variavel no `.env.example`, README e manual tecnico.
- Diagnostico seguro em `/api/health` indicando apenas se ha supervisor provisorio configurado e quantos registros validos foram carregados.

### Corrigido
- Permitido criar acesso temporario de supervisor sem cadastrar senha fixa no frontend e sem alterar a planilha operacional.
- A leitura de supervisores provisorios passou a aceitar JSON e formato compacto com `|`, evitando falhas de escape ao configurar variaveis pelo CLI no Windows.

### Seguranca
- A senha provisoria fica armazenada apenas como hash SHA-256 no ambiente do backend.
- O acesso provisorio aceita expiracao por `expiresAt` e continua limitado ao papel `SUPERVISOR`.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso, mantendo apenas o warning conhecido de chunk grande.
- Deploy de producao `6a41747a9bc81887d7b6f75d` concluido com sucesso.
- `/api/health` retornou `configured=true` e `validCount=1` para supervisores provisorios.
- Login de `luana.coelho` retornou `SUPERVISOR`.
- Painel supervisor carregou com 25 promotores.
- Login de promotor real retornou `FIELD_OPS`, 6 lojas e `403` no painel supervisor.

### Pendencias
- Remover ou substituir o acesso provisorio quando a Luana for cadastrada oficialmente na planilha.

## [2026-06-28] - Correcao: acesso supervisor configuravel

### Alterado
- A regra de papel do usuario passou a aceitar supervisor por coluna `ROLE`, compatibilidade antiga por regiao `SUPERVISOR` ou variavel `BACKEND_SUPERVISOR_USERS`.
- O cache de cadastro passou a exigir industrias, promotores e lojas antes de ser considerado valido.

### Adicionado
- Variavel `BACKEND_SUPERVISOR_USERS` documentada no `.env.example`, README e manual tecnico.

### Corrigido
- Corrigido o risco de nenhum usuario conseguir acessar o painel supervisor quando a planilha nao possui linha/regiao `SUPERVISOR`.
- Corrigido o risco de cache incompleto de cadastro causar falha de login em producao.

### Seguranca
- Nenhum usuario foi promovido a supervisor em producao sem definicao explicita.
- O painel supervisor continua exigindo sessao autenticada com papel `SUPERVISOR`.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- Deploy de producao `6a4166b10c3f59668101f69c` concluido com sucesso.
- Login de promotor em producao retornou `FIELD_OPS`, 6 lojas e `403` no dashboard supervisor.
- Preview com `BACKEND_SUPERVISOR_USERS=22` retornou `SUPERVISOR` e carregou dashboard com 25 promotores.
- Variaveis temporarias de deploy-preview foram removidas apos o teste.

### Pendencias
- Definir qual usuario real deve ser supervisor em producao e configurar `BACKEND_SUPERVISOR_USERS` ou coluna `ROLE` na planilha.

## [2026-06-28] - Fase 8: entrega final e documentacao

### Alterado
- O README foi atualizado para apontar para a documentacao final.
- O backlog tecnico e o checklist do projeto foram fechados com o status final.
- A entrega ganhou manuais separados para uso operacional e referencia tecnica.

### Adicionado
- `MANUAL_DE_USO.md`
- `MANUAL_TECNICO.md`

### Corrigido
- A explicacao do fluxo deixou de depender apenas de anotacoes internas e passou a existir em documentação final.
- O caminho para localizar dados, filas e fotos ficou documentado de forma explicita.

### Seguranca
- A documentacao passou a reforcar que as chaves continuam fora do frontend.
- O manual tecnico explica o acesso aos registros sem expor segredos.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- Revisao dos fluxos de login, check-in, fotos, sincronizacao, fila local e painel supervisor concluida a partir do codigo.

### Pendencias
- Nenhuma pendencia critica para entrega documental.
- Melhorias futuras podem incluir reducao do bundle e configuracao da chave do Gemini, se o cliente desejar usar IA em producao.

## [2026-06-27] - Fase 7: publicacao e implantacao no Netlify

### Alterado
- O projeto foi publicado em producao no Netlify.
- O frontend continua preservado como Vite + React + TypeScript.
- A documentacao foi ajustada para refletir o host final em producao.

### Adicionado
- `vercel.json` e gateway de compatibilidade para migracao futura, sem impacto visual no app atual.
- Adaptador de storage com suporte a runtime Netlify e fallback alternativo preparado.

### Corrigido
- Resolvido o bloqueio de deploy que existia quando o Netlify estava sem credito.
- Removido o ruido de variavel de teste no contexto de desenvolvimento do Netlify.

### Seguranca
- Segredos permanecem fora do frontend.
- `APP_SESSION_SECRET`, Google Sheets e Make seguem configurados no backend do host.
- A chave de Gemini continua opcional e, sem ela, a IA falha de forma controlada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- `npx.cmd netlify deploy --prod --message "Fase 7 - Criativa Field Ops"` concluido com sucesso.
- Smoke check em `https://criativa-field-ops-574.netlify.app/` retornou `200`.
- Smoke check em `https://criativa-field-ops-574.netlify.app/api/health` retornou `200` com `googleSheets=true`, `make=true`, `sessionSecret=true` e `gemini=false`.
- Smoke check em `https://criativa-field-ops-574.netlify.app/api/config` retornou `200`.

### Pendencias
- `BACKEND_GEMINI_API_KEY` ainda nao esta configurada em producao.
- Fase 8: documentação final, guia de suporte e entrega conclusiva.

## [2026-06-27] - Fase 6: IA e analise de imagem segura

### Alterado
- A analise de imagem passou a receber `visitId` estavel do fluxo do promotor.
- A rota de IA agora persiste o resultado no backend quando a visita existe ou cria um rascunho best-effort quando necessario.
- O frontend continua nao bloqueando o fluxo se a IA falhar.
- O resultado da IA continua sendo refletido no estado local e agora tambem pode ficar salvo na visita do backend.

### Adicionado
- `src/services/visitId.ts`
- Persistencia best-effort de analise em `netlify/functions/ai-analyze.ts`

### Corrigido
- Eliminado o risco de analise depender apenas de estado local sem identidade estável da visita.
- A falha da IA continua sem bloquear o fluxo operacional.
- O backend passou a manter o resultado da analise junto da visita quando possivel.

### Seguranca
- A chave do Gemini permanece apenas no backend.
- O frontend continua sem acesso direto ao modelo ou segredo.
- A rota de IA exige autenticacao e falha de forma controlada se a chave nao estiver configurada.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- Smoke check em `http://127.0.0.1:8890/api/visits` confirmou persistencia de `aiResults` com `AI_SAVED=Bom`.
- Smoke check em `http://127.0.0.1:8890/api/ai/analyze` com chave ausente retornou `AI_ROUTE=503`.

### Pendencias
- Fase 7: preparar implantacao com variaveis e ambiente de hospedagem.
- Validacao manual da IA com chave real do cliente em ambiente autorizado.

## [2026-06-27] - Fase 5: Painel supervisor com dados reais

### Alterado
- O painel supervisor passou a consumir um resumo estruturado real do backend.
- O gráfico do supervisor deixou de usar numeros fixos e agora renderiza series derivadas de visitas reais.
- Os cards do supervisor passaram a usar contagens operacionais vindas das visitas e promotores cadastrados.
- O detalhe do promotor passou a usar métricas reais de execucao, sem texto sintetico.

### Adicionado
- Agregador compartilhado de supervisor em `netlify/functions/_shared/supervisor.ts`.
- Tipos tipados para resumo, timeline e detalhe do supervisor no frontend.

### Corrigido
- Removido o `chartData` fixo do painel.
- Removidas contagens sinteticas de status no componente do supervisor.
- Eliminado o risco de o painel mostrar valores inventados quando o backend nao tinha dados suficientes.

### Seguranca
- Sem novas credenciais ou segredos nesta fase.
- O painel continua protegido por autenticacao de supervisor no backend.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- Smoke check autenticado em `http://127.0.0.1:8889/api/supervisor/dashboard` retornou `PROMOTERS=25`, `TOTAL_VISITS=0`, `PENDING_SYNC=0`, `TIMELINE_POINTS=6`.
- Smoke check autenticado em `http://127.0.0.1:8889/api/supervisor/promoters/:id` retornou `DETAIL_ROUTE=0` e `DETAIL_EFF=0%`.

### Pendencias
- Fase 6: mover e consolidar a analise de imagem para uma camada segura, se ela permanecer no produto.
- Validacao manual do dashboard em ambiente com visitas reais registradas.

## [2026-06-27] - Fase 4: Fluxo de campo completo

### Alterado
- A etapa Antes passou a registrar analise de imagem com resultado persistido no estado local.
- A etapa Antes/Depois passou a bloquear conclusao sem industria selecionada.
- A etapa Estoque passou a exigir industria selecionada e quantidade valida antes de concluir.
- A analise de imagem passou a atualizar estado de carregamento de forma real.

### Adicionado
- Validacao operacional de estoque por industria selecionada.
- Persistencia do resultado de IA no estado da visita.

### Corrigido
- O fluxo de Depois nao permite mais salvar registro sem industria associada.
- O estoque nao pode mais ser concluido com quantidade vazia, negativa ou nao numerica.
- O indicador de analise por imagem agora reflete processamento real.

### Seguranca
- Sem alteracoes novas de credenciais nesta fase.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- `npm.cmd run dev` validado com smoke check local em `200`.

### Pendencias
- Fase 4 ainda pode receber validacao manual em navegador do fluxo completo do promotor.
- Fase 5: painel supervisor com dados reais e sem sinteticos.

## [2026-06-27] - Fase 3: Persistencia e fila de sincronizacao

### Alterado
- O frontend passou a manter uma fila local persistida para visitas nao sincronizadas.
- A tela de sincronizacao ganhou acao de reenviar a fila local pendente.
- O fluxo de sync passou a registrar estados intermediarios da fila local.
- O backend recebeu endpoint dedicado para retry de sincronizacao.
- O backend recebeu endpoint para consulta da fila operacional de sync.

### Adicionado
- `src/services/syncQueue.ts`
- `netlify/functions/_shared/sync.ts`
- `netlify/functions/retry-sync.ts`
- `netlify/functions/sync-queue.ts`

### Corrigido
- A visita nao fica mais dependente apenas do envio imediato para considerar o registro salvo localmente.
- O reenvio manual deixou de reutilizar o caminho de sync normal sem diferenciar retry.
- O estado da fila local agora e atualizado de forma coerente em sucesso e erro.

### Seguranca
- O reenvio passou a acontecer no backend, sem expor webhook ou credencial no navegador.
- A fila local evita perda de visita em caso de falha de rede ou erro temporario.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- `npm.cmd run dev` validado com smoke check local em `200`.
- `npx.cmd --yes netlify dev --target-port 3000 --port 8889 --no-open` validado com smoke check em `200` na raiz e `/api/health`, e `401` em `/api/sync/queue` sem autenticacao.

### Pendencias
- Fase 4: endurecer validacoes do fluxo do promotor ponta a ponta.
- Fase 5: painel supervisor com dados reais e sem sinteticos.

## [2026-06-27] - Fase 2: Backend minimo seguro

### Alterado
- O frontend deixou de consumir Google Sheets, Make e Gemini diretamente.
- A configuracao sensivel passou a ser intermediada por Netlify Functions.
- O painel supervisor agora consulta dados reais do backend.
- O sync passou a registrar e persistir visitas em Netlify Blobs.

### Adicionado
- `netlify.toml`
- `netlify/functions/*`
- `src/services/httpClient.ts`
- `src/services/session.ts`
- `netlify/functions/_shared/*`

### Corrigido
- Removida a dependência de webhook e IA expostos no navegador.
- Removida a validação de login baseada apenas no cliente.
- Removido o consumo direto de Google Sheets pelo frontend.
- Corrigido o fluxo de conexão para apontar ao backend em vez de ao Make.

### Seguranca
- Segredos agora ficam no backend e não no bundle do navegador.
- Login passou a emitir sessão assinada com expiração.
- A exposição da chave da Gemini foi eliminada do frontend.
- O webhook da Make deixou de existir no código cliente.

### Validacao
- `npm.cmd install` concluído com sucesso.
- `npm.cmd run lint` concluído com sucesso.
- `npm.cmd run build` concluído com sucesso.
- `npm.cmd run dev` validado com smoke check local com resposta `200`.
- `npx netlify dev --target-port 3000 --port 8889 --no-open` validado com smoke check em `/api/health` e `/api/config`.

### Pendencias
- Fase 3: fila de reenvio confiável e estratégia de retry manual.
- Fase 3: consolidar persistência operacional completa das visitas e estados.
- Fase 4: endurecer ainda mais as validações do fluxo do promotor.

## [2026-06-27] - Fase 1: Configuracao, variaveis e limpeza de exposicao

### Alterado
- A configuracao sensivel foi centralizada em `src/config/appConfig.ts`.
- O `vite.config.ts` deixou de expor `process.env` para o bundle.
- O titulo do app foi ajustado para `Criativa Field Ops`.
- A documentacao de ambiente foi alinhada com as variaveis reais do projeto.

### Adicionado
- `src/config/appConfig.ts`
- `src/vite-env.d.ts`

### Corrigido
- Removidos valores hardcoded de Google Sheets, Make e Gemini do codigo-fonte.
- Removido o fallback inseguro `admin/admin` do login.
- Substituido o gerador de IDs com `Math.random` por um gerador mais robusto.

### Seguranca
- Segredos nao ficam mais codificados diretamente no frontend.
- A exposicao completa das integracoes ainda depende da Fase 2, quando a camada de backend assumir Google Sheets, Make e Gemini.

### Validacao
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- `npm.cmd run dev` validado com smoke check local com resposta `200`.

### Pendencias
- Fase 2: mover integracoes sensiveis para backend.
- Fase 2: implementar autenticacao e autorizacao seguras.
- Fase 3: persistencia e fila de sincronizacao.

## [2026-06-27] - Fase 0: Auditoria inicial e trava de seguranca

### Alterado
- Nenhuma funcionalidade foi alterada.
- A base foi auditada para mapear fluxo, integracoes, riscos e dependencias.

### Adicionado
- `BACKLOG_TECNICO.md`
- `CHECKLIST_PROJETO.md`
- `CHANGELOG.md`

### Corrigido
- Nenhum bug funcional foi corrigido nesta fase.

### Seguranca
- Registrado o risco de webhook da Make hardcoded no frontend.
- Registrado o risco de `GEMINI_API_KEY` consumida no cliente.
- Registrado o risco de `process.env` exposto no `vite.config.ts`.
- Registrado o risco do fallback `admin/admin`.
- Registrado o risco de dashboard supervisor com dados sinteticos.

### Validacao
- `npm.cmd install` concluido com sucesso.
- `npm.cmd run lint` concluido com sucesso.
- `npm.cmd run build` concluido com sucesso.
- `npm.cmd run dev` validado com smoke check local com resposta `200`.
- O build emitiu warning sobre exposicao de `process.env` e sobre chunk acima de 500 kB.
- O `npm.cmd install` reportou 8 vulnerabilidades no inventario de dependencias.

### Pendencias
- Fase 1: remover segredos e centralizar configuracao.
- Fase 2: criar backend minimo seguro.
- Fase 3: persistencia e fila de sincronizacao.
- Fase 5: substituir dados mockados do painel supervisor por dados reais.
