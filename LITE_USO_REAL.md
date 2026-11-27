# Modo Lite no endereco oficial

Endereco: https://criativa-field-ops-574.netlify.app/

Modo Lite liberado em 30/10/2026. Correcao urgente publicada em 23/11/2026 as 13:56 de Brasilia: deploy `6b047037992fe12250e6b2a7`, bundle `index-Ctv3zdaR.js`.

A correcao protege rascunhos sem sessao, guarda rascunhos de donos diferentes, reduz a imagem antes do canvas em navegadores compativeis e evita copias integrais no envio de visitas grandes, incluindo as antigas. O modo escolhido no aparelho permanece. Fotos e visitas que ja estavam apagadas antes da atualizacao nao sao reconstruidas automaticamente.

1. Concluir a visita atual e aguardar a confirmacao dos envios pendentes.
2. Entrar no aplicativo habitual e abrir a engrenagem `Preferencias do aparelho` no topo.
3. Ativar `Modo Lite`. O aplicativo salva o estado e recarrega; a tela passa a indicar `Modo Lite`.
4. Continuar com as lojas e industrias reais. A escolha vale somente para esse aparelho/navegador e pode ser desativada nas mesmas preferencias quando nao houver visita nem fila.

Nao e necessario reinstalar, criar outro atalho, limpar dados ou trocar de endereco. A atualizacao da PWA aguarda o fechamento das telas abertas; nao interromper uma captura ou envio para atualizar.

## Preservacao

- O modo normal continua sendo o padrao. Nenhuma troca automatica ocorre em aparelhos que ja estao trabalhando.
- Novas capturas Lite usam armazenamento individual, referencias no rascunho/fila, uma imagem por pagina e envio sequencial em fragmentos. Qualidade e carimbo permanecem nos parametros existentes.
- As lojas, industrias e autenticacao sao as de producao. O catalogo sintetico do preview nao e usado no build normal.
- A mudanca de modo e recusada durante visita, processamento de foto ou fila pendente. Visitas antigas em base64 permanecem intactas, sem migracao automatica.
- Leitura e transporte de referencias continuam disponiveis mesmo ao desativar novas capturas Lite.
- A limpeza local so considera fotos de visitas que o servidor confirmou como enviadas, apos pelo menos 24 horas. Nao roda se houver fila ou evidencia de visita aberta no armazenamento.
- A limpeza usa Web Locks para coordenar as escritas locais. Sem esse recurso, preserva as fotos. Orfaos, arquivos sem confirmacao e fotos de outro dono sao preservados.
- A limpeza afeta somente o cofre local; nao remove arquivos do Drive nem linhas da planilha.

## Acompanhamento

Comecar pelos aparelhos com reclamacoes e acompanhar uma visita completa antes de ampliar a adesao. O piloto Moto G84 foi aprovado pelo usuario e confirmado no servidor; isso nao garante comportamento identico em todos os Androids.

Em caso de erro, preservar dados e informar ID da visita e etapa. Nao aplicar versao anterior ao suporte Lite sobre aparelhos com referencias locais pendentes.
