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

- 163 testes aprovados; TypeScript e builds normal/Lite aprovados.
- 100 fotos sinteticas: rascunho leve, resolucao de uma foto por vez e transporte sequencial; integridade conferida com hash nativo Node.
- Interrupcao e retomada sem reenviar fragmentos confirmados, isolamento por dono, foto ausente e transacao de gravacao abortada.
- Comparacao dos eventos de foto e finalizacao Google: mesmos dados, IDs e destinos logicos para conteudo igual.
- Chrome com backend simulado: captura, gravacao individual, recarga da pagina, exibicao, finalizacao com hash valido e ausencia de chamada IA.
- Build normal: abertura com 100 fotos e tres filas antigas, rascunho legado, login vazio e falha de conexao.
- Os testes nao criaram fotos ou visitas reais no Drive/planilha.
