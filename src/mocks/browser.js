import { setupWorker } from 'msw/browser';
import { http, HttpResponse, delay } from 'msw';
import { handleApi, autoLock } from './engine.js';
import { initDatabase, getDatabase, saveDatabase, exclusive, getConfig, setConfig } from './storage.js';

const worker=setupWorker(http.all('/api/*',async({request})=>{
  const config=getConfig();
  const failNext=config.failNext;
  if(failNext)setConfig({...config,failNext:false});
  await delay(Math.max(0,Math.min(10000,Number(config.latencyMs)||0)));
  if(failNext)return HttpResponse.json({error:{code:'SIMULATED_ERROR',message:'فشل تجريبي قبل تنفيذ العملية. جرّب مرة أخرى.'}},{status:503});
  let body={};
  if(!['GET','HEAD'].includes(request.method)){
    try{const raw=await request.text();body=raw?JSON.parse(raw):{};}
    catch{return HttpResponse.json({error:{code:'INVALID_JSON',message:'صيغة JSON غير صحيحة'}},{status:400});}
  }
  try {
    return await exclusive(()=>{
      const current=getDatabase();autoLock(current);
      const draft=structuredClone(current);
      const result=handleApi(draft,{method:request.method,path:request.url,body,token:request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||''});
      // Failed requests never partially commit changes. Deadline expiry still persists.
      saveDatabase(result.status<400?draft:current);
      return HttpResponse.json(result.body,{status:result.status});
    });
  }catch(error){
    console.error('Mock storage/API error',error);
    return HttpResponse.json({error:{code:'MOCK_STORAGE_ERROR',message:'تعذر حفظ بيانات المحاكاة. راجع Console ومساحة التخزين.'}},{status:500});
  }
}));
let startup;
export function startMocking(){
  if(!startup)startup=initDatabase().then(()=>worker.start({onUnhandledRequest:'bypass',quiet:true,serviceWorker:{url:'/mockServiceWorker.js'}}));
  return startup;
}
