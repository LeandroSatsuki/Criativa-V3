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

## Atualizacao de escala - 28/07/2026

Uma amostra real de 34 arquivos do Drive apresentou:

- minimo de 39,2 KB;
- mediana de 97,7 KB;
- media de 102,3 KB;
- maximo de 212,5 KB;
- 10 arquivos acima de 120 KB.

O tamanho varia com ruido, textura, iluminacao e quantidade de detalhes. Por
isso, uma qualidade JPEG fixa nao padroniza o peso entre iPhone e Android.

### Padrao implementado

- lado maior inicial de 1280 pixels;
- qualidade JPEG maxima igual ao comportamento anterior: 0,62;
- alvo de 100 KB por arquivo;
- teto de 120 KB por arquivo;
- busca adaptativa pela maior qualidade que atende ao alvo;
- reducao progressiva para 1152, 1024, 960, 896 e 800 pixels somente quando
  baixar a qualidade nao for suficiente;
- falha explicita antes de salvar se nem o modo de emergencia atingir o teto.

O processamento usa `Blob` e URL temporaria para evitar manter simultaneamente
o arquivo original inteiro em base64 na memoria do celular.

### Projecao para 8.000 fotos por dia

Considerando 26 dias operacionais por mes:

| Media por foto | Trafego diario | Trafego mensal |
| --- | ---: | ---: |
| 70 KB | 0,56 GB | 14,6 GB |
| 100 KB | 0,80 GB | 20,8 GB |
| 120 KB | 0,96 GB | 25,0 GB |
| 250 KB | 2,00 GB | 52,0 GB |

O base64 transportado no JSON adiciona aproximadamente 33% durante o envio. O
arquivo final gravado no Drive volta a ser binario e nao carrega esse aumento.

### Estrutura correta da Etapa B

1. cada foto e enviada individualmente ao Make e ao Drive;
2. cada resposta confirma `fileId` e URL do arquivo;
3. o manifesto guarda as confirmacoes e impede duplicacao em retries;
4. a planilha recebe uma unica linha agregada por visita, nunca uma linha por
   foto;
5. `LINK_FOTO_CHECKIN` recebe a URL real da foto de check-in;
6. demais fotos ficam organizadas na pasta e no manifesto da visita.

### Riscos remanescentes

- o modo Make v2 foi validado e ativado em 03/08/2026, com confirmacao por foto,
  reutilizacao idempotente de arquivo e uma linha por visita;
- a qualidade deve ser homologada em um piloto com iPhone e Android, incluindo
  leitura de rotulos e uso nos relatorios;
- armazenamento, creditos e transferencia devem ser monitorados mensalmente;
- o warning conhecido de bundle grande do frontend nao interfere no peso das
  fotos, mas deve ser tratado em otimizacao futura.
