# Arquitetura alvo - Criativa Field Ops

Este documento define o caminho recomendado para evoluir o Criativa Field Ops com seguranca, baixo risco e preservando o progresso ja entregue.

## Decisao principal

A recomendacao e manter um unico produto com duas experiencias:

- Promotor: usa no celular como PWA instalada, com fluxo de campo e suporte offline.
- Supervisor: usa no navegador, com dashboard, relatorios e acompanhamento operacional.
- Backend: centraliza autenticacao, permissoes, persistencia, integracoes e auditoria.

Essa abordagem evita duplicar codigo, preserva o frontend atual e permite evoluir com etapas pequenas.

## O que permanece agora

- Frontend React + Vite + TypeScript.
- Visual atual do app.
- Deploy atual no Netlify.
- Netlify Functions como backend seguro.
- Login e papeis atuais de `FIELD_OPS` e `SUPERVISOR`.
- Google Sheets como fonte inicial de cadastros.
- Make.com protegido pelo backend.
- Gemini protegido pelo backend e opcional.
- Fila local e retry ja implementados.

## Modelo operacional

### Promotor

- Acessa pelo celular.
- Instala o app como PWA quando habilitado.
- Faz login com usuario individual.
- Visualiza apenas lojas permitidas.
- Executa check-in, fotos, antes, estoque, depois, trocas e check-out.
- Mantem dados locais quando estiver sem conexao.
- Sincroniza quando a rede voltar.

### Supervisor

- Acessa pelo navegador.
- Entra com perfil `SUPERVISOR`.
- Consulta painel, promotores, status, produtividade e pendencias.
- Nao executa fluxo de visita como promotor, exceto se houver regra futura explicita.

### Backend

- Valida credenciais.
- Emite sessao assinada.
- Aplica permissao por papel.
- Protege segredos de Google Sheets, Make e Gemini.
- Persiste visitas e status de sincronizacao.
- Serve dados reais para relatorios.

## Arquitetura tecnica recomendada

```text
Celular do promotor / Navegador do supervisor
        |
        v
Frontend React + Vite
        |
        v
/api/* em Netlify Functions
        |
        +-- Google Sheets: cadastros iniciais
        +-- Netlify Blobs: persistencia operacional atual
        +-- Make.com: destino de sincronizacao
        +-- Gemini: analise de imagem opcional
```

## Evolucao recomendada

### Etapa A - PWA instalavel

Objetivo: permitir que o promotor instale o app no celular sem loja de aplicativos.

Status: implementada no frontend, pendente de validacao em celular real.

Escopo seguro:

- adicionar `manifest.webmanifest`;
- adicionar icones do app;
- adicionar service worker simples;
- cachear apenas assets estaticos;
- manter chamadas `/api/*` sempre online ou com fallback controlado;
- nao alterar visual nem fluxo de visita.

Validacao:

- app abre no celular;
- instalacao aparece no navegador;
- login continua funcionando;
- visita continua usando fila local;
- build continua passando.

### Etapa B - Sessao e autenticacao mais fortes

Objetivo: reduzir risco de acesso indevido.

Escopo recomendado:

- revisar expiracao de sessao;
- avaliar cookie `httpOnly` para sessao web;
- rate limit no login;
- registrar tentativas invalidas;
- remover acessos provisorios quando nao forem mais necessarios.

### Etapa C - Fotos em storage dedicado

Objetivo: evitar payloads grandes em base64 dentro da visita.

Escopo recomendado:

- enviar fotos para storage pelo backend;
- salvar URLs ou referencias assinadas na visita;
- validar tamanho, tipo e quantidade;
- manter compatibilidade com payload atual da Make.

### Etapa D - Banco operacional

Objetivo: transformar as visitas em dados consultaveis e auditaveis.

Opcao recomendada para avaliar: Supabase/Postgres free tier.

Motivo:

- custo inicial baixo;
- SQL para relatorios;
- auditoria melhor que planilha;
- permissao e historico mais previsiveis.

Google Sheets deve continuar apenas como cadastro inicial ou apoio, salvo decisao explicita.

### Etapa E - Relatorios supervisor

Objetivo: transformar o dashboard em ferramenta operacional real.

Escopo recomendado:

- filtros por data, promotor, loja, regiao e status;
- exportacao controlada;
- indicadores vindos do banco;
- pendencias de sync e visitas incompletas;
- logs de erro visiveis para suporte.

### Etapa F - App nativo somente se necessario

Capacitor ou app nativo devem ser considerados apenas se a PWA nao atender a necessidades como:

- controle profundo de camera;
- notificacoes push avancadas;
- politica corporativa de instalacao;
- operacao offline muito pesada;
- MDM ou distribuicao interna obrigatoria.

## Controles de seguranca obrigatorios

- Nenhum segredo no frontend.
- Nenhuma URL sensivel hardcoded no cliente.
- Toda rota operacional exige autenticacao.
- Toda permissao e conferida no backend.
- Promotor nao acessa dados de outros promotores.
- Supervisor nao recebe chaves, webhooks ou tokens.
- Falha de sync nao apaga visita.
- Logs nao devem conter senha, token, hash completo ou foto sensivel.
- Acesso provisorio deve ter expiracao e remocao planejada.

## Itens que nao devem ser trocados sem decisao explicita

- Trocar Netlify por outra plataforma.
- Migrar Google Sheets para banco como uma mudanca unica grande.
- Transformar PWA em app nativo.
- Reescrever frontend.
- Alterar visual principal.
- Remover compatibilidade com Make.com.

## Ordem segura para proximas implementacoes

1. Validar PWA em um celular real de promotor.
2. Fortalecer sessao e login.
3. Separar storage de fotos.
4. Avaliar e implementar banco operacional.
5. Expandir relatorios do supervisor.
6. Considerar app nativo apenas se a PWA nao atender.

## Criterio de decisao

Cada proxima etapa deve responder:

- reduz risco operacional?
- preserva o fluxo atual?
- nao expoe segredos?
- pode ser testada isoladamente?
- pode ser revertida sem perda de dados?
- melhora o uso real do promotor ou do supervisor?

Se a resposta for negativa ou incerta, a etapa deve ser registrada como pendencia e nao executada automaticamente.
