const fs = require('fs');
const path = require('path');

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error(
    'Usage: node scripts/generate-make-homolog-folder-tree-v3.cjs <source> <output>',
  );
}

const source = JSON.parse(fs.readFileSync(path.resolve(sourcePath), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

const findModule = (value, id, moduleName) => {
  if (!value || typeof value !== 'object') return null;
  if (
    !Array.isArray(value)
    && value.id === id
    && (!moduleName || value.module === moduleName)
  ) {
    return value;
  }
  for (const child of Object.values(value)) {
    const found = findModule(child, id, moduleName);
    if (found) return found;
  }
  return null;
};

const mapStrings = (value, replacer) => {
  if (typeof value === 'string') return replacer(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, replacer));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, mapStrings(item, replacer)]),
  );
};

const batchRouter = findModule(source, 74, 'builtin:BasicRouter');
const batchIndustrySearch = findModule(source, 71, 'google-drive:searchForFilesFolders');
const apiTemplate = findModule(source, 84, 'google-drive:makeApiCall');

if (!batchRouter || !batchIndustrySearch || !apiTemplate) {
  throw new Error('Required batch modules were not found.');
}

const rootFolderId = String(batchIndustrySearch.mapper.folderId || '')
  .split('/')
  .filter(Boolean)
  .at(-1);

if (!rootFolderId) throw new Error('Drive root folder ID was not found.');

const makeFolderSearch = ({ id, parentId, field, x, name, filter }) => {
  const module = clone(apiTemplate);
  module.id = id;
  module.mapper = {
    url: '/v3/files',
    method: 'GET',
    headers: [],
    qs: [
      {
        key: 'q',
        value: `'${parentId}' in parents and name='{{1.${field}}}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      },
      { key: 'pageSize', value: '1' },
      { key: 'fields', value: 'files(id,name,parents)' },
    ],
    body: '',
  };
  module.metadata = { designer: { x, y: 2200, name } };
  if (filter) module.filter = filter;
  else delete module.filter;
  return module;
};

const makeFolderGetOrCreate = ({ id, searchId, parentId, field, x, name }) => {
  const module = clone(apiTemplate);
  const exists = `length(${searchId}.body.files) > 0`;
  const existingId = `first(map(${searchId}.body.files; "id"))`;
  module.id = id;
  module.mapper = {
    url: `{{if(${exists}; "/v3/files/"; "/v3/files")}}{{if(${exists}; ${existingId}; "")}}`,
    method: `{{if(${exists}; "GET"; "POST")}}`,
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    qs: [{ key: 'fields', value: 'id,name,parents' }],
    body: `{"name":"{{1.${field}}}","mimeType":"application/vnd.google-apps.folder","parents":["${parentId}"]}`,
  };
  module.metadata = { designer: { x, y: 2200, name } };
  delete module.filter;
  return module;
};

const industryFilter = clone(batchIndustrySearch.filter);
const folderModules = [
  makeFolderSearch({
    id: 92,
    parentId: rootFolderId,
    field: 'PASTA_INDUSTRIA_NOME',
    x: 300,
    name: 'Lote - pesquisar industria',
    filter: industryFilter,
  }),
  makeFolderGetOrCreate({
    id: 93,
    searchId: 92,
    parentId: rootFolderId,
    field: 'PASTA_INDUSTRIA_NOME',
    x: 600,
    name: 'Lote - obter ou criar industria',
  }),
  makeFolderSearch({
    id: 94,
    parentId: '{{93.body.id}}',
    field: 'PASTA_VISITA_NOME',
    x: 900,
    name: 'Lote - pesquisar data',
  }),
  makeFolderGetOrCreate({
    id: 95,
    searchId: 94,
    parentId: '{{93.body.id}}',
    field: 'PASTA_VISITA_NOME',
    x: 1200,
    name: 'Lote - obter ou criar data',
  }),
  makeFolderSearch({
    id: 96,
    parentId: '{{95.body.id}}',
    field: 'PASTA_PDV_NOME',
    x: 1500,
    name: 'Lote - pesquisar PDV',
  }),
  makeFolderGetOrCreate({
    id: 97,
    searchId: 96,
    parentId: '{{95.body.id}}',
    field: 'PASTA_PDV_NOME',
    x: 1800,
    name: 'Lote - obter ou criar PDV',
  }),
];

const normalRoute = batchRouter.routes[0]?.flow;
const returnsRoute = batchRouter.routes[1]?.flow;
if (!normalRoute || !returnsRoute) throw new Error('Batch destination routes were not found.');

const replaceNormalFolder = (value) => value.replaceAll('73.id', '97.body.id');
batchRouter.routes[0].flow = mapStrings(normalRoute, replaceNormalFolder);

const returnsFilter = clone(findModule(source, 79, 'google-drive:searchForFilesFolders')?.filter);
if (!returnsFilter) throw new Error('Returns route filter was not found.');

const returnsFolders = [
  makeFolderSearch({
    id: 98,
    parentId: '{{97.body.id}}',
    field: 'PASTA_SUBPASTA_NOME',
    x: 2100,
    name: 'Lote - pesquisar DEVOLUCOES',
    filter: returnsFilter,
  }),
  makeFolderGetOrCreate({
    id: 99,
    searchId: 98,
    parentId: '{{97.body.id}}',
    field: 'PASTA_SUBPASTA_NOME',
    x: 2400,
    name: 'Lote - obter ou criar DEVOLUCOES',
  }),
];

const returnFlowWithoutOldSearch = returnsRoute.filter((module) => module.id !== 79);
batchRouter.routes[1].flow = [
  ...returnsFolders,
  ...mapStrings(returnFlowWithoutOldSearch, (value) => value
    .replaceAll('79.id', '99.body.id')
    .replaceAll('73.id', '97.body.id')),
];

const topRouter = findModule(source, 30, 'builtin:BasicRouter');
const batchRoute = topRouter?.routes?.find((route) => route.flow?.some((module) => module.id === 71));
if (!batchRoute) throw new Error('Top-level batch route was not found.');

batchRoute.flow = [
  ...folderModules,
  batchRouter,
];

fs.writeFileSync(path.resolve(outputPath), JSON.stringify(source, null, 2));
console.log(`Generated ${path.resolve(outputPath)} with an idempotent folder tree.`);
