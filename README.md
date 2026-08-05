# Criativa Field Ops

<p align="center">
  PWA para digitalizar visitas de campo, coleta de evidências e acompanhamento operacional de equipes de trade marketing.
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="PWA" src="https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white">
  <img alt="Netlify" src="https://img.shields.io/badge/Netlify_Functions-00C7B7?style=flat-square&logo=netlify&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-em_operação-2E8B57?style=flat-square">
</p>

## Sobre o projeto

Criativa Field Ops é uma aplicação desenvolvida para apoiar a operação de campo da Criativa. Promotores utilizam o celular para registrar visitas, responder etapas operacionais e coletar fotos; supervisores acompanham produtividade, andamento e pendências pelo navegador.

O projeto foi desenhado para um cenário em que a conexão pode oscilar durante a visita. Rascunhos e envios ficam protegidos localmente, permitindo continuar o trabalho e sincronizar os dados quando a rede estiver disponível.

## Problemas resolvidos

- substituição de registros operacionais dispersos por um fluxo guiado;
- continuidade da coleta em locais com conexão instável;
- compressão de imagens antes do armazenamento e envio;
- acompanhamento do progresso de sincronização sem bloquear o promotor;
- separação de permissões entre equipe de campo e supervisão;
- organização automática de fotos e dados por visita;
- proteção de credenciais e integrações no backend.

## Funcionalidades

### Promotor

- autenticação individual e acesso apenas às lojas permitidas;
- seleção da unidade e execução orientada da visita;
- check-in, fotos, estoque, trocas e check-out;
- retomada da etapa salva após interrupção ou nova autenticação;
- funcionamento como PWA instalável no celular;
- fila offline persistente com reenvio e indicação de progresso.

### Supervisor

- painel de acompanhamento operacional;
- visão por promotor, visita, status e pendência;
- leitura de produtividade e situação das sincronizações;
- acesso separado do fluxo executado pela equipe de campo.

### Plataforma

- compressão adaptativa e marcação das fotos no dispositivo;
- upload fragmentado para visitas com payload grande;
- sincronização em background após a persistência da visita;
- armazenamento operacional em Netlify Blobs;
- integração com Google Sheets e Make;
- análise opcional de imagens com Gemini pelo backend;
- modo legado disponível somente para rollback controlado.

## Arquitetura

```text
Promotor (PWA) / Supervisor (Web)
                 │
                 ▼
       React + TypeScript + Vite
                 │
                 ▼
        /api/* — Netlify Functions
          │        │        │
          ▼        ▼        ▼
   Netlify Blobs  Make  Google Sheets
          │
          └──────────► Gemini (opcional)
```

No navegador, `IndexedDB` preserva rascunhos e a fila de sincronização. O service worker mantém apenas o shell da aplicação e os recursos estáticos; chamadas operacionais para `/api/*` não são armazenadas em cache.

## Tecnologias

- React 19, TypeScript, Vite e Tailwind CSS;
- PWA com manifest e service worker;
- Netlify Functions e Netlify Blobs;
- IndexedDB e armazenamento local controlado;
- Make e Google Sheets;
- Gemini para análise opcional de imagens;
- Node.js Test Runner para testes automatizados.

## Executar localmente

### Requisitos

- Node.js 20 ou superior;
- Netlify CLI para testar frontend e funções em conjunto.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Para executar também as funções serverless:

```bash
npm run dev:full
```

O frontend fica disponível em `http://localhost:3000` e as rotas do backend são expostas em `/api/*`.

## Qualidade

```bash
npm run lint
npm test
npm run build
```

Os testes cobrem o contrato de sincronização, isolamento da fila por usuário, cache de configuração, regras do supervisor, payload das visitas e compressão de imagens.

## Segurança e privacidade

- segredos e webhooks permanecem somente no backend;
- nenhuma chave sensível deve ser incluída em variáveis `VITE_*`;
- toda rota operacional aplica autenticação e autorização;
- rascunhos são vinculados ao usuário que iniciou a visita;
- falhas de sincronização não apagam a coleta local;
- logs não devem registrar senhas, tokens ou conteúdo integral das fotos.

## Documentação

- [Manual de uso](./MANUAL_DE_USO.md)
- [Manual técnico](./MANUAL_TECNICO.md)
- [Arquitetura e evolução](./ARQUITETURA_ALVO.md)
- [Metodologia PWA offline](./METODOLOGIA_PWA_OFFLINE.md)
- [Diagnóstico de envio de fotos](./DIAGNOSTICO_ENVIO_FOTOS.md)
- [Changelog](./CHANGELOG.md)
- [Backlog técnico](./BACKLOG_TECNICO.md)

## Estado atual

A aplicação está publicada e o fluxo de campo e supervisão foi validado no ambiente operacional. A evolução prevista inclui fortalecimento de sessão, storage dedicado para fotos, banco relacional para relatórios e ampliação dos indicadores de supervisão.

## Autor e contexto

Projeto desenvolvido e mantido para a operação da **Criativa**, com participação de [Leandro Santos](https://github.com/LeandroSatsuki) na evolução técnica, automação e manutenção da solução.
