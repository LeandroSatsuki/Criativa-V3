# Proposta de Automacao de Relatorios

## Objetivo

Automatizar a selecao, revisao e montagem dos books enviados as industrias,
mantendo exatamente uma linha por visita em `RELATORIO_VISITAS`. As fotos ficam
no Google Drive e a linha guarda somente o link da pasta, o check-in e resumos.

O desenho preserva o aplicativo de campo, o Google Drive, a planilha Sistema
Criativa e o Make durante a transicao. Nenhuma troca de ferramenta deve ocorrer
sem validacao explicita do cliente.

## Diagnostico do processo atual

### Planilha Sistema Criativa

- Arquivo: `Sistema Criativa`.
- Aba `RELATORIO_VISITAS`: 30 colunas disponiveis; os 18 cabecalhos atualmente
  preenchidos vao de `DATA_VISITA` a `LINK_FOTO_ESTOQUE`.
- A aba representa uma visita/industria em uma linha e possui colunas para uma
  unica foto de cada etapa.
- As amostras existentes possuem indicadores de IA, mas os links de fotos estao
  vazios.
- Aba `INDUSTRIAS`: hoje contem apenas `INDUSTRIAS` e `SITE`.
- O `SITE` e uma referencia institucional, mas nao e necessariamente um catalogo
  versionado dos produtos, embalagens e regras que a IA deve reconhecer.

### Aplicacao

- O payload enviado ao Make usa somente a primeira foto de cada etapa.
- A IA atual analisa somente a primeira foto de `Depois`.
- A analise recebe o nome da industria, mas nao consulta a referencia cadastrada
  na aba `INDUSTRIAS`.
- Os resultados atuais (`Bom/Ruim`, `Conforme/Nao Conforme`, `Sim/Nao`) nao
  registram evidencia, confianca, versao da regra ou decisao humana.

### Book analisado

O arquivo `VENEZA 70.pdf` possui 26 paginas e confirma que a entrega real e um
relatorio editorial, organizado assim:

1. Capa da industria.
2. Periodo semanal.
3. Redes e lojas atendidas.
4. Fotos selecionadas por loja e data.
5. Pares `Antes` e `Depois` quando aplicavel.
6. Link final para a galeria completa no Google Drive.

Portanto, a visita e a unidade de registro na planilha. Cada foto continua
identificavel no manifesto persistido da visita e no Drive, sem gerar novas
linhas na planilha operacional.

## Decisao recomendada para as colunas atuais

| Coluna | Decisao | Motivo |
| --- | --- | --- |
| `LINK_FOTO_CHECKIN` | Manter e preencher automaticamente | Existe uma foto principal de entrada por visita e o link facilita auditoria. |
| `LINK_FOTO_ANTES` | Descontinuar para novos registros | Uma unica celula nao representa ate 30 fotos por industria. |
| `LINK_FOTO_DEPOIS` | Descontinuar para novos registros | Usar o link da pasta completa da visita. |
| `LINK_FOTO_CHECKOUT` | Nao usar como colecao | Usar o link da pasta completa da visita. |
| `LINK_FOTO_TROCA` | Nao usar como colecao | Usar o link da pasta completa da visita. |
| `LINK_FOTO_ESTOQUE` | Aposentar | A regra informada removeu esse campo do relatorio. |
| `IA_ORGANIZACAO` | Manter apenas como resumo derivado | A fonte real deve ser a analise individual das fotos. |
| `IA_STATUS_COMPLIANCE` | Manter apenas como resumo derivado | Uma visita pode conter fotos conformes e nao conformes. |
| `IA_RUPTURAS` | Manter apenas como resumo derivado | A ruptura precisa indicar foto, produto, evidencia e confianca. |

As colunas antigas nao devem ser apagadas na primeira implantacao. Elas devem
permanecer para compatibilidade e historico, mas deixar de ser a fonte principal
para fotos e IA.

## Estrutura de dados recomendada

### 1. `RELATORIO_VISITAS`

Continuar como indice resumido, com exatamente uma linha por visita:

- `ID_VISITA`
- data, promotor, loja, entrada, saida e permanencia
- industrias da visita
- estoque e devolucoes agregados por industria
- `LINK_FOTO_CHECKIN`
- `PASTA_FOTOS_DRIVE_URL`
- quantidade de fotos por etapa
- status da analise
- status de revisao
- status do relatorio

### 2. Aba `MANIFESTOS_VISITA`

Uma linha por visita com contagens, pasta do Drive, link do check-in e estado do
upload. Os metadados individuais de cada arquivo ficam no manifesto JSON da
visita persistida no backend, sem aumentar o numero de linhas da planilha.

### 3. Aba `ANALISES_VISITA`

Uma linha por visita com o resumo das analises individuais:

- `ID_VISITA`
- `INDUSTRIAS_VISITA`
- `ORGANIZACAO_RESUMO`
- `COMPLIANCE_RESUMO`
- `RUPTURA_RESUMO`
- `CONFIANCA_MEDIA`
- `FOTOS_ANALISADAS`
- `FOTOS_ELEGIVEIS_RELATORIO`
- `STATUS_ANALISE`
- `STATUS_REVISAO`
- `REVISADO_POR`
- `REVISADO_EM`
- `MODELO_IA`
- `VERSAO_PROMPT`
- `VERSOES_REFERENCIA`
- `DETALHES_JSON_URL`
- `ANALISADA_EM`

### 4. Nova aba `RELATORIOS_INDUSTRIA`

Uma linha por book gerado:

- `ID_RELATORIO`
- `INDUSTRIA`
- `PERIODO_INICIO`
- `PERIODO_FIM`
- `STATUS`
- `QUANTIDADE_LOJAS`
- `QUANTIDADE_FOTOS`
- `SLIDES_URL`
- `PDF_URL`
- `PASTA_DRIVE_URL`
- `GERADO_EM`
- `GERADO_POR`
- `VERSAO_TEMPLATE`

### 5. Evolucao da aba `INDUSTRIAS`

Adicionar, sem remover `SITE`:

- `ID_INDUSTRIA`
- `LOGO_URL`
- `CATALOGO_REFERENCIA_URL`
- `PASTA_REFERENCIAS_DRIVE_ID`
- `REGRAS_EXPOSICAO_URL`
- `REFERENCIA_ATUALIZADA_EM`
- `VERSAO_REFERENCIA`
- `IA_ATIVA`
- `ATIVA`

O catalogo deve conter imagens e regras aprovadas pela industria. Usar somente
o site publico pode produzir resultados inconsistentes quando o site muda ou
nao exibe todo o portfolio.

## Fluxo automatizado proposto

1. O promotor conclui a visita normalmente, inclusive em modo offline.
2. O backend registra a visita antes de solicitar qualquer integracao externa.
3. O Make envia cada foto ao Drive e devolve `fileId` e URL do arquivo criado.
4. Cada confirmacao e adicionada ao manifesto persistido da visita, sem gravar
   uma linha por foto na planilha.
5. Depois de todos os uploads, o Make cria ou atualiza uma unica linha pelo
   `ID_VISITA`, incluindo o link de check-in e a pasta completa do Drive.
6. Fotos de `Antes` e `Depois` entram em uma fila assincrona de analise.
7. A IA compara as fotos com a referencia versionada da industria e grava um
   resumo por visita em `ANALISES_VISITA`; detalhes podem ficar em JSON no Drive.
8. Fotos com baixa confianca, baixa qualidade ou divergencia vao para revisao
   do supervisor. A falha da IA nunca invalida nem bloqueia a visita.
9. O supervisor aprova ou rejeita as fotos sugeridas para o book.
10. Ao escolher industria e periodo, o sistema agrupa lojas, redes, datas e
    pares `Antes/Depois` aprovados.
11. Uma copia de um template Google Slides e preenchida automaticamente.
12. O Slides e exportado para PDF e os links sao gravados em
    `RELATORIOS_INDUSTRIA`.

## Criterios da IA

A IA deve apoiar a curadoria, nao tomar a decisao final sem supervisao.

### Primeiro filtro: qualidade da foto

- imagem legivel e com iluminacao suficiente
- ausencia de desfoque grave
- gondola/produto visivel
- carimbo nao cobrindo a evidencia principal
- foto relacionada a loja e etapa informadas

### Segundo filtro: industria e produto

- identifica produtos da industria cadastrada
- compara embalagem e marca com a referencia versionada
- indica produtos de outra industria apenas como contexto
- nao considera uma foto elegivel quando nao houver evidencia suficiente

### Terceiro filtro: operacao

- nota de organizacao com justificativa objetiva
- compliance por regra violada ou atendida
- ruptura por produto, espaco vazio ou ausencia esperada
- confianca numerica e evidencias visuais resumidas

### Regra de publicacao

- alta confianca e criterios atendidos: sugerir aprovacao
- baixa confianca ou conflito: revisao obrigatoria
- baixa qualidade ou industria ausente: sugerir rejeicao
- somente uma decisao humana libera a foto para o PDF durante a primeira etapa
  de operacao

## Geracao do book

A opcao de menor risco e usar um Google Slides modelo aprovado pelo cliente:

- preserva o visual atual
- permite ajustes manuais excepcionais antes do envio
- gera PDF nativamente
- reduz a necessidade de manter um motor grafico proprio
- facilita criar capa, periodo, redes atendidas, fotos por loja e pagina final

O processo deve executar como trabalho assincrono, pois baixar imagens, montar
dezenas de paginas e exportar PDF pode exceder o tempo de uma requisicao web.
O Make pode orquestrar a primeira versao; o backend deve manter os IDs, estados
e contratos para que o processo seja rastreavel e possa ser migrado depois.

## Seguranca e confiabilidade

- nao expor chaves do Google, Gemini ou Make no frontend
- usar IDs imutaveis em vez de nomes de pasta para relacionar arquivos
- aplicar permissao minima nas pastas e evitar links publicos quando nao forem
  necessarios
- registrar status `pendente`, `processando`, `concluido` e `erro` por foto,
  analise e relatorio
- tornar uploads e gravacoes idempotentes para evitar duplicatas em retries
- salvar modelo, prompt e referencia usados em cada analise
- nao enviar fotos a IA sem informar o uso e a politica de retencao ao cliente
- manter revisao humana para reduzir falsos positivos e alucinacoes

## Custos e limites

- Gemini: custo cresce por foto; analisar apenas `Antes` e `Depois` por padrao e
  reutilizar o resultado salvo.
- Make: cada foto e cada linha podem consumir operacoes; evitar routers e buscas
  repetidas por nome quando um ID ja estiver disponivel.
- Drive: adequado para a etapa atual, mas requer monitoramento de permissoes,
  conexao OAuth e cota.
- Sheets: adequado como interface operacional inicial, mas nao deve receber
  imagens base64 nem ser tratado como banco transacional.
- Netlify: manter a captura e a fila; usar trabalho em segundo plano para geracao
  longa do book.

## Implantacao segura em etapas

### Etapa A - Contrato e compatibilidade

- [x] definir IDs e campos definitivos
- [x] criar as novas abas sem alterar as antigas
- [ ] preencher automaticamente `LINK_FOTO_CHECKIN` com a URL retornada pelo Drive
- [x] manter o cenario atual funcionando em paralelo

Status em 16/07/2026: a estrutura da Etapa A foi criada. O preenchimento do
link depende da Etapa B, porque somente o modulo de upload do Drive no Make
conhece o `fileId` definitivo. O campo nao deve receber base64 no lugar da URL.

### Etapa B - Registro individual de fotos

- fazer o Make devolver `fileId` e URL de cada upload
- gravar uma linha por foto em `FOTOS_VISITA`
- validar idempotencia e retries

O processamento deve ocorrer uma foto por operacao. O plano Free do Make limita
o tamanho de arquivo automatizado a 5 MB; as fotos atuais medidas ficam em torno
de 0,25 MB apos decodificacao, mas o conjunto em base64 pode ultrapassar os
limites do webhook e da Netlify se for enviado como um unico JSON.

### Etapa C - IA auditavel

- cadastrar catalogos e regras versionadas por industria
- analisar todas as fotos elegiveis, nao apenas a primeira
- gravar evidencias, confianca e versoes
- implementar fila de revisao do supervisor

### Etapa D - Geracao do book

- aprovar um template Google Slides
- gerar book de previa por industria e periodo
- exportar PDF e registrar links
- comparar o primeiro resultado automatico com um book manual

### Etapa E - Operacao e melhoria

- medir custo, tempo, rejeicoes e correcoes humanas
- ajustar regras por industria
- apos estabilidade, aposentar colunas e rotas antigas que nao sejam mais usadas

## Criterios de aceite da primeira implantacao

- nenhuma visita ou foto atual e perdida
- `LINK_FOTO_CHECKIN` aponta para a foto correta no Drive
- cada foto possui uma linha unica e rastreavel
- retries nao duplicam fotos nem visitas
- IA usa referencia da industria e registra a versao utilizada
- supervisor consegue revisar a selecao antes do PDF
- book automatico preserva a estrutura visual aprovada
- falha de IA ou geracao nao bloqueia o aplicativo de campo

## Decisoes necessarias antes da implementacao

1. Aprovar a criacao das abas `FOTOS_VISITA`, `ANALISES_FOTO` e
   `RELATORIOS_INDUSTRIA` na planilha atual.
2. Definir se o primeiro book automatico sera gerado por Google Slides, conforme
   recomendado, ou por outro formato.
3. Fornecer ou aprovar o catalogo de produtos e as regras de compliance de cada
   industria; os sites atuais nao sao suficientes como unica fonte de verdade.
4. Confirmar quem fara a revisao humana inicial das fotos sugeridas pela IA.
