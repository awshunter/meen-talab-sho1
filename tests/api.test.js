import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hydrateSeed,handleApi,autoLock} from '../src/mocks/engine.js';
import {validateDatabase} from '../src/mocks/storage.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/data/db.json',import.meta.url)));
const now=Date.parse('2026-11-19T09:00:00Z');
function fixture(){
 let db=hydrateSeed(seed,now);
 function c(method,path,body={},token='',at=now){autoLock(db,at);const draft=structuredClone(db);const r=handleApi(draft,{method,path,body,token},at);if(r.status<400)db=draft;return r;}
 const login=(name)=>c('POST','/api/auth/login',{email:`${name}@example.test`,password:'Demo123!'}).body.data.token;
 return {c,login,db:()=>db};
}
test('all 25 non-admin endpoints: complete organizer and participant journey',()=>{
 const f=fixture(),{c,login}=f;
 assert.equal(c('POST','/api/auth/register',{name:'مها',email:'maha@example.test',password:'Demo123!'}).status,201);
 const o=login('omar'),s=login('sara'),l=login('laith');
 assert.equal(c('GET','/api/auth/me',{},o).body.data.user.id,'u1');
 assert.equal(c('GET','/api/restaurants',{},o).body.data.length,3);
 assert.equal(c('GET','/api/restaurants/r1',{},o).body.data.id,'r1');
 assert.equal(c('GET','/api/restaurants/r1/menu',{},o).body.data.length,4);
 const fields={restaurantId:'r1',title:'غداء جديد',pickupLocation:'الاستقبال',deliveryFeeFils:1000,closesAt:new Date(now+3600000).toISOString(),expectedAt:new Date(now+7200000).toISOString()};
 const order=c('POST','/api/group-orders',fields,o);assert.equal(order.status,201);const p=`/api/group-orders/${order.body.data.id}`;
 assert.equal(c('GET','/api/group-orders?role=organizer',{},o).body.data.length,2);
 assert.equal(c('GET',p,{},o).body.data.memberCount,1);
 for(const token of [s,l])assert.equal(c('POST','/api/group-orders/join',{joinCode:order.body.data.joinCode},token).status,200);
 assert.equal(c('PATCH',p,{title:'غداء الفريق'},o).status,200);
 assert.equal(c('GET',`${p}/members`,{},o).body.data.length,3);
 assert.equal(c('DELETE',`${p}/members/me`,{},l).status,200);
 const item=c('POST',`${p}/cart/items`,{productId:'m1',quantity:1,note:'بدون مخلل'},s).body.data;
 assert.equal(c('PATCH',`${p}/cart/items/${item.id}`,{quantity:2},s).status,200);
 assert.equal(c('GET',`${p}/cart`,{},s).body.data.foodTotalFils,9000);
 assert.equal(c('DELETE',`${p}/cart/items/${item.id}`,{},s).status,200);
 c('POST',`${p}/cart/items`,{productId:'m1',quantity:1},s);
 assert.equal(c('POST',`${p}/lock`,{},o).status,200);
 assert.equal(c('POST',`${p}/reopen`,{closesAt:fields.closesAt},o).status,200);
 c('POST',`${p}/lock`,{},o);assert.equal(c('POST',`${p}/confirm`,{},o).status,200);
 assert.equal(c('GET',`${p}/summary`,{},o).body.data.totalFils,5500);
 assert.equal(c('GET',`${p}/bill`,{},s).body.data.totalFils,5500);
 assert.equal(c('PATCH',`${p}/members/u2/payment`,{paid:true},o).status,200);
 for(const status of ['Out for Delivery','Delivered'])assert.equal(c('PATCH',`${p}/status`,{status},o).status,200);
 assert.equal(c('POST','/api/auth/logout',{},o).status,200);
 assert.equal(c('GET','/api/auth/me',{},o).status,401);validateDatabase(f.db());
});
test('auth validation, duplicate normalized emails, expiry and malformed body',()=>{
 const {c,login}=fixture();assert.equal(c('GET','/api/restaurants').status,401);
 assert.equal(c('POST','/api/auth/register',{name:'عمر',email:' OMAR@example.test ',password:'Demo123!'}).status,409);
 assert.equal(c('POST','/api/auth/login',{email:'omar@example.test',password:'wrong'}).status,401);
 assert.equal(c('POST','/api/auth/register',{name:'مها',email:'bad',password:'a'}).status,422);
 assert.equal(c('POST','/api/auth/login',[]).status,400);
 const token=login('omar');assert.equal(c('GET','/api/auth/me',{},token,now+8*3600000).status,401);
});
test('membership and ownership enforced, organizer cannot edit other carts',()=>{
 const {c,login}=fixture(),o=login('omar'),s=login('sara'),l=login('laith'),p='/api/group-orders/o-demo';
 assert.equal(c('GET',p,{},l).status,403);assert.equal(c('GET',`${p}/summary`,{},s).status,403);
 assert.equal(c('POST',`${p}/lock`,{},s).status,403);
 assert.equal(c('DELETE',`${p}/cart/items/ci-demo`,{},o).status,403);
 assert.equal(c('DELETE',`${p}/members/me`,{},o).status,409);
 assert.equal(c('GET',`${p}/cart`,{},o).body.data.items.length,0);
 assert.equal(c('POST','/api/group-orders/join',{joinCode:'team01'},s).body.data.memberCount,5);
});
test('unavailable/wrong-restaurant products and invalid quantities are rejected',()=>{
 const {c,login}=fixture(),s=login('sara'),p='/api/group-orders/o-demo/cart/items';
 for(const quantity of [0,-1,11,1.5,'2',null])assert.equal(c('POST',p,{productId:'m1',quantity},s).status,422);
 assert.equal(c('POST',p,{productId:'m5',quantity:1},s).status,422);
 assert.equal(c('POST',p,{productId:'m4',quantity:1},s).status,409);
 assert.equal(c('GET','/api/group-orders/o-demo/cart',{},s).body.data.quantity,1);
});
test('merge identical products/notes; note updates merge and cap total quantity',()=>{
 const {c,login}=fixture(),s=login('sara'),p='/api/group-orders/o-demo/cart/items';
 assert.equal(c('POST',p,{productId:'m1',quantity:2,note:'بدون مخلل'},s).body.data.quantity,3);
 const item=c('POST',p,{productId:'m1',quantity:2,note:'حار'},s).body.data;
 assert.equal(c('PATCH',`${p}/${item.id}`,{note:'بدون مخلل'},s).body.data.quantity,5);
 assert.equal(c('POST',p,{productId:'m1',quantity:6,note:'بدون مخلل'},s).status,422);
 assert.equal(c('GET','/api/group-orders/o-demo/cart',{},s).body.data.items.length,1);
});
test('deadline locks the order and rejects stale submissions',()=>{
 const {c,login,db}=fixture(),s=login('sara');
 assert.equal(c('POST','/api/group-orders/o-demo/cart/items',{productId:'m2',quantity:1},s,now+3600001).status,409);
 assert.equal(db().orders[0].status,'Locked');assert.equal(db().orders[0].cartItems.length,1);
});
test('delivery fee remainder balances in fils; leaving removes cart and recalculates',()=>{
 const {c,login}=fixture(),o=login('omar'),s=login('sara'),l=login('laith'),p='/api/group-orders/o-demo';
 c('POST','/api/group-orders/join',{joinCode:'TEAM01'},l);
 c('POST',`${p}/cart/items`,{productId:'m2',quantity:1},o);c('POST',`${p}/cart/items`,{productId:'m3',quantity:1},l);
 let sum=c('GET',`${p}/summary`,{},o).body.data;
 assert.deepEqual(sum.bills.filter(b=>b.totalFils>0).map(b=>b.deliveryShareFils),[334,333,333]);assert.equal(sum.bills.reduce((n,b)=>n+b.totalFils,0),sum.totalFils);
 c('DELETE',`${p}/members/me`,{},s);sum=c('GET',`${p}/summary`,{},o).body.data;
 assert.deepEqual(sum.bills.filter(b=>b.totalFils>0).map(b=>b.deliveryShareFils),[500,500]);
});
test('empty members do not pay delivery; confirmation freezes prices',()=>{
 const {c,login,db}=fixture(),o=login('omar'),s=login('sara'),p='/api/group-orders/o-demo';
 assert.equal(c('GET',`${p}/bill`,{},o).body.data.deliveryShareFils,0);
 c('POST',`${p}/lock`,{},o);c('POST',`${p}/confirm`,{},o);db().menuItems[0].priceFils=9999;
 assert.equal(c('GET',`${p}/bill`,{},s).body.data.foodTotalFils,4500);
 assert.equal(c('GET',`${p}/cart`,{},s).body.data.foodTotalFils,4500);validateDatabase(db());
});
test('payment correction, idempotence, no payment on empty bills',()=>{
 const {c,login}=fixture(),o=login('omar'),p='/api/group-orders/o-demo';c('POST',`${p}/lock`,{},o);c('POST',`${p}/confirm`,{},o);
 const paid=c('PATCH',`${p}/members/u2/payment`,{paid:true},o).body.data;
 assert.equal(c('PATCH',`${p}/members/u2/payment`,{paid:true},o,now+100).body.data.paidAt,paid.paidAt);
 c('PATCH',`${p}/members/u2/payment`,{paid:false},o);const sum=c('GET',`${p}/summary`,{},o).body.data;
 assert.equal(sum.paidTotalFils,0);assert.equal(sum.unpaidTotalFils,5500);
 assert.equal(c('PATCH',`${p}/members/u1/payment`,{paid:true},o).status,409);
});
test('state machine rejects skipping, early payment and reopening confirmed orders',()=>{
 const {c,login}=fixture(),o=login('omar'),p='/api/group-orders/o-demo';
 assert.equal(c('POST',`${p}/confirm`,{},o).status,409);assert.equal(c('PATCH',`${p}/status`,{status:'Delivered'},o).status,409);
 assert.equal(c('PATCH',`${p}/members/u2/payment`,{paid:true},o).status,409);
 c('POST',`${p}/lock`,{},o);c('POST',`${p}/confirm`,{},o);
 assert.equal(c('POST',`${p}/reopen`,{closesAt:new Date(now+10000).toISOString()},o).status,409);
 assert.equal(c('PATCH',`${p}/status`,{status:'Cancelled'},o).status,409);
});
test('cancelled orders retain history, no edits and no collectible bill',()=>{
 const {c,login}=fixture(),o=login('omar'),s=login('sara'),p='/api/group-orders/o-demo';
 assert.equal(c('PATCH',`${p}/status`,{status:'Cancelled'},o).status,200);
 assert.equal(c('GET',`${p}/bill`,{},s).status,409);
 assert.equal(c('GET',`${p}/summary`,{},o).body.data.unpaidTotalFils,0);
 assert.equal(c('POST',`${p}/cart/items`,{productId:'m1',quantity:1},s).status,409);
});
test('empty confirmation, update validation, filters and reopen deadlines',()=>{
 const {c,login}=fixture(),o=login('omar'),s=login('sara'),p='/api/group-orders/o-demo';
 assert.equal(c('GET','/api/group-orders?status=Wrong',{},o).status,422);
 assert.equal(c('GET','/api/restaurants?q=برغر',{},o).body.data.length,1);
 assert.equal(c('GET','/api/restaurants/r1/menu?category=مشروبات',{},o).body.data.length,1);
 for(const body of [{deliveryFeeFils:-1},{restaurantId:'r2'},{closesAt:new Date(now-1).toISOString()}])assert.equal(c('PATCH',p,body,o).status,422);
 c('DELETE',`${p}/cart/items/ci-demo`,{},s);c('POST',`${p}/lock`,{},o);
 assert.equal(c('POST',`${p}/confirm`,{},o).status,409);
 assert.equal(c('POST',`${p}/reopen`,{closesAt:new Date(now+7200001).toISOString()},o).status,422);
});
test('JSON round-trip and import validation',()=>{
 const f=fixture(),s=f.login('sara');f.c('POST','/api/group-orders/o-demo/cart/items',{productId:'m2',quantity:2},s);
 const restored=JSON.parse(JSON.stringify(f.db()));validateDatabase(restored);assert.equal(restored.orders[0].cartItems.length,2);
 restored.orders[0].cartItems[0].productId='missing';assert.throws(()=>validateDatabase(restored));
});
