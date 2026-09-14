const fs = require('node:fs');
const path = require('node:path');

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error(
    'Uso: node scripts/generate-make-homolog-direct-parent-v4.cjs '
      + '<origem.json> <saida.json>',
  );
}

const blueprint = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'));

const findModule = (flow, id) => {
  for (const node of flow || []) {
    if (node.id === id) return node;
    for (const route of node.routes || []) {
      const found = findModule(route.flow, id);
      if (found) return found;
    }
  }
  return null;
};

const findRouteContaining = (flow, id) => {
  for (const node of flow || []) {
    for (const route of node.routes || []) {
      if (route.flow?.some((item) => item.id === id)) return route;
      const found = findRouteContaining(route.flow, id);
      if (found) return found;
    }
  }
  return null;
};

const normalCreate = findModule(blueprint.flow, 85);
const returnCreate = findModule(blueprint.flow, 88);
const normalAggregator = findModule(blueprint.flow, 77);
const returnAggregator = findModule(blueprint.flow, 82);
const normalRoute = findRouteContaining(blueprint.flow, 90);
const returnRoute = findRouteContaining(blueprint.flow, 91);

if (
  normalCreate?.module !== 'google-drive:makeApiCall'
  || returnCreate?.module !== 'google-drive:makeApiCall'
  || normalAggregator?.module !== 'builtin:BasicAggregator'
  || returnAggregator?.module !== 'builtin:BasicAggregator'
  || !normalRoute
  || !returnRoute
) {
  throw new Error('Os modulos esperados da rota idempotente nao foram encontrados.');
}

normalCreate.mapper.body = '{"name":"{{75.NOME_ARQUIVO}}","parents":["{{97.body.id}}"]}';
normalCreate.metadata.designer.name = 'Lote - obter ou criar arquivo no PDV';

returnCreate.mapper.body = '{"name":"{{80.NOME_ARQUIVO}}","parents":["{{99.body.id}}"]}';
returnCreate.metadata.designer.name = 'Lote - obter ou criar devolucao na pasta';

normalRoute.flow = normalRoute.flow.filter((node) => node.id !== 90);
returnRoute.flow = returnRoute.flow.filter((node) => node.id !== 91);

normalAggregator.mapper.fileId = '{{85.body.id}}';
normalAggregator.mapper.fileUrl = 'https://drive.google.com/file/d/{{85.body.id}}/view';
normalAggregator.metadata.designer.x = 3000;

returnAggregator.mapper.fileId = '{{88.body.id}}';
returnAggregator.mapper.fileUrl = 'https://drive.google.com/file/d/{{88.body.id}}/view';
returnAggregator.metadata.designer.x = 3300;

const normalResponse = findModule(blueprint.flow, 78);
const returnResponse = findModule(blueprint.flow, 83);
if (!normalResponse || !returnResponse) {
  throw new Error('As confirmacoes HTTP do lote nao foram encontradas.');
}
normalResponse.metadata.designer.x = 3300;
returnResponse.metadata.designer.x = 3600;

for (const id of [92, 93, 94, 95, 96, 97, 98, 99]) {
  if (!findModule(blueprint.flow, id)) {
    throw new Error(`A estrutura de pastas perdeu o modulo obrigatorio ${id}.`);
  }
}

for (const id of [90, 91]) {
  if (findModule(blueprint.flow, id)) {
    throw new Error(`O modulo de movimentacao ${id} ainda esta presente.`);
  }
}

fs.writeFileSync(
  path.resolve(outputPath),
  `${JSON.stringify(blueprint, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify({
  output: path.resolve(outputPath),
  normalParent: '{{97.body.id}}',
  returnsParent: '{{99.body.id}}',
  moveModulesRemoved: [90, 91],
  confirmationsPreserved: [78, 83],
}));
