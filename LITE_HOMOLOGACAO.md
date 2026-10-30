# Piloto Lite

Historico do piloto validado no Moto G84 e no backend. Para a ativacao por aparelho no endereco oficial, consultar `LITE_USO_REAL.md`; os itens pendentes abaixo registram a situacao de cada etapa anterior.

Preview inicial: `6ae4a1fbdabad6722181e5c3`, bundle `index-sfvEe8Lr.js` (substituido para o teste real).
Preview para o Moto G84: `6ae4ac537bda385b9deb0003`, bundle `index-DmBBrbsv.js`.
Conferido apos publicacao: login e PWA sem erro JavaScript; 20 funcoes e health Google. O deploy oficial permaneceu `6ae1f58c3c646eebc5f8d7a6`, saudavel em `google-v1`.

## Ativacao

- Branch `agent/lite-homologacao`.
- Build com `VITE_LITE_PILOT=true`; sem essa variavel, novas capturas seguem o modo normal.
- Para o piloto real, usar `npm run build:lite-preview`: gera `dist-lite`, ativa catalogo sintetico e API `/lite-api`, com proxy somente desse build para o backend oficial. Publicar com `netlify deploy --no-build --dir dist-lite --skip-functions-cache`, sem `--prod`.
- Usar apenas preview, sem `--prod`. A origem oficial permanece na versao anterior.
- O modo por aparelho e a liberacao pelo mesmo link oficial pertencem a etapa posterior ao piloto.

## Comportamento implementado

- Cada nova foto comprimida e gravada em `criativa-lite-photos/photos` antes de entrar no rascunho.
- O rascunho e a fila guardam uma referencia por foto. O registro individual contem dono, visita, loja, etapa, industria e instante da captura para auxiliar recuperacao.
- A qualidade, resolucao e carimbo usam o processamento existente. A camera ainda e a camera nativa do dispositivo.
- A galeria mostra uma imagem por pagina. Analise de IA e animacao de transicao entre secoes ficam desativadas no Lite.
- Na finalizacao, duas leituras sequenciais calculam hash/quantidade e enviam somente os fragmentos ausentes. Nao se monta o JSON com todas as imagens nem uma lista de todos os fragmentos na memoria.
- SHA-256 incremental usa `@noble/hashes` fixado em `2.0.1`. A verificacao de hash do servidor permanece obrigatoria.
- O servidor recebe o mesmo JSON com base64, IDs e contratos Google do fluxo anterior; referencias locais nunca devem chegar ao backend.
- Foto ausente, dono diferente, falha de gravacao ou mudanca de conteudo impedem a finalizacao. A fila permanece disponivel.
- Fotos antigas em base64 continuam legiveis e podem coexistir com referencias. Nao ha migracao automatica de rascunhos antigos.

## Limites antes de liberar

- O backend compartilha sessoes e dados com producao. O usuario autorizou expressamente `lorena.costa` para este teste, inclusive a desconexao do outro aparelho. Nao usar outras contas da operacao sem reserva para teste.
- Dados locais sao separados por origem. Nao orientar Keutily a trocar de link, reinstalar ou limpar dados com visita/fila pendente.
- O usuario confirmou camera e reabertura sem aviso de memoria, demora ou travamento no Moto G84. O envio correspondente ate Drive/planilha foi conferido no registro abaixo. Nao houve medicao direta de RAM do aparelho.
- Ainda falta implementar coleta segura de fotos locais sem uso. Nesta versao, nenhuma foto do cofre e excluida automaticamente, inclusive apos envio ou cancelamento. Isso preserva recuperacao, mas pode acumular armazenamento; impede liberacao ampla.
- Ainda falta migracao segura das visitas grandes antigas, caso se confirme necessidade no aparelho.
- Envio enquanto a visita esta em andamento nao foi ativado; nesta etapa o envio e sequencial por partes na finalizacao.
- Uma versao anterior ao suporte de referencias nao pode ser aplicada sobre filas Lite. Para desativar novas capturas Lite, usar build sem a flag mantendo o leitor e transporte de referencias.
- Nao ha medicao de pico de RAM no Android nem garantia de eliminacao do aviso do Chromium.

## Verificacao concluida

- 164 testes aprovados; TypeScript e builds normal/Lite aprovados.
- 100 fotos sinteticas: rascunho leve, resolucao de uma foto por vez e transporte sequencial; integridade conferida com hash nativo Node.
- Interrupcao e retomada sem reenviar fragmentos confirmados, isolamento por dono, foto ausente e transacao de gravacao abortada.
- Comparacao dos eventos de foto e finalizacao Google: mesmos dados, IDs e destinos logicos para conteudo igual.
- Chrome com backend simulado: captura, gravacao individual, recarga da pagina, exibicao, finalizacao com hash valido e ausencia de chamada IA.
- Build normal: abertura com 100 fotos e tres filas antigas, rascunho legado, login vazio e falha de conexao.
- Os testes simulados nao criaram fotos/visitas reais. O ensaio real autorizado abaixo criou um registro identificado como homologacao.

## Ensaio real autorizado com Lorena

- Conta `lorena.costa`, ID `101`, autorizada pelo usuario para o teste mesmo que desconectasse outro aparelho.
- Visita `VISIT-7C86A59C`; PDV sintetico `HOMOLOGACAO LITE - NAO OPERACIONAL`, ID `HOMOLOG-LITE`; industria sintetica `HOMOLOGACAO LITE`.
- Quatro imagens sinteticas rotuladas: FACHADA, ANTES, DEPOIS e CHECKOUT, capturadas pela interface do preview no Chrome.
- O upload Lite foi aceito, mas o worker do preview inicial recebeu HTTP 401 do Google. Metadados de configuracao confirmaram URL Google diferente entre preview e producao. Credenciais nao foram expostas nem alteradas.
- A MESMA visita foi retomada uma unica vez pelo endpoint autenticado de background do backend oficial, sem recriar o registro.
- Resultado conferido no armazenamento do servidor: `syncStatus=enviado`, 4/4 comprovantes com arquivo e URL, `finalizedAt=2026-10-30T11:37:59-03:00`, linha criada `RELATORIO_VISITAS!A2406:AD2406`, sem pendencia no indice do servidor.
- Pasta confirmada pelos recibos: https://drive.google.com/drive/folders/1tB5_Mdbitj_R85i006hSHtw3DWWALfN1 . Nao foi feita inspecao visual autenticada de cada arquivo no Drive; a verificacao foi pelos comprovantes do worker e manifesto final.
- Para eliminar a divergencia no piloto, o novo build isolado usa proxy `/lite-api` para o backend oficial ja validado. Login real pelo proxy foi confirmado; uma segunda passagem da interface parou apos a conta entrar em outro aparelho. Nenhum segundo upload real foi concluido por essa passagem.
- Nao insistir em logins paralelos: o Moto G84 deve ser o unico aparelho usando a conta durante o teste. Ensaio local da nova compilacao com APIs simuladas passou em captura, recarga, fila offline, retomada e confirmacao de envio.
- A camera nativa e o fluxo do novo preview foram executados pelo usuario no Moto G84 e confirmados no ensaio abaixo.

## Resultado do piloto no Moto G84

- Em 30/10/2026, o usuario informou que o teste no Android Moto G84, incluindo camera e reabertura, funcionou sem aviso de memoria, demora ou travamento.
- Visita encontrada no backend: `VISIT-5F8E6908`, conta Lorena ID 101, PDV `HOMOLOGACAO LITE - NAO OPERACIONAL`.
- Entrada `2026-10-30T16:30:46.808Z`, saida `2026-10-30T16:31:28.424Z`; registro recebido as 13:32:54 de Brasilia e finalizado as 13:33:34.
- Cinco fotos com cinco comprovantes de arquivo/URL: FACHADA, ANTES, ESTOQUE, DEPOIS e CHECKOUT.
- `syncStatus=enviado`, sem erro, sem identificador de lote ou finalizacao pendente, sem referencias locais no payload do servidor.
- Linha criada `RELATORIO_VISITAS!A2415:AD2415`; pasta de homologacao igual a do teste anterior.
- Indice de pendencias da Lorena sem registros pendentes na consulta. Isso nao substitui a verificacao de dados que existam somente em outros aparelhos.
- Piloto aprovado para esse aparelho e esse fluxo. Nao generalizar o resultado para todos os Androids nem afirmar eliminacao definitiva do aviso.
- Antes de liberar para a equipe: concluir coleta segura das fotos locais confirmadas, ativacao por aparelho no endereco oficial, plano de retorno compativel com referencias e tratamento das visitas antigas que ainda contenham base64.

## Roteiro no Moto G84

1. Usar Chrome no aparelho de teste, sem trocar o link de um aplicativo que tenha visitas/fila pendente. A producao continua no endereco oficial habitual.
2. Abrir https://6ae4ac537bda385b9deb0003--criativa-field-ops-574.netlify.app e entrar com `lorena.costa`, com a senha habitual, sem divulgar a senha no chat.
3. Conferir o aviso `Lite - Homologacao`. A lista deste build deve oferecer apenas `HOMOLOGACAO LITE - NAO OPERACIONAL` e a industria `HOMOLOGACAO LITE`.
4. Registrar fachada, uma foto de Antes e uma de Depois. Aguardar cada foto aparecer antes de prosseguir. Na etapa Trocas, responder Nao para esse ensaio.
5. Antes de finalizar, fechar e reabrir esse mesmo endereco. Conferir se a visita e as fotos continuam presentes.
6. Registrar a foto de saida e sincronizar. Aguardar o status do servidor; se houver erro, manter os dados e anotar o ID da visita. Nao limpar fila ou reinstalar.
7. Informar o ID da visita e se o aviso de memoria apareceu, indicando em qual etapa. A conclusao e os comprovantes serao conferidos no backend.

Este link e exclusivo do teste controlado, nao substitui o aplicativo da equipe. Nao e necessario instalar um segundo atalho para esta validacao. O registro real do teste aparece identificado na planilha e deve ser considerado homologacao, nao atendimento de loja.

## Validacao adicional em 30/10/2026

- Dois perfis persistentes isolados do Chrome receberam o mesmo conjunto sintetico de 100 fotos. O navegador foi fechado e iniciado de novo com a rede desativada; a PWA abriu pelo cache e recuperou as 100 fotos em ambos os casos, incluindo o conteudo da ultima foto.
- Rascunho serializado: 12.121.420 bytes no formato antigo e 5.247 bytes em referencias no Lite. Os arquivos de imagem continuam no armazenamento individual; nao foram eliminados nem comprimidos adicionalmente.
- Apos coleta de lixo solicitada pelo DevTools, `JSHeapUsedSize` foi 15.139.208 bytes no caso antigo e 3.011.100 bytes no Lite (cerca de 80% menos neste ensaio). Esta e uma medicao pontual de heap JavaScript no Chrome desktop, nao pico, memoria total do navegador nem medicao do Android da Keutily.
- Pela interface, uma captura foi salva, a pagina recarregada e a foto voltou a aparecer. A tentativa de envio com falha de rede preservou a fila; depois de nova recarga, o envio simulado concluiu com hash valido. Somente a resposta remota simulada `enviado` retirou a visita da fila. Nenhum backend real recebeu essas imagens.
- Teste adicional impede a finalizacao se a foto mudar entre o calculo inicial do hash e a segunda leitura.
- Remover a visita da fila nao exclui a foto individual nesta etapa; verificacao automatizada confirma a preservacao. A limpeza automatica continua pendente, nao foi considerada validada.
- Cadastro real consultado: nenhuma conta ou PDV identificado como teste/homologacao. Nao houve login com conta de promotora ativa, criacao de credenciais ou gravacao na planilha para contornar essa ausencia.
- Nao foi localizado ADB/Android SDK nesta maquina para testar um aparelho conectado. O ensaio de camera nativa e a validacao em Android continuam dependentes de aparelho de teste.
- Producao conferida apos os ensaios: mesmo deploy `6ae1f58c3c646eebc5f8d7a6`, health saudavel e provedor `google-v1`.
