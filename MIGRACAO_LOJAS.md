# Plano de Migracao de Lojas e Roteiro

Status: em homologacao, sem escrita na base de producao.

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

1. Reler metadados e `CADASTRO_LOJAS!A1:U155`.
2. Duplicar a aba como `BACKUP_LOJAS_2026-08-08_ANTES_ROTEIRO`.
3. Reler a copia e confirmar 154 registros antes de continuar.
4. Atualizar em lote as 153 linhas conciliadas, mantendo `ID_LOJA`.
5. Preservar sem alteracao destrutiva a linha exclusiva do destino.
6. Reler `A1:U155` e comparar contagens, IDs, CNPJs, nomes, responsaveis e dias.
7. Forcar a renovacao do cache de configuracao em homologacao.
8. Testar um promotor com rota do dia, um sem rota e um supervisor.
9. Somente apos aprovacao promover o backend para producao.

## Rollback

- Em qualquer divergencia, interromper antes do deploy de producao.
- Restaurar `CADASTRO_LOJAS` a partir da aba backup integral.
- Confirmar novamente IDs, quantidade de linhas e cabecalhos A:Q.
- O rollback nao deve tocar em visitas, fotos, promotores ou industrias.
