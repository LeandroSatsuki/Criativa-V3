# CHANGELOG

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
