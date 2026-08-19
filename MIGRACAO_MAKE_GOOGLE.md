# Migracao Make para Google Cloud

Data de inicio: 2026-08-19

## Objetivo

Substituir gradualmente o processamento de fotos e a finalizacao de visitas do
Make por Google Cloud Run e APIs do Google, sem interromper o aplicativo e sem
duplicar fotos, pastas ou linhas da planilha.

## Estado confirmado

- Projeto Google Cloud: `make-criativa` (`1001124005835`).
- Conta administrativa validada: `philipe.almeida19@gmail.com`.
- Faturamento vinculado e sem cobranca acumulada no periodo consultado.
- Google Drive API ativa e em uso pelo fluxo atual.
- Cliente OAuth dedicado `Criativa Google Sync Homolog`, com tela de
  consentimento em producao e somente os escopos `drive.file` e `spreadsheets`.
- Nenhuma conta de servico existia no inicio da preparacao.
- APIs habilitadas em 19/08/2026:
  - Cloud Run Admin API;
  - Cloud Tasks API;
  - Secret Manager API;
  - Artifact Registry API;
  - Google Sheets API;
  - Cloud Firestore API;
  - Cloud Build API.
- Make e Netlify permaneceram sem alteracoes.
- O blueprint produtivo foi conferido em modo somente leitura. Ele usa a pasta
  raiz `FOTOS SISTEMA CRIATIVA`, a planilha `Sistema Criativa`, a aba
  `RELATORIO_VISITAS` e mantem separadas as rotas de foto, devolucao,
  finalizacao e lote de homologacao.

## Recursos criados em homologacao

- Conta de servico `criativa-sync-runtime@make-criativa.iam.gserviceaccount.com`.
- Nenhuma chave JSON gerenciada pelo usuario.
- Firestore nativo `(default)` em `southamerica-east1`.
- Bucket privado `make-criativa-sync-staging`, com acesso publico bloqueado e
  uniform bucket-level access.
- Fila `criativa-sync-homolog`, limitada a duas execucoes simultaneas, cinco
  tentativas e backoff entre 30 e 600 segundos.
- Repositorio Docker `criativa-sync` em `southamerica-east1`.
- Segredos OAuth, pasta e planilha de homologacao armazenados no Secret
  Manager, sem credencial no repositorio.
- Container local possui somente `/health`; a rota de ingestao ainda retorna
  `404` e nao pode receber visitas por acidente.
- Imagem imutavel publicada como `health:20260819-1`, digest iniciado por
  `sha256:ffd6346373df`.
- Cloud Run privado `criativa-sync-homolog`, revisao
  `criativa-sync-homolog-00001-cr6`, com `min=0` e `max=1`.
- URL privada de homologacao:
  `https://criativa-sync-homolog-1001124005835.southamerica-east1.run.app`.
- Lifecycle do bucket remove somente objetos temporarios com sete dias.
- Worker privado `criativa-sync-worker-homolog`, revisao
  `criativa-sync-worker-homolog-00001-vlg`, com `min=0`, `max=1`, concorrencia
  dois e destinos exclusivos de homologacao.
- Imagem do worker publicada com digest
  `sha256:6a35beeaae8e3af1828a1f6292a8327be1d0472f0b7ff2e2083702ddf561cccc`.

## Arquitetura de homologacao

```text
Netlify (feature flag desligada)
        |
        v
Cloud Run / ingestao
        |
        +-- Cloud Storage: payload temporario da foto
        +-- Firestore: estado idempotente do evento
        +-- Cloud Tasks: referencia pequena, sem base64
                    |
                    v
              Cloud Run / worker
                    |
                    +-- Google Drive: INDUSTRIA/DATA/PDV[/DEVOLUCOES]
                    +-- Google Sheets: upsert por ID_VISITA
```

O corpo da foto nao deve ser colocado no Cloud Tasks nem no Firestore. A
ingestao salva o binario temporariamente no Cloud Storage e enfileira apenas a
referencia do objeto, `ID_FOTO`, `ID_VISITA` e metadados necessarios.

## Regras anti-loop

1. `ID_FOTO`, `ID_VISITA`, `EVENT_ID` e `BATCH_ID` permanecem deterministas.
2. O nome da tarefa e derivado do tipo do evento e da chave de idempotencia.
3. A aquisicao do trabalho ocorre em transacao no Firestore.
4. Um job em processamento recebe lease com expiracao definida.
5. Retry durante o lease nao inicia outro processamento.
6. Job concluido devolve o recibo persistido sem repetir Google Drive ou Sheets.
7. Falhas possuem limite de tentativas e terminam em `dead_letter`.
8. Upload pesquisa nome e pasta antes de criar arquivo no Drive.
9. Finalizacao usa upsert por `ID_VISITA` e nunca adiciona linha cegamente.
10. HTTP de sucesso so e enviado depois da persistencia do recibo final.

## Autenticacao

- Cloud Run deve executar com conta de servico sem chave JSON baixada.
- Segredos devem ficar no Secret Manager.
- A pasta produtiva esta no `Meu Drive`; por isso, a primeira versao usa OAuth
  da conta proprietaria para Drive e Sheets.
- O OAuth da migracao deve ser dedicado. Nao reutilizar nem substituir o segredo
  usado pela conexao atual do Make.
- Migrar a raiz para um Shared Drive pode eliminar essa dependencia no futuro,
  mas nao faz parte do primeiro corte.

## Gates de ativacao

- [x] Projeto e conta corretos confirmados.
- [x] APIs de homologacao habilitadas.
- [x] Ausencia de conta de servico e chave de API confirmada.
- [x] Contrato local anti-loop criado e testado.
- [x] Criar conta de servico de runtime sem chave persistente.
- [x] Criar cliente OAuth dedicado depois de obter o callback do Cloud Run.
- [x] Criar bucket temporario privado.
- [x] Ativar lifecycle de sete dias depois da aprovacao explicita.
- [x] Criar Firestore e fila de homologacao.
- [x] Criar repositorio Docker e container de saude local.
- [x] Implantar o container privado no Cloud Run.
- [x] Confirmar `403` sem identidade e health autenticado com `200`.
- [x] Confirmar ingestao bloqueada com `404`.
- [x] Implementar worker do Drive para referencias ja presentes no staging.
- [x] Implementar ingestao e enfileiramento no Cloud Tasks.
- [x] Implementar upsert do Sheets.
- [x] Testar arvore nova, reenvio idempotente e devolucao em homologacao.
- [x] Testar timeout e retomada HTTP do fluxo completo depois da ingestao.
- [ ] Comparar Google e Make em modo sombra sem dupla escrita produtiva.
- [x] Adicionar feature flag no Netlify, inicialmente desligada.
- [x] Ativar o Google Sync em producao sem alterar os arquivos do frontend.
- [x] Conferir as primeiras visitas reais completas depois do corte.
- [x] Manter rollback para Make ate a reconciliacao final.

## Recursos produtivos

- Fila `criativa-sync-prod`, com duas execucoes simultaneas, cinco tentativas e
  backoff entre 30 e 600 segundos.
- Worker privado `criativa-sync-worker-prod`, revisao
  `criativa-sync-worker-prod-00001-w2d`, com maximo de duas instancias.
- Ingresso `criativa-sync-ingress-prod`, revisao
  `criativa-sync-ingress-prod-00001-6cv`, com maximo de tres instancias e token
  obrigatorio no cabecalho `X-Ingress-Token`.
- Netlify produtivo em `google-v1` desde o deploy
  `6a85cd9390a9e46dc390e106`.
- Rollback preservado no deploy `6a85cc51880b7360cf530f8e`, validado com
  `provider=make` e os mesmos arquivos estaticos da aplicacao.

## Estado apos o corte

- O frontend permaneceu byte a byte igual ao deploy anterior.
- O Make permanece ativo, mas nao recebe novas sincronizacoes enquanto a flag
  estiver em `google-v1`.
- Nenhum dado sintetico foi gravado nos destinos produtivos.
- As primeiras tres finalizacoes reais foram reconciliadas pelos recibos do
  Firestore: oito lotes, 96 fotos e 11 jobs concluidos, sem pendencia ou
  `dead_letter`.

## Resultado da homologacao do worker

- Acesso anonimo ao worker retorna `403`; health autenticado retorna `200`.
- Um lote com uma foto normal e uma devolucao criou dois arquivos unicos.
- A arvore criada foi
  `HOMOLOG INDUSTRIA/19-08-2026/PDV TESTE GOOGLE[/DEVOLUCOES]`.
- O retry do lote retornou o recibo persistido sem depender dos objetos ja
  removidos do staging e sem criar duplicidade.
- A finalizacao criou uma linha, o retry nao escreveu novamente e um novo
  evento da mesma visita atualizou a linha existente.
- O teste ficou restrito a pasta e planilha exclusivas de homologacao.

## Limitacao antes do corte

O OAuth com `drive.file` consegue listar as industrias existentes abaixo da
raiz produtiva, mas a leitura direta dos metadados da propria raiz retorna
`404`. Isso ainda precisa de um teste controlado antes de permitir criacao de
uma industria nova na pasta produtiva. O primeiro corte nao deve depender
dessa capacidade sem validacao.

## Proibicoes durante a preparacao

- Nao executar `Run once` no Make.
- Nao reenviar fila do Make.
- Nao trocar o webhook do Netlify.
- Nao desligar o Make.
- Nao gravar token, refresh token, client secret ou foto no repositorio.
- Nao promover Cloud Run antes dos testes de idempotencia e rollback.
