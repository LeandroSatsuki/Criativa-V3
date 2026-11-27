const fs = require('node:fs');
const path = require('node:path');

const [productionPath, homologPath, outputPath] = process.argv.slice(2);

if (!productionPath || !homologPath || !outputPath) {
  throw new Error(
    'Uso: node scripts/generate-make-production-folder-tree-v1.cjs '
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
const homologWebhook = homologModules.get(1);

if (productionWebhook?.module !== 'gateway:CustomWebHook') {
  throw new Error('Webhook raiz do blueprint produtivo nao foi encontrado.');
}
if (homologWebhook?.module !== 'gateway:CustomWebHook') {
  throw new Error('Webhook raiz do blueprint de homologacao nao foi encontrado.');
}

const requiredModules = [92, 93, 94, 95, 96, 97, 98, 99];
for (const id of requiredModules) {
  if (!homologModules.has(id)) throw new Error(`Modulo obrigatorio ausente: ${id}`);
}

for (const id of [71, 72, 73, 79]) {
  if (homologModules.has(id)) throw new Error(`Modulo antigo do lote ainda presente: ${id}`);
}

const productionDriveConnection = productionModules.get(2)?.parameters?.__IMTCONN__;
if (!productionDriveConnection) {
  throw new Error('Conexao de referencia do Google Drive nao foi encontrada na producao.');
}

for (const node of homologModules.values()) {
  if (node.module?.startsWith('google-drive:')
    && node.parameters?.__IMTCONN__
    && node.parameters.__IMTCONN__ !== productionDriveConnection) {
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
  requiredModulesPresent: requiredModules.every((id) => promotedModules.has(id)),
}));
