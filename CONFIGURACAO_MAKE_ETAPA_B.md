# Configuracao do Make - Etapa B

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

### Pasta da visita

Pesquisar uma pasta pelo valor exato de `1.PASTA_VISITA_NOME`, limitada a pasta
raiz de fotos do Criativa. Se nao existir, criar a pasta com esse nome dentro da
pasta raiz. Se existir, reutilizar o `File ID` retornado pela busca.

O campo `Folder ID` dos modulos seguintes deve conter apenas um token de ID:
o ID retornado pela pasta encontrada ou criada. Nao mapear o bundle completo.

### Idempotencia do arquivo

Pesquisar o arquivo `1.NOME_ARQUIVO` dentro da pasta da visita. O nome inclui
hash e ordem, portanto uma nova tentativa encontra o mesmo arquivo e nao cria
duplicata.

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
  "folderId": "{{ID limpo da pasta}}",
  "folderUrl": "https://drive.google.com/drive/folders/{{ID limpo da pasta}}"
}
```

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
6. Confirmar todas as fotos na pasta unica do Drive.
7. Confirmar exatamente uma linha para o `ID_VISITA` na planilha.
8. Reenviar a mesma visita e confirmar que nao surgiram arquivos nem linhas
   duplicadas.
9. Se falhar, voltar apenas `BACKEND_MAKE_SYNC_MODE` para `legacy`; a visita
   permanece salva e pode ser reenviada.

