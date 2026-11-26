// Read-only browser smoke with a synthetic supervisor and local route fixtures.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const origin = process.argv[3];
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const user={id:'test-supervisor',user:'test-supervisor',name:'Supervisão local',role:'SUPERVISOR'};
  await page.addInitScript(user=>localStorage.setItem('criativa_session',JSON.stringify({user,token:'fixture-only',issuedAt:new Date().toISOString()})),user);
  const event={at:Date.now(),id:'test-camera',mode:'lite',section:'ANTES',build:'index-test.js',opened:true,result:'saved'};
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url()); assert.equal(url.origin,origin);
    if(!url.pathname.startsWith('/api/')) return route.continue();
    const row={owner:'fixture',saved:2,attempts:4,failures:2,denied:0,cancelled:1,last:event,liteBefore:2,lastLiteBefore:event.at,lastFailure:{...event,result:'write_error'},alerts:['DEPOIS']};
    const promoter={id:'fixture',name:'Naamã de Teste',user:'fixture',region:'Teste',phone:'',registered:true,registrationStatus:'ATIVO',status:'SEM ATIVIDADE',visits:{completed:0,total:0},todayVisits:{completed:0,total:0,pending:0,recorded:0,extra:0,duplicates:0}};
    const fixtures={'/api/config':{industries:['Teste'],timestamp:new Date().toISOString()},'/api/stores':[],
      '/api/auth/session':{user,token:'fixture-only'},'/api/supervisor/dashboard':{summary:{},timeline:[],promoters:[promoter],lastUpdated:new Date().toISOString()},
      '/api/camera/monitor':{asOf:Date.now(),rows:[row],clusters:[{build:'index-test.js',result:'timeout',count:3}]}};
    assert.ok(url.pathname in fixtures,url.pathname);
    await route.fulfill({json:fixtures[url.pathname]});
  });
  await page.goto(origin);
  await page.getByText(/3 promotores em 30 min/).waitFor();
  await page.getByText(/Naamã de Teste · falhas repetidas/).waitFor();
  await page.getByText('Consultar capturas por promotor').click();
  await page.getByRole('searchbox',{name:'Nome do promotor'}).fill('naama');
  await page.getByText(/Câmera leve em Antes: 2 fotos salvas/).waitFor();
  await page.getByRole('searchbox',{name:'Nome do promotor'}).fill('inexistente');
  await page.getByText('Nenhuma tentativa recebida para essa consulta.').waitFor();
  assert.deepEqual(errors,[]);
  console.log('Painel validado com sinais simulados: alertas, nome sem acento, fotos de Antes e ausência de sinais.');
} finally {await browser.close();}
