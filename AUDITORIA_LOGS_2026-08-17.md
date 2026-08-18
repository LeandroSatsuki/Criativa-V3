# Auditoria de logs de producao - 17/08/2026

## Escopo

- Ambiente: `criativa-field-ops-574` no Netlify.
- Janela analisada: ultimas 24 horas.
- Fontes: logs das 17 Functions e indices leves de visitas.
- Nenhum payload, foto, senha ou webhook foi copiado para este documento.

## Achados

### Netlify Blobs

Foram encontradas quatro falhas consecutivas de token interno expirado na
funcao `auth-login`, por volta de 09:06 no horario de Brasilia. Elas ocorreram
antes da protecao de renovacao do store adicionada ao projeto. A versao atual
possui retry especifico para esse erro e os testes correspondentes passaram.

### Sessoes

Os avisos mais frequentes foram `missing_token`, `expired_token` e
`token_decode_failed`. Eles correspondem a chamadas sem sessao, tokens antigos
mantidos por navegadores/atalhos e acessos anteriores a atualizacao da sessao.
Tambem houve ocorrencias isoladas de `session_replaced`, coerentes com a regra
de uma sessao ativa por usuario.

### Sincronizacao

Nao havia eventos estruturados de falha de sincronizacao nos logs, embora a
visita persistisse `syncStatus` e `syncError`. Essa lacuna foi corrigida nesta
fase com o evento `visit_sync_failed`.

## Protecoes adicionadas

- Diagnostico `GET /api/supervisor/operations-health` restrito a supervisor.
- Contagem total e diaria por estado de sincronizacao.
- Deteccao de envio em `enviando` por mais de 30 minutos.
- Listagem limitada a 20 pendencias recentes e sem fotos.
- Sanitizacao de URLs nas mensagens exibidas.
- Logs de falha com categoria, modo, ID e progresso, sem corpo do Make.

## Resultado pos-deploy

- Nenhum log `error` ou `fatal` encontrado nos dez minutos posteriores ao
  deploy de producao.
- Pagina e healthcheck responderam HTTP `200`.
- Endpoint operacional respondeu `401` sem sessao e `403` para `FIELD_OPS`.
- Google Sheets e Make v2 permaneceram ativos.

## Pendencia controlada

O primeiro retorno HTTP `200` autenticado do novo diagnostico deve ser validado
por um supervisor real. Essa chamada nao foi feita durante a implantacao para
nao substituir a sessao ativa de nenhum usuario.
