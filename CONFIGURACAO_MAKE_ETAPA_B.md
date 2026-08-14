# Configuracao do Make - Etapa B

## Estado de producao

Ativada em 03/08/2026 no cenario separado `Criativa Field Ops - Upload V2`.

- `BACKEND_MAKE_SYNC_MODE=visit-v2`
- webhook V2 armazenado somente no Netlify;
- cenario legado preservado e ativo para rollback;
- foto confirmada por `fileId` antes de avancar;
- finalizacao idempotente por `ID_VISITA`;
- uma linha por visita em `RELATORIO_VISITAS`.

O layout `INDUSTRIA/DATA/PDV/DEVOLUCOES` esta preparado no contrato do app,
mas so deve ser ativado no Make depois de zerar visitas parcialmente enviadas e
executar o teste controlado descrito ao final deste documento.

Rollback emergencial: alterar somente `BACKEND_MAKE_SYNC_MODE` para `legacy` e
fazer um novo deploy. Nao excluir nem editar os webhooks durante o rollback.

## Objetivo

Enviar cada foto separadamente ao Google Drive para evitar o limite de tamanho,
mas gravar somente uma linha por visita na aba `RELATORIO_VISITAS`.

O novo cenario deve ser criado como copia do cenario atual. Nao altere nem
desative o cenario legado antes do teste controlado do cenario v2.

## Regra de seguranca

- O webhook v2 e exclusivo e fica em `BACKEND_MAKE_WEBHOOK_V2_URL`.
- `BACKEND_MAKE_SYNC_MODE` permanece `legacy` durante a configuracao.
- A resposta do webhook deve ser o ultimo modulo de cada rota.
- HTTP 200 recebido antes do Drive ou da planilha nao e confirmacao valida.
- A rota de foto nunca adiciona linha na planilha.
- A rota de fechamento usa `ID_VISITA` para atualizar ou criar uma unica linha.

## Estrutura do cenario v2

1. Duplique o cenario atual no Make.
2. Crie um novo `Custom webhook` e copie sua URL somente para a variavel v2.
3. Adicione um Router imediatamente depois do webhook.
4. Crie a rota `PHOTO_UPLOAD` com filtro `EVENT_TYPE = PHOTO_UPLOAD`.
5. Crie a rota `VISIT_FINALIZE` com filtro `EVENT_TYPE = VISIT_FINALIZE`.
6. Remova da copia o `Webhook response` que aparece antes dos modulos do Drive.
7. Coloque uma resposta no final de cada caminho bem-sucedido.

## Rota PHOTO_UPLOAD

### Hierarquia de pastas

Pesquisar `1.PASTA_INDUSTRIA_NOME` na pasta raiz de fotos do Criativa. Se nao
existir, criar a industria. Dentro dela, pesquisar `1.PASTA_VISITA_NOME`, que
corresponde a data da visita. Criar somente quando nao existir. Dentro da data,
pesquisar `1.PASTA_PDV_NOME` e criar a pasta do PDV quando ela ainda nao
existir.

A estrutura final e:

```text
RAIZ/INDUSTRIA/DD-MM-AAAA/PDV
  fotos de fachada, antes, estoque, depois e saida
  DEVOLUCOES/
    somente fotos com ETAPA = TROCAS
```

Exemplo:

```text
VENEZA/14-08-2026/Itapoa Supermercado - Mata da Praia/
  ITAPOA_SUPERMERCADO_MATA_DA_PRAIA_14-08-2026_VENEZA_ANTES_01.jpg
  DEVOLUCOES/
    ITAPOA_SUPERMERCADO_MATA_DA_PRAIA_14-08-2026_VENEZA_TROCAS_01.jpg
```

O app envia os campos adicionais:

- `PASTA_PDV_NOME`: nome legivel do PDV, limitado e sem `/` ou `\`;
- `PASTA_SUBPASTA_NOME`: `DEVOLUCOES` somente para `ETAPA = TROCAS`;
- `LAYOUT_PASTAS`: `INDUSTRIA_DATA_PDV_V1`.

### Router do destino final

Depois de encontrar ou criar a pasta do PDV, use um Router:

1. Rota `FOTOS DO PDV`: filtro `1.PASTA_SUBPASTA_NOME` vazio. O Folder ID
   final e o ID limpo da pasta do PDV.
2. Rota `DEVOLUCOES`: filtro `1.PASTA_SUBPASTA_NOME = DEVOLUCOES`. Pesquisar
   esse nome dentro da pasta do PDV e criar somente se nao existir. O Folder ID
   final e o ID limpo da subpasta encontrada ou criada.

Nao execute `Search for Files/Folders` com `PASTA_SUBPASTA_NOME` vazio. Isso
evita a validacao `Search options: Value must not be empty` no Make.

O campo `Folder ID` dos modulos seguintes deve conter apenas um token de ID:
o ID retornado pela pasta encontrada ou criada. Nao mapear o bundle completo.

### Idempotencia do arquivo

Pesquisar o arquivo `1.NOME_ARQUIVO` dentro da pasta de destino final: PDV para
fotos normais ou `DEVOLUCOES` para `ETAPA = TROCAS`. O nome inclui hash e ordem,
portanto uma nova tentativa encontra o mesmo arquivo e nao cria duplicata.

Se o arquivo nao existir, usar `Google Drive - Upload a File`:

- `Folder ID`: ID limpo da pasta encontrada/criada.
- `File Name`: `1.NOME_ARQUIVO`.
- `Data`: `toBinary(1.FOTO_BASE64; base64)`.

No Make, `base64` e o argumento de codificacao, sem aspas.

### Resposta obrigatoria

Depois de confirmar o arquivo criado ou localizado, responder JSON:

```json
{
  "success": true,
  "eventType": "PHOTO_UPLOADED",
  "eventId": "{{1.EVENT_ID}}",
  "photoId": "{{1.ID_FOTO}}",
  "fileId": "{{ID limpo do arquivo}}",
  "fileUrl": "https://drive.google.com/file/d/{{ID limpo do arquivo}}/view",
  "folderId": "{{ID limpo da pasta de destino final}}",
  "folderUrl": "https://drive.google.com/drive/folders/{{ID limpo da pasta de destino final}}",
  "pdvFolderId": "{{ID limpo da pasta do PDV}}",
  "pdvFolderUrl": "https://drive.google.com/drive/folders/{{ID limpo da pasta do PDV}}"
}
```

`folderId` aponta para a pasta que contem o arquivo. `pdvFolderId` sempre
aponta para a raiz da visita naquele PDV; assim, `PASTA_FOTOS_DRIVE_URL` abre o
PDV inteiro e nao apenas a subpasta de devolucoes.

## Rota VISIT_FINALIZE

Essa rota nao recebe base64. Ela so e chamada depois que todas as fotos tiveram
confirmacao real do Drive.

1. Pesquisar `ID_VISITA` na coluna correspondente de `RELATORIO_VISITAS`.
2. Se encontrou, usar `Update a Row` na linha encontrada.
3. Se nao encontrou, usar `Add a Row`.
4. Mapear os campos agregados recebidos no webhook.
5. Nao preencher `LINK_FOTO_ANTES`, `LINK_FOTO_DEPOIS`, `LINK_FOTO_TROCA`,
   `LINK_FOTO_CHECKOUT` ou `LINK_FOTO_ESTOQUE` como colecoes.
6. Preencher `LINK_FOTO_CHECKIN` com o link real recebido do Drive.
7. Preencher `PASTA_FOTOS_DRIVE_URL` para acessar todas as fotos da visita.

Campos principais da linha unica:

- `ID_VISITA`
- `DATA_VISITA`
- `NOME_PROMOTOR`
- `NOME_LOJA`
- horarios e permanencia
- `INDUSTRIAS_VISITA`
- `ESTOQUE_POR_INDUSTRIA`
- `TROCAS_POR_INDUSTRIA`
- quantidades por etapa e `TOTAL_FOTOS`
- `LINK_FOTO_CHECKIN`
- `PASTA_FOTOS_DRIVE_URL`
- `STATUS_UPLOAD_FOTOS`
- estados de analise, revisao e relatorio
- `ATUALIZADO_EM`

No final do caminho `Add a Row`, responder:

```json
{
  "success": true,
  "eventType": "VISIT_FINALIZED",
  "eventId": "{{1.EVENT_ID}}",
  "visitId": "{{1.ID_VISITA}}",
  "rowAction": "created",
  "rowId": "{{numero ou ID da linha}}"
}
```

No final do caminho `Update a Row`, usar a mesma resposta com
`"rowAction": "updated"`.

## Manifesto por visita

A aba `MANIFESTOS_VISITA` representa uma visita por linha e pode receber um
resumo operacional, sem criar uma linha por foto. O manifesto detalhado dos
arquivos fica no registro persistido da visita no backend e contem `fileId`, URL,
etapa, industria, ordem e data de sincronizacao de cada foto.

## Ativacao controlada

1. Salvar e ativar o cenario v2.
2. Configurar `BACKEND_MAKE_WEBHOOK_V2_URL` no Netlify.
3. Manter `BACKEND_MAKE_SYNC_MODE=legacy` e fazer deploy.
4. Alterar para `BACKEND_MAKE_SYNC_MODE=visit-v2` somente na janela de teste.
5. Registrar uma visita controlada com duas industrias e varias fotos.
6. Confirmar todas as fotos nas pastas `Industria/Data/PDV` do Drive.
7. Confirmar que somente fotos `TROCAS` entraram em `PDV/DEVOLUCOES`.
8. Confirmar exatamente uma linha para o `ID_VISITA` na planilha.
9. Reenviar a mesma visita e confirmar que nao surgiram arquivos nem linhas
   duplicadas.
10. Se falhar, voltar apenas `BACKEND_MAKE_SYNC_MODE` para `legacy`; a visita
   permanece salva e pode ser reenviada.
