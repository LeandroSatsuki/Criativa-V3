# Guia de autenticacao Make e Google Drive

## 1. O que cada credencial resolve

- Token da API Make: permite consultar e administrar cenarios, webhooks e
  conexoes pela API. Ele nao autoriza o Google Drive e nao impede a expiracao
  semanal do Google OAuth.
- Conexao Google Drive no Make: autoriza os modulos de pasta e upload. Quando o
  aplicativo OAuth personalizado esta em `Testing`, o refresh token expira em
  sete dias.
- Webhook V2: recebe cada foto separadamente e e obrigatorio para enviar todas
  as fotos sem criar uma linha por foto na planilha.

## 2. Criar o token da API Make

1. Acesse o Make com a conta proprietaria do cenario.
2. Clique no avatar e abra `Profile`.
3. Abra `API access`.
4. Clique em `Add token`.
5. Use um nome identificavel, como `Criativa - manutencao tecnica`.
6. Selecione somente os escopos de leitura e alteracao necessarios para
   cenarios, webhooks e conexoes. Nao conceda administracao financeira ou de
   usuarios.
7. Clique em `Add` e copie o token. O Make mostra o valor completo uma unica
   vez.
8. Nao envie o token por WhatsApp, email, planilha ou chat.
9. Guarde o token em um gerenciador de senhas ou cofre de segredos com acesso
   restrito. Nunca salve o valor em arquivo versionado, frontend ou planilha.

## 3. Remover a expiracao semanal do Google Drive

1. Acesse o Google Cloud Console com o proprietario do projeto OAuth usado na
   conexao `Meu Google Drive` do Make.
2. Selecione o projeto correto e abra `Google Auth Platform` ou
   `APIs e servicos > Tela de consentimento OAuth`.
3. Abra `Audience` e confira o status de publicacao.
4. Se estiver `Testing`, escolha `Publish app` / `In production`.
5. Confirme que a Google Drive API esta habilitada e que o cliente OAuth usado
   no Make continua ativo.
6. Se o Google indicar que a aplicacao nao foi verificada, revise os escopos e
   siga o processo indicado pelo proprio Console. Nao crie outro cliente sem
   atualizar a conexao do Make.
7. Volte ao Make, abra `Connections`, localize `Meu Google Drive` e use
   `Reauthorize` uma vez depois da publicacao.
8. Abra o cenario, confirme que todos os modulos Google Drive usam essa mesma
   conexao e execute `Run once` com um teste pequeno.

Para contas pessoais `@gmail.com`, o Make informa que a conexao ainda pode
exigir reautorizacao periodica de aproximadamente seis meses. Publicar o OAuth
remove o ciclo de sete dias, nao uma revogacao feita pelo usuario ou pelo Google.

## 4. Ativar o envio de todas as fotos

O ambiente atual ainda usa:

- `BACKEND_MAKE_SYNC_MODE=legacy`
- `BACKEND_MAKE_WEBHOOK_V2_URL` ausente

O modo legado envia somente a primeira foto de cada etapa. Para corrigir:

1. Configurar o cenario conforme `CONFIGURACAO_MAKE_ETAPA_B.md`.
2. Ativar o novo webhook e testar as rotas `PHOTO_UPLOAD` e `VISIT_FINALIZE`.
3. Adicionar `BACKEND_MAKE_WEBHOOK_V2_URL` nas variaveis do projeto Netlify da
   equipe `Criativa`.
4. Manter `BACKEND_MAKE_SYNC_MODE=legacy` durante o primeiro teste do webhook.
5. Em uma janela controlada, alterar o modo para `visit-v2` e fazer deploy.
6. Registrar uma visita com varias industrias e fotos.
7. Confirmar todas as fotos no Drive, uma unica linha na planilha e ausencia de
   duplicatas ao reenviar.
8. Se houver falha, retornar apenas o modo para `legacy`; a visita permanece
   salva para reenvio.
