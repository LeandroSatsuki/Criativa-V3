# CHANGELOG

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
