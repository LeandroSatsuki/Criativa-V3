# Auditoria cadastral - 17/08/2026

## Escopo

Reconciliacao segura entre as abas `PROMOTORES` e `CADASTRO_LOJAS` da
planilha `Sistema Criativa`, sem alterar credenciais, status, dias de roteiro,
visitas ou fotos.

Planilha operacional:

`https://docs.google.com/spreadsheets/d/1KyyEA78ny_5iNh5N9LTbtX5ieyJ6_s5UR-1Mv45bi-Q/edit`

## Resultado aplicado

- 26 telefones de promotores preenchidos a partir de um unico telefone
  consistente nas lojas ja atribuidas ao respectivo ID.
- 7 lojas com responsavel inequivoco receberam o `ROTA_PROMOTOR_ID` faltante.
- 8 nomes de responsaveis foram normalizados para a grafia exata do cadastro,
  preservando o ID existente.
- 41 celulas alteradas na aba `PROMOTORES` e 15 na aba `CADASTRO_LOJAS`.
- Nenhuma alteracao fora das colunas `TELEFONE`, `RESPONSAVEL` e
  `ROTA_PROMOTOR_ID`.

## Regras de conciliacao

1. `ID_PROMOTOR` e a chave autoritativa da pessoa.
2. Nome normalizado so pode preencher ID quando houver uma unica
   correspondencia exata no cadastro.
3. Telefone so pode ser propagado quando todas as lojas do mesmo promotor
   apresentarem um unico numero consistente.
4. Correspondencia aproximada ou apenas por primeiro nome nao e aceita.
5. Dias de roteiro nunca sao inferidos.
6. Credenciais, papel e status nunca sao modificados durante conciliacao de
   rotas.

## Pendencias preservadas

### ID 121 sem cadastro

Oito lojas apontam para o ID `121` e para Vanessa Batista Maciel, mas nao existe
uma linha correspondente na aba `PROMOTORES`. Linhas da planilha:

`7, 17, 68, 77, 96, 117, 120 e 139`.

Nao foi feita associacao com outra pessoa de nome semelhante. Para resolver, o
cliente deve confirmar o cadastro correto, incluindo ID, usuario, credencial,
regional, papel e status.

Atualizacao: o cliente confirmou o cadastro ativo em 17/08/2026. Vanessa foi
incluida como `FIELD_OPS`, ID `121`, com usuario proprio, regional Vitoria e o
telefone ja comprovado pela fonte original. Os dias existentes foram
preservados e a loja sem agenda permaneceu sem marcacao.

### Lojas sem dia definido

Sete lojas atribuidas nao possuem `X` de segunda a sabado:

- linha 96, ID 121, Extraplus Jardim Camburi;
- linha 99, ID 113, Extrabom Grande;
- linha 105, ID 108, BH Cachoeiro de Itapemirim 536;
- linha 108, ID 100, BH Colatina 504;
- linha 126, ID 69, BH Movelar 534;
- linha 135, ID 69, BH Shell Linhares;
- linha 141, ID 116, SUPERMERCADOS BH - ROD. GOVERNADOR MARIO COVAS - 544.

Essas lojas nao entram na meta diaria ate o cliente informar o dia correto.

## Verificacao pos-alteracao

- 31 promotores e 154 lojas relidos da fonte oficial.
- Zero nome divergente para IDs de promotores cadastrados.
- Zero loja com nome inequivoco e ID de rota vazio.
- Permaneceram somente os 8 vinculos conhecidos ao ID ausente `121`.
- Comparacao integral confirmou 26 diferencas na coluna de telefone, 8 na
  coluna de responsavel e 7 na coluna de ID de rota, sem diferencas inesperadas.

## Rollback

Se houver contestacao dos dados, usar o historico de versoes do Google Sheets
e reverter apenas as celulas identificadas nesta auditoria. Nao restaurar a aba
inteira, pois ela e uma fonte ativa de producao.
