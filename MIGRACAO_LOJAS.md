# Plano de Migracao de Lojas e Roteiro

Status: base migrada e validada; backend de roteirizacao aguardando homologacao
com usuarios reais antes da publicacao em producao.

## Origem e destino

- Origem: `Clientes Supermercado.xls`, arquivo fornecido pelo cliente.
- Destino: `Sistema Criativa`, aba `CADASTRO_LOJAS`.
- Chave primaria operacional: `ID_LOJA` existente no destino, que nao sera
  renumerado nem recriado.
- Chave de conciliacao principal: CNPJ normalizado; razao social, endereco,
  numero, bairro e cidade foram usados para desempate e conferencia.

## Resultado da auditoria

- Origem: 153 registros e 19 colunas.
- Destino: 154 registros e 17 colunas preenchidas.
- 153 registros da origem conciliados sem ambiguidade com IDs atuais.
- Uma loja existe somente no destino e sera preservada.
- Um CNPJ aparece em duas lojas distintas; ambas possuem correspondencia segura
  por razao social/endereco e manterao IDs separados.
- Uma loja sem CNPJ foi conciliada pelos demais campos e mantera seu ID.
- 12 lojas nao possuem `X` de segunda a sexta e, pela regra aprovada, nao
  aparecerao para promotores ate receberem um dia.
- Giovana Silveira Pessoa possui rotas na origem, mas nao possui cadastro em
  `PROMOTORES`; essas rotas ficarao sem usuario autorizado, nunca em fallback.

## Resultado da migracao em 2026-08-08

- Backup integral criado na aba
  `BACKUP_LOJAS_2026-08-08_ANTES_ROTEIRO` antes da primeira alteracao.
- As 154 linhas do backup foram relidas e comparadas com a base anterior.
- 153 lojas receberam nome fantasia, responsavel, dias de roteiro e campos de
  auditoria.
- A loja exclusiva do destino, ID `140`, foi preservada sem alteracao.
- Os 154 `ID_LOJA` permaneceram unicos e nenhum CNPJ foi alterado.
- 141 lojas possuem `ROTA_PROMOTOR_ID`; 12 ficaram sem ID porque pertencem a
  Giovana, estao marcadas como `Sem Promotor` ou nao possuem dia de roteiro.
- As variacoes inequivocas de nome de Laila, Leoni e Luane foram vinculadas aos
  IDs existentes de `PROMOTORES` sem criar novos usuarios.
- A conferencia pos-escrita de `CADASTRO_LOJAS!A1:U155` terminou sem
  divergencias.

## Estrutura final planejada

- `A:Q`: estrutura atual preservada.
- `C - NOME_LOJA`: passa a receber `Nome Fantasia`.
- `M:Q`: recebe os valores `X` de segunda a sexta da origem.
- `R - FILIAL`: novo campo de auditoria.
- `S - RAZAO_SOCIAL`: novo campo de auditoria.
- `T - TELEFONE_PROMOTOR`: novo campo de auditoria.
- `U - ROTA_PROMOTOR_ID`: ID estavel de `PROMOTORES` quando houver associacao
  inequivoca; sem correspondencia, permanece vazio e usa apenas nome exato
  normalizado como compatibilidade.

## Sequencia obrigatoria de escrita

1. [Concluido] Reler metadados e `CADASTRO_LOJAS!A1:U155`.
2. [Concluido] Duplicar a aba como
   `BACKUP_LOJAS_2026-08-08_ANTES_ROTEIRO`.
3. [Concluido] Reler a copia e confirmar 154 registros antes de continuar.
4. [Concluido] Atualizar em lote as 153 linhas conciliadas, mantendo
   `ID_LOJA`.
5. [Concluido] Preservar sem alteracao destrutiva a linha exclusiva do destino.
6. [Concluido] Reler `A1:U155` e comparar contagens, IDs, CNPJs, nomes,
   responsaveis e dias.
7. [Concluido] Renovar o cache de configuracao com novo deploy de homologacao.
8. [Pendente] Testar um promotor com rota do dia, um sem rota e um supervisor.
9. [Pendente] Somente apos aprovacao promover o backend para producao.

## Rollback

- Em qualquer divergencia, interromper antes do deploy de producao.
- Restaurar `CADASTRO_LOJAS` a partir da aba backup integral.
- Confirmar novamente IDs, quantidade de linhas e cabecalhos A:Q.
- O rollback nao deve tocar em visitas, fotos, promotores ou industrias.
