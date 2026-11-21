import { startMocking } from './browser.js';
import { getDatabase,exportDatabase,importDatabase,resetDatabase,getConfig,setConfig,exclusive,saveDatabase } from './storage.js';
const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
const stats=()=>{const db=getDatabase();$('stats').textContent=`${db.users.length} مستخدمين · ${db.restaurants.length} مطاعم · ${db.orders.length} طلبات جماعية`;};
function action(id,fn){$(id).addEventListener('click',async()=>{try{await fn();stats();}catch(e){status(e.message);}});}
try{await startMocking();stats();status('المحاكاة جاهزة. التطبيق الأساسي فارغ لتبدأ عملك.');}catch(e){status(e.message);}
$('latency').value=getConfig().latencyMs;
action('export',async()=>{
 const blob=new Blob([await exportDatabase()],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='db-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('تم تصدير البيانات الحالية دون الجلسات.');
});
$('import').addEventListener('change',async(event)=>{try{const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error('الحد الأقصى للملف 5 MB');if(!confirm('استبدال البيانات الحالية بالملف؟ صدّر نسخة احتياطية أولًا.'))return;await importDatabase(JSON.parse(await file.text()));$('token').value='';stats();status('تم الاستيراد. سجّل الدخول من جديد.');}catch(e){status(e.message);}finally{event.target.value='';}});
action('reset',async()=>{if(confirm('إعادة بيانات البداية وحذف التغييرات الحالية؟')){await resetDatabase();$('token').value='';status('تمت إعادة البيانات. سجّل الدخول مجددًا.');}});
action('save-config',()=>{const latencyMs=Number($('latency').value);if(!Number.isInteger(latencyMs)||latencyMs<0||latencyMs>10000)throw new Error('اختر قيمة بين 0 و10000');setConfig({...getConfig(),latencyMs});status('تم حفظ التأخير لهذا التبويب.');});
action('fail',()=>{setConfig({...getConfig(),failNext:true});status('طلب API القادم في هذا التبويب سيفشل مرة واحدة برمز 503.');});
action('expire',async()=>{await exclusive(()=>{const db=getDatabase();db.sessions=[];saveDatabase(db);});$('token').value='';status('تم إنهاء الجلسات. الطلب المحمي القادم سيُرجع 401.');});
action('sample-login',()=>{$('method').value='POST';$('path').value='/api/auth/login';$('body').value=JSON.stringify({email:'omar@example.test',password:'Demo123!'},null,2);});
action('sample-me',()=>{$('method').value='GET';$('path').value='/api/auth/me';$('body').value='';});
action('send',async()=>{
 const path=$('path').value.trim();if(!path.startsWith('/api/')||path.includes('://'))throw new Error('استخدم مسارًا محليًا يبدأ بـ /api/');
 const method=$('method').value;const headers={'Content-Type':'application/json'};if($('token').value.trim())headers.Authorization=`Bearer ${$('token').value.trim()}`;
 const options={method,headers};if(method!=='GET')options.body=JSON.stringify($('body').value.trim()?JSON.parse($('body').value):{});
 $('send').disabled=true;try{const response=await fetch(path,options);const result=await response.json();$('response').textContent=`HTTP ${response.status}\n${JSON.stringify(result,null,2)}`;if(result.data?.token)$('token').value=result.data.token;if(path==='/api/auth/logout'&&response.ok)$('token').value='';status(response.ok?'تمت العملية.':'راجع تفاصيل الخطأ.');}finally{$('send').disabled=false;}
});
