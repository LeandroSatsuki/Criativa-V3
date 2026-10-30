const fs = require('fs');
const path = require('path');

const [sourcePath, templatePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !templatePath || !outputPath) {
  throw new Error(
    'Usage: node scripts/generate-make-homolog-idempotent-v2.cjs <source> <template> <output>',
  );
}

const readBlueprint = (filePath) =>
  JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));

const clone = (value) => JSON.parse(JSON.stringify(value));

const findModule = (value, id, moduleName) => {
  if (!value || typeof value !== 'object') return null;

  if (
    !Array.isArray(value) &&
    value.id === id &&
    (!moduleName || value.module === moduleName)
  ) {
    return value;
  }

  for (const child of Object.values(value)) {
    const found = findModule(child, id, moduleName);
    if (found) return found;
  }

  return null;
};

const collectModuleIds = (value, ids = []) => {
  if (!value || typeof value !== 'object') return ids;
  if (!Array.isArray(value) && Number.isInteger(value.id) && value.module) {
    ids.push(value.id);
  }
  for (const child of Object.values(value)) collectModuleIds(child, ids);
  return ids;
};

const source = readBlueprint(sourcePath);
const templates = readBlueprint(templatePath);
const batchRouter = findModule(source, 74, 'builtin:BasicRouter');
const apiTemplate = findModule(templates, 86, 'google-drive:makeApiCall');
const updateTemplate = findModule(templates, 88, 'google-drive:updateAFile');

if (!batchRouter || !apiTemplate?.mapper || !updateTemplate?.mapper) {
  throw new Error('Required Make module templates were not found.');
}

const makeApiSearchModule = ({ id, iteratorId, folderId, x, y, name }) => {
  const module = clone(apiTemplate);
  module.id = id;
  module.mapper = {
    url: '/v3/files',
    method: 'GET',
    headers: [],
    qs: [
      {
        key: 'q',
        value: `'{{${folderId}}}' in parents and name='{{${iteratorId}.NOME_ARQUIVO}}' and trashed=false`,
      },
      { key: 'pageSize', value: '1' },
      { key: 'fields', value: 'files(id,name)' },
    ],
    body: '',
  };
  module.metadata = { designer: { x, y, name } };
  return module;
};

const makeApiModule = ({
  id,
  searchId,
  x,
  y,
  name,
}) => {
  const module = clone(apiTemplate);
  module.id = id;
  const exists = `length(${searchId}.body.files) > 0`;
  const existingId = `first(map(${searchId}.body.files; "id"))`;
  module.mapper = {
    url: `{{if(${exists}; "/v3/files/"; "/v3/files")}}{{if(${exists}; ${existingId}; "")}}`,
    method: `{{if(${exists}; "GET"; "POST")}}`,
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    qs: [{ key: 'fields', value: 'id,name,parents' }],
    body: '{}',
  };
  module.metadata = { designer: { x, y, name } };
  return module;
};

const makeUpdateModule = ({
  id,
  apiId,
  iteratorId,
  x,
  y,
  name,
}) => {
  const module = clone(updateTemplate);
  module.id = id;
  module.mapper = {
    select: 'map',
    changeContent: true,
    file: `{{${apiId}.body.id}}`,
    filename: `{{${iteratorId}.NOME_ARQUIVO}}`,
    data: `{{toBinary(${iteratorId}.FOTO_BASE64; "base64")}}`,
  };
  module.metadata = { designer: { x, y, name } };
  return module;
};

const makeMoveModule = ({ id, apiId, folderId, x, y, name }) => {
  const module = clone(apiTemplate);
  module.id = id;
  module.mapper = {
    url: `/v3/files/{{${apiId}.body.id}}`,
    method: 'PATCH',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    qs: [
      { key: 'addParents', value: `{{${folderId}}}` },
      {
        key: 'removeParents',
        value: `{{if(first(${apiId}.body.parents) = ${folderId}; ""; first(${apiId}.body.parents))}}`,
      },
      { key: 'fields', value: 'id,name,parents' },
    ],
    body: '{}',
  };
  module.metadata = { designer: { x, y, name } };
  return module;
};

const normalRoute = batchRouter.routes[0]?.flow;
const returnsRoute = batchRouter.routes[1]?.flow;

if (!normalRoute || !returnsRoute) {
  throw new Error('Batch routes were not found in the source blueprint.');
}

const iteratorNormal = clone(findModule(normalRoute, 75, 'builtin:BasicFeeder'));
const aggregatorNormal = clone(
  findModule(normalRoute, 77, 'builtin:BasicAggregator'),
);
const responseNormal = clone(
  findModule(normalRoute, 78, 'gateway:WebhookRespond'),
);
const findReturnsFolder = clone(
  findModule(returnsRoute, 79, 'google-drive:searchForFilesFolders'),
);
const iteratorReturns = clone(findModule(returnsRoute, 80, 'builtin:BasicFeeder'));
const aggregatorReturns = clone(
  findModule(returnsRoute, 82, 'builtin:BasicAggregator'),
);
const responseReturns = clone(
  findModule(returnsRoute, 83, 'gateway:WebhookRespond'),
);

if (
  !iteratorNormal ||
  !aggregatorNormal ||
  !responseNormal ||
  !findReturnsFolder ||
  !iteratorReturns ||
  !aggregatorReturns ||
  !responseReturns
) {
  throw new Error('One or more original batch modules were not found.');
}

iteratorNormal.metadata.designer.x = 1800;
aggregatorNormal.metadata.designer.x = 3300;
aggregatorNormal.mapper.fileId = '{{90.body.id}}';
aggregatorNormal.mapper.fileUrl =
  'https://drive.google.com/file/d/{{90.body.id}}/view';
responseNormal.metadata.designer.x = 3600;

findReturnsFolder.metadata.designer.x = 1800;
iteratorReturns.metadata.designer.x = 2100;
aggregatorReturns.metadata.designer.x = 3600;
aggregatorReturns.mapper.fileId = '{{91.body.id}}';
aggregatorReturns.mapper.fileUrl =
  'https://drive.google.com/file/d/{{91.body.id}}/view';
responseReturns.metadata.designer.x = 3900;

batchRouter.routes[0].flow = [
  iteratorNormal,
  makeApiSearchModule({
    id: 84,
    iteratorId: 75,
    folderId: '73.id',
    x: 2100,
    y: 2050,
    name: 'Lote - localizar foto existente',
  }),
  makeApiModule({
    id: 85,
    searchId: 84,
    x: 2400,
    y: 2050,
    name: 'Lote - obter ou criar arquivo',
  }),
  makeUpdateModule({
    id: 86,
    apiId: 85,
    iteratorId: 75,
    x: 2700,
    y: 2050,
    name: 'Lote - gravar conteudo da foto',
  }),
  makeMoveModule({
    id: 90,
    apiId: 85,
    folderId: '73.id',
    x: 3000,
    y: 2050,
    name: 'Lote - garantir pasta da foto',
  }),
  aggregatorNormal,
  responseNormal,
];

batchRouter.routes[1].flow = [
  findReturnsFolder,
  iteratorReturns,
  makeApiSearchModule({
    id: 87,
    iteratorId: 80,
    folderId: '79.id',
    x: 2400,
    y: 2350,
    name: 'Lote - localizar devolucao existente',
  }),
  makeApiModule({
    id: 88,
    searchId: 87,
    x: 2700,
    y: 2350,
    name: 'Lote - obter ou criar devolucao',
  }),
  makeUpdateModule({
    id: 89,
    apiId: 88,
    iteratorId: 80,
    x: 3000,
    y: 2350,
    name: 'Lote - gravar conteudo da devolucao',
  }),
  makeMoveModule({
    id: 91,
    apiId: 88,
    folderId: '79.id',
    x: 3300,
    y: 2350,
    name: 'Lote - garantir pasta da devolucao',
  }),
  aggregatorReturns,
  responseReturns,
];

const ids = collectModuleIds(source);
if (new Set(ids).size !== ids.length) {
  throw new Error('The generated blueprint contains duplicate module IDs.');
}

const expectedNormal = [75, 84, 85, 86, 90, 77, 78];
const expectedReturns = [79, 80, 87, 88, 89, 91, 82, 83];
const actualNormal = batchRouter.routes[0].flow.map((module) => module.id);
const actualReturns = batchRouter.routes[1].flow.map((module) => module.id);

if (
  JSON.stringify(actualNormal) !== JSON.stringify(expectedNormal) ||
  JSON.stringify(actualReturns) !== JSON.stringify(expectedReturns)
) {
  throw new Error('The generated batch routes are not linear.');
}

fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(source, null, 2)}\n`);
console.log(
  JSON.stringify({ output: path.resolve(outputPath), actualNormal, actualReturns }),
);
