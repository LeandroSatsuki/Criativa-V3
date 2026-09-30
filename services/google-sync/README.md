# Google Sync Service

Servico que substitui o processamento operacional do Make. A Netlify envia
lotes autenticados ao ingresso, que grava as fotos temporariamente no Cloud
Storage e publica somente referencias no Cloud Tasks. O worker privado organiza
o Drive e finaliza a visita no Google Sheets.

## Estado atual

- contrato de idempotencia implementado;
- lease impede processamento concorrente;
- retry apos lease expirado;
- recibo concluido reutilizado em reenvios;
- limite de tentativas e `dead_letter`;
- nomes deterministas para Cloud Tasks;
- nomes opacos para objetos temporarios;
- ingresso limitado a 20 fotos e 30 MB por lote;
- staging privado com lifecycle de sete dias;
- criacao idempotente de `INDUSTRIA/DATA/PDV[/DEVOLUCOES]`;
- upsert em `RELATORIO_VISITAS` por `ID_VISITA`;
- autenticacao do ingresso por `X-Ingress-Token`;
- worker privado invocado por OIDC pelo Cloud Tasks.

## Ambientes implantados

- Homologacao: `criativa-sync-ingress-homolog` e
  `criativa-sync-worker-homolog`.
- Producao: `criativa-sync-ingress-prod` e `criativa-sync-worker-prod`.
- Regiao: `southamerica-east1`.
- Filas separadas: `criativa-sync-homolog` e `criativa-sync-prod`.
- O ingresso e publico no IAM, mas rejeita chamadas sem o token da aplicacao.
- O worker nao possui acesso anonimo.
- Credenciais OAuth e identificadores de destino ficam no Secret Manager.
- A conta de runtime nao possui chave JSON gerenciada pelo usuario.

## Operacao

- `SERVICE_ROLE=ingress` inicia somente as rotas `/v1/ingress/*`.
- `SERVICE_ROLE=worker` inicia somente as rotas privadas `/v1/jobs/*`.
- Jobs concluidos devolvem o recibo persistido sem repetir Drive ou Sheets.
- Falhas excedentes terminam em `dead_letter`; nunca entram em loop infinito.
- O Make permanece configurado como rollback por feature flag na Netlify.

Instale as dependencias e execute a verificacao local:

```bash
npm ci
npm test
npm run build
npm audit --audit-level=high
```
