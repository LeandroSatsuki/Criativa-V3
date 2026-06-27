# Checklist do Projeto - Criativa Field Ops

Data da ultima auditoria: 2026-06-27

## Situacao atual

- [x] Estrutura do projeto mapeada.
- [x] Fluxo principal do frontend entendido.
- [x] Integracoes externas identificadas.
- [x] Riscos tecnicos registrados.
- [x] Riscos de seguranca registrados.
- [x] Build validado.
- [x] Typecheck validado.
- [x] Nenhuma alteracao visual foi feita nesta fase.
- [x] CHANGELOG criado e atualizado.

## Fase 1 - Configuracao e limpeza de exposicao

- [x] Segredos removidos do codigo-fonte.
- [x] Configuracao centralizada em `src/config/appConfig.ts`.
- [x] `vite.config.ts` sem exposicao de `process.env`.
- [x] `index.html` com titulo correto.
- [x] `.env.example` atualizado com variaveis reais do projeto.
- [x] `README.md` atualizado com orientacoes tecnicas.
- [x] Validacao local de build e runtime executada.

## Checklist da fase 0

- [x] Li os arquivos diretamente envolvidos.
- [x] Entendi o fluxo atual.
- [x] Identifiquei risco de regressao.
- [x] Defini escopo minimo da alteracao.
- [x] Nao alterei o visual.
- [x] Nao removi funcionalidade.
- [x] Nao deixei segredo novo no frontend.
- [x] Nao criei mock novo em producao.
- [x] Nao deixei codigo temporario.
- [x] Mantive nomes claros e consistentes.

## Validacoes executadas

- [x] `npm.cmd install`
- [x] `npm.cmd run lint`
- [x] `npm.cmd run build`
- [x] `npm.cmd run dev` com resposta `200` na raiz via smoke check local.

## Checklist manual do fluxo atual

- [ ] Login do promotor validado em navegador.
- [ ] Login do supervisor validado em navegador.
- [ ] Filtro de lojas por usuario validado em navegador.
- [ ] Check-in com foto da fachada validado em navegador.
- [ ] Etapa Antes com selecao de industria validada em navegador.
- [ ] Etapa Estoque com quantidades validada em navegador.
- [ ] Etapa Depois com analise de imagem validada em navegador.
- [ ] Etapa Trocas / avarias validada em navegador.
- [ ] Check-out com foto de saida validado em navegador.
- [ ] Sincronizacao com Make validada em navegador.
- [ ] Painel supervisor com dados reais validado em navegador.

## Checklist de risco para as proximas fases

- [ ] Remover exposicao de webhook no frontend.
- [ ] Remover exposicao de chave Gemini no frontend.
- [ ] Remover fallback de senha fixa `admin/admin`.
- [ ] Eliminar uso de `Math.random` em dashboard de producao.
- [ ] Definir persistencia real para visitas e status de sync.
- [ ] Implementar fila de reenvio confiavel.
- [ ] Validar permissao por papel e por rota.
- [ ] Garantir que o supervisor veja dados reais.
- [ ] Reduzir dependencia de `localStorage` como fonte unica.
- [ ] Revisar bundle grande e dividir quando necessario.

## Observacoes operacionais

- O ambiente local aceitou o projeto com build aprovado.
- O `npm.cmd install` reportou 8 vulnerabilidades no inventario de dependencias.
- O build ainda emite warning sobre chunk grande acima de 500 kB.
- A protecao completa das integracoes sensiveis continua como objetivo da Fase 2.
