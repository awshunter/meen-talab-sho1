import { hydrateSeed, autoLock, STATUSES } from './engine.js';
export const DB_KEY='meen-talab-sho.db.v1';
export const CONFIG_KEY='meen-talab-sho.mock-config.v1';
const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export function validateDatabase(db) {
  const check=(c,m)=>{if(!c)throw new Error(`ملف JSON غير صالح: ${m}`);};
  check(db&&db.schemaVersion===1,'schemaVersion يجب أن تكون 1');
  for(const key of ['users','sessions','restaurants','menuItems','orders'])check(Array.isArray(db[key]),`${key} يجب أن تكون Array`);
  for(const key of ['users','restaurants','menuItems','orders']){
    check(db[key].every(x=>x&&typeof x.id==='string'&&x.id.length>0),`id غير صحيح في ${key}`);
    check(new Set(db[key].map(x=>x.id)).size===db[key].length,`id مكرر في ${key}`);
  }
  check(db.users.every(u=>typeof u.name==='string'&&typeof u.email==='string'&&typeof u.password==='string'&&(u.role===undefined||['member','admin'].includes(u.role))),'بيانات users ناقصة');
  check(new Set(db.users.map(u=>u.email.toLowerCase())).size===db.users.length,'بريد إلكتروني مكرر');
  const users=new Set(db.users.map(u=>u.id)), restaurants=new Set(db.restaurants.map(r=>r.id));
  check(db.restaurants.every(r=>typeof r.name==='string'&&typeof r.category==='string'&&typeof r.isOpen==='boolean'),'بيانات restaurants غير صحيحة');
  check(db.menuItems.every(m=>restaurants.has(m.restaurantId)&&typeof m.name==='string'&&typeof m.category==='string'&&integer(m.priceFils,1,1000000)&&typeof m.available==='boolean'),'بيانات menuItems غير صحيحة');
  check(db.sessions.every(s=>users.has(s.userId)&&typeof s.token==='string'&&validDate(s.expiresAt)),'بيانات sessions غير صحيحة');
  check(new Set(db.orders.map(o=>o.joinCode)).size===db.orders.length,'joinCode مكرر');
  for(const o of db.orders){
    check(users.has(o.organizerId)&&restaurants.has(o.restaurantId),'مرجع مستخدم أو مطعم غير موجود');
    check(STATUSES.includes(o.status)&&/^[A-Z0-9]{6}$/.test(o.joinCode),'حالة الطلب أو كود الانضمام غير صحيح');
    check(typeof o.title==='string'&&typeof o.pickupLocation==='string'&&typeof o.note==='string','حقول الطلب ناقصة');
    check(validDate(o.closesAt)&&validDate(o.expectedAt)&&validDate(o.createdAt)&&Date.parse(o.expectedAt)>Date.parse(o.closesAt),'تواريخ الطلب غير صحيحة');
    check(integer(o.deliveryFeeFils,0,100000),'رسوم التوصيل غير صحيحة');
    check(Array.isArray(o.members)&&o.members.some(m=>m.userId===o.organizerId),'المنظّم يجب أن يكون عضوًا');
    check(o.members.every(m=>users.has(m.userId)&&validDate(m.joinedAt))&&new Set(o.members.map(m=>m.userId)).size===o.members.length,'الأعضاء غير صحيحين');
    const members=new Set(o.members.map(m=>m.userId));
    check(Array.isArray(o.cartItems)&&o.cartItems.every(i=>typeof i.id==='string'&&members.has(i.userId)&&integer(i.quantity,1,10)&&typeof i.note==='string'&&db.menuItems.some(m=>m.id===i.productId&&m.restaurantId===o.restaurantId)),'عناصر السلة غير صحيحة');
    check(new Set(o.cartItems.map(i=>i.id)).size===o.cartItems.length&&new Set(o.cartItems.map(i=>JSON.stringify([i.userId,i.productId,i.note]))).size===o.cartItems.length,'عناصر سلة مكررة');
    check(Array.isArray(o.payments)&&o.payments.every(p=>members.has(p.userId)&&typeof p.paid==='boolean'&&(p.paid?validDate(p.paidAt):p.paidAt===null)),'حالات الدفع غير صحيحة');
    check(new Set(o.payments.map(p=>p.userId)).size===o.payments.length,'سجلات دفع مكررة');
    const confirmed=['Confirmed','Out for Delivery','Delivered'].includes(o.status);
    check(confirmed?o.confirmedSnapshot&&Array.isArray(o.confirmedSnapshot.bills)&&Array.isArray(o.confirmedSnapshot.items):o.confirmedSnapshot===null,'نسخة الفاتورة لا تتوافق مع الحالة');
    if(confirmed){
      const s=o.confirmedSnapshot;
      check(integer(s.totalFils)&&integer(s.foodTotalFils)&&integer(s.deliveryFeeFils),'إجماليات الفاتورة غير صحيحة');
      check(s.bills.length===o.members.length&&new Set(s.bills.map(b=>b.userId)).size===s.bills.length,'عدد الفواتير غير صحيح');
      check(s.bills.every(b=>members.has(b.userId)&&typeof b.name==='string'&&Array.isArray(b.items)&&integer(b.foodTotalFils)&&integer(b.deliveryShareFils)&&integer(b.totalFils)&&b.totalFils===b.foodTotalFils+b.deliveryShareFils),'تفاصيل الفواتير غير صحيحة');
      check(s.bills.every(b=>b.items.every(i=>i.userId===b.userId&&typeof i.name==='string'&&typeof i.note==='string'&&integer(i.quantity,1,10)&&integer(i.unitPriceFils,1)&&i.lineTotalFils===i.unitPriceFils*i.quantity)&&b.foodTotalFils===b.items.reduce((n,i)=>n+i.lineTotalFils,0)),'عناصر الفاتورة غير صحيحة');
      check(s.totalFils===s.foodTotalFils+s.deliveryFeeFils&&s.bills.reduce((n,b)=>n+b.totalFils,0)===s.totalFils,'مجموع الفواتير غير متطابق');
    }
  }
  return db;
}
export function getDatabase(){
  const raw=localStorage.getItem(DB_KEY);
  if(!raw)throw new Error('قاعدة المحاكاة غير مهيأة');
  return JSON.parse(raw);
}
export function saveDatabase(db){localStorage.setItem(DB_KEY,JSON.stringify(db));}
let queue=Promise.resolve();
export function exclusive(fn){
  if(globalThis.navigator?.locks)return navigator.locks.request(DB_KEY,fn);
  const job=queue.then(fn,fn);queue=job.catch(()=>{});return job;
}
async function loadSeed(){
  const response=await fetch('/data/db.json');
  if(!response.ok)throw new Error('لم يتم العثور على public/data/db.json');
  return validateDatabase(hydrateSeed(await response.json()));
}
export async function initDatabase(){
  return exclusive(async()=>{
    if(!localStorage.getItem(DB_KEY))saveDatabase(await loadSeed());
    else validateDatabase(getDatabase());
  });
}
export async function resetDatabase(){return exclusive(async()=>saveDatabase(await loadSeed()));}
export async function importDatabase(input){
  const db=validateDatabase(hydrateSeed(input));
  db.sessions=[]; // Imported credentials must never revive an old session.
  autoLock(db);await exclusive(()=>saveDatabase(db));
}
export async function exportDatabase(){return exclusive(()=>{
  const db=getDatabase();autoLock(db);saveDatabase(db);db.sessions=[];
  return JSON.stringify(db,null,2);
});}
export function getConfig(){try{return {latencyMs:350,failNext:false,...JSON.parse(sessionStorage.getItem(CONFIG_KEY)||'{}')};}catch{return {latencyMs:350,failNext:false};}}
export function setConfig(config){sessionStorage.setItem(CONFIG_KEY,JSON.stringify(config));}
