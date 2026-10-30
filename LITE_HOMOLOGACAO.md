# Piloto Lite

Status: implementacao inicial em homologacao. Nao liberar para a operacao.

Preview tecnico: `6ae4a1fbdabad6722181e5c3`, bundle `index-sfvEe8Lr.js`.
Conferido apos publicacao: login e PWA sem erro JavaScript; 20 funcoes e health Google. O deploy oficial permaneceu `6ae1f58c3c646eebc5f8d7a6`, saudavel em `google-v1`.

## Ativacao

- Branch `agent/lite-homologacao`.
- Build com `VITE_LITE_PILOT=true`; sem essa variavel, novas capturas seguem o modo normal.
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

- Nao usar conta de promotora ativa no preview: o backend compartilha sessoes e dados com producao. Uma conta de teste dedicada deve ser definida antes do ensaio real no Drive.
- Dados locais sao separados por origem. Nao orientar Keutily a trocar de link, reinstalar ou limpar dados com visita/fila pendente.
- Ainda falta testar camera real e retorno apos encerramento do navegador no Android afetado, alem do envio real ate Drive/planilha com a conta de teste.
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
- Os testes nao criaram fotos ou visitas reais no Drive/planilha.

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
