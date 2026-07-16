# Diagnostico de Envio com Muitas Fotos

Data: 16/07/2026

## Resultado

A causa primaria foi reproduzida na entrada das Netlify Functions. Nao foi uma
deducao baseada apenas no plano do Make.

O aplicativo enviava o JSON completo da visita, com todas as imagens em base64,
para `/api/visits` e depois enviava o mesmo conteudo novamente para
`/api/visits/sync`.

## Teste do endpoint publicado

Foram enviados corpos sem autenticacao para que nenhuma visita fosse criada. A
resposta `401` confirma que o corpo chegou ao codigo; `500 Internal Error` antes
da autenticacao confirma bloqueio da infraestrutura.

| Corpo enviado | Resultado |
| --- | --- |
| 1 MB | `401 Nao autorizado` |
| 4 MB | `401 Nao autorizado` |
| 5 MB | `401 Nao autorizado` |
| 5,8 MB | `401 Nao autorizado` |
| 6 MB | `500 Internal Error` |
| 6,2 MB | `500 Internal Error` |
| 7 MB | `500 Internal Error` |

## Medicao com foto real

Arquivo medido: `EXTRABOM_02-07-2026_ESTOQUE.jpg`.

- JPEG: 249.548 bytes.
- Base64 aproximado: 332 KB.
- 15 fotos no JSON: 4,76 MiB.
- 18 fotos no JSON: 5,71 MiB.
- 20 fotos no JSON: 6,35 MiB.
- 30 fotos no JSON: 9,52 MiB.

O numero exato varia conforme o conteudo de cada foto, mesmo com resolucao e
qualidade padronizadas.

## Make Free

O plano Free pode limitar a operacao, mas nao foi o primeiro bloqueio deste
caso. A pagina oficial do Make informa:

- tamanho maximo de arquivo automatizado de 5 MB no Free;
- 1.000 creditos mensais;
- 512 MB de transferencia de dados;
- planos pagos com limites maiores.

Cada foto atual fica muito abaixo de 5 MB individualmente. O processo correto e
enviar uma foto por operacao, e nao agrupar todas as imagens base64 em um unico
webhook.

Fontes oficiais:

- https://www.make.com/en/pricing
- https://help.make.com/webhooks

## Correcao aplicada

- visitas de ate 4 MB continuam no endpoint original;
- visitas maiores sao divididas em fragmentos de ate 1,5 MB;
- o upload e associado ao usuario autenticado;
- o backend remonta o JSON e valida SHA-256;
- o limite total seguro e 64 MB;
- os fragmentos sao removidos depois da persistencia;
- a sincronizacao reutiliza a visita salva e nao envia o JSON integral duas vezes.

## Testes da correcao

| Cenario | Tamanho | Fragmentos | Resultado |
| --- | ---: | ---: | --- |
| 20 fotos reais | 6.654.940 bytes | 5 | 20 fotos integras |
| 30 fotos reais | 9.982.290 bytes | 7 | 30 fotos integras |

## Limite restante

O cenario Make atual mapeia uma foto principal por etapa. A correcao garante que
todas as fotos cheguem e fiquem preservadas no backend, mas a Etapa B ainda deve:

1. enviar uma foto por operacao ao Make;
2. obter `fileId` e URL de cada upload do Drive;
3. gravar uma linha por foto em `FOTOS_VISITA`;
4. preencher `LINK_FOTO_CHECKIN` com a URL real do Drive;
5. impedir duplicacao em retries.

