const fs = require('node:fs');
const path = require('node:path');

const [productionPath, homologPath, outputPath] = process.argv.slice(2);

if (!productionPath || !homologPath || !outputPath) {
  throw new Error(
    'Uso: node scripts/generate-make-production-direct-parent-v2.cjs '
      + '<producao.json> <homologacao.json> <saida.json>',
  );
}

const readBlueprint = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const production = readBlueprint(productionPath);
const homolog = readBlueprint(homologPath);

const collectModules = (flow, modules = new Map()) => {
  for (const node of flow || []) {
    if (modules.has(node.id)) {
      throw new Error(`Modulo duplicado no blueprint: ${node.id}`);
    }
    modules.set(node.id, node);
    for (const route of node.routes || []) collectModules(route.flow, modules);
  }
  return modules;
};

const productionModules = collectModules(production.flow);
const homologModules = collectModules(homolog.flow);
const productionWebhook = productionModules.get(1);

if (productionWebhook?.module !== 'gateway:CustomWebHook') {
  throw new Error('Webhook raiz do blueprint produtivo nao foi encontrado.');
}
if (homologModules.get(1)?.module !== 'gateway:CustomWebHook') {
  throw new Error('Webhook raiz do blueprint de homologacao nao foi encontrado.');
}

for (const id of [92, 93, 94, 95, 96, 97, 98, 99]) {
  if (!homologModules.has(id)) throw new Error(`Modulo obrigatorio ausente: ${id}`);
}

for (const id of [71, 72, 73, 79, 90, 91]) {
  if (homologModules.has(id)) throw new Error(`Modulo obsoleto ainda presente: ${id}`);
}

const normalBody = homologModules.get(85)?.mapper?.body || '';
const returnsBody = homologModules.get(88)?.mapper?.body || '';
if (!normalBody.includes('"parents":["{{97.body.id}}"]')) {
  throw new Error('Arquivo normal nao nasce diretamente dentro do PDV.');
}
if (!returnsBody.includes('"parents":["{{99.body.id}}"]')) {
  throw new Error('Devolucao nao nasce diretamente dentro de DEVOLUCOES.');
}
if (homologModules.get(77)?.mapper?.fileId !== '{{85.body.id}}') {
  throw new Error('Comprovante normal nao usa o arquivo criado no PDV.');
}
if (homologModules.get(82)?.mapper?.fileId !== '{{88.body.id}}') {
  throw new Error('Comprovante de devolucao nao usa o arquivo criado na pasta.');
}

const productionDriveConnection = productionModules.get(2)?.parameters?.__IMTCONN__;
if (!productionDriveConnection) {
  throw new Error('Conexao de referencia do Google Drive nao foi encontrada.');
}

for (const node of homologModules.values()) {
  if (
    node.module?.startsWith('google-drive:')
    && node.parameters?.__IMTCONN__
    && node.parameters.__IMTCONN__ !== productionDriveConnection
  ) {
    throw new Error(`Conexao divergente no modulo Google Drive ${node.id}.`);
  }
}

const promoted = structuredClone(homolog);
promoted.name = production.name;
promoted.flow = promoted.flow.map((node) => (
  node.id === 1 ? structuredClone(productionWebhook) : node
));

const promotedModules = collectModules(promoted.flow);
if (JSON.stringify(promotedModules.get(1)) !== JSON.stringify(productionWebhook)) {
  throw new Error('O webhook produtivo nao foi preservado integralmente.');
}

fs.writeFileSync(outputPath, `${JSON.stringify(promoted, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  output: path.resolve(outputPath),
  modules: promotedModules.size,
  productionWebhookPreserved: true,
  moveModulesRemoved: !promotedModules.has(90) && !promotedModules.has(91),
  directParentsValidated: true,
}));
