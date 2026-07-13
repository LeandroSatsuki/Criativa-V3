# Manual de Uso - Criativa Field Ops

Este manual explica como o aplicativo funciona do ponto de vista operacional, etapa por etapa, sem mexer no fluxo visual existente.

## 1. Visão geral

O Criativa Field Ops organiza uma visita de campo em etapas controladas:

1. Login
2. Seleção da loja
3. Check-in com foto da fachada
4. Antes
5. Estoque
6. Depois
7. Trocas / avarias
8. Check-out
9. Sincronização

O promotor só consegue avançar quando a etapa anterior estiver concluída. O supervisor entra em um painel próprio com dados reais do backend.

## 2. Como acessar o sistema

1. Abra a URL publicada do projeto.
2. Faça login com usuário e senha cadastrados.
3. Se o usuário for promotor, o app abre o fluxo de campo.
4. Se o usuário for supervisor, o app abre o painel de acompanhamento.

### 2.1 Instalação no celular

O app pode ser instalado no celular como PWA.

No Android/Chrome:

1. Abra a URL publicada.
2. Toque no menu do navegador.
3. Escolha a opção de instalar ou adicionar à tela inicial.
4. Abra pelo ícone criado na tela do aparelho.

No iPhone/Safari:

1. Abra a URL publicada.
2. Toque em compartilhar.
3. Escolha adicionar à tela de início.
4. Abra pelo ícone criado na tela do aparelho.

A instalação não muda o fluxo do promotor. Ela apenas deixa o acesso mais parecido com aplicativo e ajuda o navegador a manter os arquivos principais carregados.

## 3. Fluxo do promotor

### 3.1 Login

- O app envia as credenciais para o backend.
- O backend valida o usuário com a base cadastrada.
- O backend devolve uma sessão assinada.
- A sessão fica salva no navegador e vale por um período limitado.

### 3.2 Seleção de loja

- Após o login, o promotor vê somente as lojas permitidas para ele.
- Ao tocar em uma loja, o sistema registra:
  - nome da loja
  - ID da loja
  - horário de check-in
  - visitId da visita

### 3.3 Check-in e fachada

- O primeiro passo operacional é a foto da fachada.
- O botão de confirmação só libera o restante do fluxo depois que existe ao menos uma foto da fachada.
- O app salva a imagem em base64 no estado da visita.

### 3.4 Antes

- O promotor seleciona a indústria.
- O app permite registrar fotos iniciais da situação do PDV.
- O fluxo espera uma seleção de indústria para manter os dados vinculados.
- Cada empresa aceita ate 30 fotos na etapa.

### 3.5 Estoque

- O promotor informa quantidade por indústria.
- Se houver fotos de estoque, elas também são registradas.
- A etapa só pode ser concluída com quantidade válida.
- Cada empresa aceita ate 30 fotos de estoque.

### 3.6 Depois

- O promotor registra as fotos finais da execução.
- Se a análise de imagem estiver configurada, o backend pode gerar uma avaliação.
- Se a IA falhar, a visita não é bloqueada.
- Cada empresa aceita ate 30 fotos na etapa.

### 3.7 Trocas / avarias

- O promotor responde se houve trocas ou avarias.
- Se a resposta for positiva, o app exige foto das trocas.
- Se a resposta for negativa, o fluxo segue sem fotos adicionais nessa etapa.
- Quando houver trocas, cada empresa aceita ate 30 fotos.

### 3.8 Check-out

- O promotor registra a foto de saída.
- O sistema grava o horário de saída.
- O tempo de permanência passa a fazer parte do payload da visita.

### 3.9 Sincronização

- Depois do check-out, a visita pode ser sincronizada.
- O app envia os dados para o backend.
- O backend repassa os dados para o destino operacional configurado.
- Se houver erro, a visita entra em fila local para reenvio.

## 4. Fluxo do supervisor

- O supervisor faz login com o mesmo mecanismo, mas recebe o papel de supervisão.
- O painel mostra:
  - promotores
  - visitas
  - status de sincronização
  - pendências
  - produtividade
- O painel usa dados reais do backend.

## 5. O que acontece com as fotos

- As fotos não viram arquivos soltos no navegador.
- O app converte cada foto para base64.
- Esse conteúdo fica no rascunho e na fila segura do navegador, usando `IndexedDB`.
- Na sincronização, os campos de foto são enviados ao backend e ao destino operacional.

### Nomes de foto usados no fluxo operacional

- `FOTO_CHECKIN`
- `FOTO_ANTES`
- `FOTO_ESTOQUE`
- `FOTO_DEPOIS`
- `FOTO_TROCA`
- `FOTO_CHECKOUT`

### Nomes de arquivo preparados para o destino operacional

- `NOME_CHECKIN`
- `NOME_ANTES`
- `NOME_ESTOQUE`
- `NOME_DEPOIS`
- `NOME_TROCA`
- `NOME_CHECKOUT`

## 6. Como reenviar uma visita com erro

Se a sincronização falhar:

1. Abra a etapa de sincronização.
2. Verifique a mensagem de erro.
3. Use a ação de reenvio da fila local.
4. O app tenta reenviar a visita sem perder o registro local.

## 7. Como encerrar uma sessão

1. Toque em sair da conta.
2. O sistema encerra o acesso local, mas preserva uma visita ainda nao sincronizada.
3. Ao entrar novamente com o mesmo usuario, o app retorna para a etapa salva.
4. Se outra pessoa entrar no aparelho, ela nao recebe o rascunho do usuario anterior.

## 8. Como pausar e continuar uma visita

1. Pode bloquear a tela ou fechar o aplicativo depois que a foto ou resposta aparecer registrada na tela.
2. Ao abrir novamente, o app restaura a loja, as empresas, as fotos, as respostas e a ultima etapa ativa.
3. Se a sessao tiver expirado, faca login novamente com o mesmo usuario para continuar.
4. Nao limpe os dados do navegador nem desinstale a PWA durante uma visita, pois essas acoes removem o armazenamento local do aparelho.

## 9. Regras práticas importantes

- Não pule o check-in.
- Não tente concluir estoque sem indústria.
- Não tente sair sem foto de saída.
- Se houver falha de rede, a visita continua salva localmente.
- O supervisor não deve ser usado com dados fictícios em produção.
