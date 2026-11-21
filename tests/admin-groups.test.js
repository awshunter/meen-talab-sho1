import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hydrateSeed,handleApi,autoLock} from '../src/mocks/engine.js';
import {validateDatabase} from '../src/mocks/storage.js';
const seed=JSON.parse(fs.readFileSync(new URL('../public/data/db.json',import.meta.url)));
const now=Date.now();
function fixture(){let db=hydrateSeed(seed,now);const c=(method,path,body={},token='')=>{autoLock(db,now);const draft=structuredClone(db);const r=handleApi(draft,{method,path,body,token},now);if(r.status<400)db=draft;return r;};const login=name=>c('POST','/api/auth/login',{email:`${name}@example.test`,password:'Demo123!'}).body.data;return{c,login,db:()=>db};}
test('admin role is returned by auth; public registration cannot grant admin',()=>{
 const {c,login}=fixture();const a=login('admin');assert.equal(a.user.role,'admin');assert.equal(c('GET','/api/auth/me',{},a.token).body.data.user.role,'admin');
 const input={name:'عضو جديد',email:'new@example.test',password:'Demo123!',role:'admin'};
 assert.equal(c('POST','/api/auth/register',input).status,422);delete input.role;
 assert.equal(c('POST','/api/auth/register',input).body.data.user.role,'member');
});
test('admin creates, updates restaurants and menu; members cannot mutate catalog',()=>{
 const {c,login,db}=fixture(),a=login('admin').token,m=login('omar').token;
 const input={name:'مطعم جديد',category:'وجبات',description:'تجربة'};
 assert.equal(c('POST','/api/admin/restaurants',input).status,401);
 assert.equal(c('POST','/api/admin/restaurants',input,m).status,403);
 const created=c('POST','/api/admin/restaurants',input,a);assert.equal(created.status,201);const r=created.body.data;
 assert.equal(r.isOpen,false);const path=`/api/admin/restaurants/${r.id}`;
 assert.equal(c('POST','/api/admin/restaurants',input,a).status,409);
 assert.equal(c('PATCH',path,{isOpen:true},a).status,409);
 assert.equal(c('POST',`${path}/menu`,{name:'سلطة',category:'وجبات',priceFils:-2},a).status,422);
 const item=c('POST',`${path}/menu`,{name:'سلطة',category:'وجبات',priceFils:1500},a);assert.equal(item.status,201);
 assert.equal(c('PATCH',path,{isOpen:true},a).status,200);
 assert.equal(c('GET',`/api/restaurants/${r.id}`,{},m).body.data.isOpen,true);
 const ip=`${path}/menu/${item.body.data.id}`;
 assert.equal(c('PATCH',ip,{priceFils:2000},m).status,403);
 assert.equal(c('PATCH',ip,{priceFils:2000,available:false},a).status,200);
 assert.equal(c('PATCH',`/api/admin/restaurants/r2/menu/${item.body.data.id}`,{priceFils:3000},a).status,404);
 assert.equal(c('GET',`/api/restaurants/${r.id}/menu`,{},m).body.data[0].priceFils,2000);
 assert.equal(c('GET','/api/group-orders/o-demo/summary',{},a).status,403);
 validateDatabase(db());
});
test('five-person and four-person groups keep separate carts, fees, membership and state',()=>{
 const {c,login,db}=fixture(),a=login('omar').token,b=login('laith').token;
 assert.equal(c('GET','/api/group-orders/o-demo',{},a).body.data.memberCount,5);
 assert.equal(c('GET','/api/group-orders/o-burger',{},b).body.data.memberCount,4);
 assert.deepEqual(c('GET','/api/group-orders',{},a).body.data.map(x=>x.id),['o-demo']);
 assert.deepEqual(c('GET','/api/group-orders',{},b).body.data.map(x=>x.id),['o-burger']);
 for(const name of ['omar','mahmoud','noor','rana'])c('POST','/api/group-orders/o-demo/cart/items',{productId:'m2',quantity:1},login(name).token);
 const first=c('GET','/api/group-orders/o-demo/summary',{},a).body.data,second=c('GET','/api/group-orders/o-burger/summary',{},b).body.data;
 assert.equal(first.orderingMemberCount,5);assert.equal(first.deliveryFeeFils,1000);assert.deepEqual(first.bills.map(x=>x.deliveryShareFils),[200,200,200,200,200]);
 assert.equal(second.orderingMemberCount,4);assert.equal(second.deliveryFeeFils,2000);assert.deepEqual(second.bills.map(x=>x.deliveryShareFils),[500,500,500,500]);
 assert.equal(c('POST','/api/group-orders/o-burger/lock',{},a).status,403);
 c('POST','/api/group-orders/o-demo/lock',{},a);c('POST','/api/group-orders/o-demo/confirm',{},a);
 assert.equal(c('GET','/api/group-orders/o-burger',{},b).body.data.status,'Open');
 assert.deepEqual(c('GET','/api/group-orders/o-burger/summary',{},b).body.data,second);
 validateDatabase(db());
});
test('one member can join two independent orders without mixing own cart',()=>{
 const {c,login}=fixture(),o=login('omar').token;
 assert.equal(c('POST','/api/group-orders/join',{joinCode:'TEAM02'},o).status,200);
 c('POST','/api/group-orders/o-burger/cart/items',{productId:'m5',quantity:1},o);
 assert.equal(c('GET','/api/group-orders/o-demo/cart',{},o).body.data.quantity,0);
 assert.equal(c('GET','/api/group-orders/o-burger/cart',{},o).body.data.quantity,1);
 assert.equal(c('GET','/api/group-orders',{},o).body.data.length,2);
});
test('catalog price edits affect estimates but preserve confirmed invoices',()=>{
 const {c,login}=fixture(),a=login('admin').token,o=login('omar').token,s=login('sara').token;
 c('PATCH','/api/admin/restaurants/r1/menu/m1',{priceFils:5000},a);
 assert.equal(c('GET','/api/group-orders/o-demo/bill',{},s).body.data.foodTotalFils,5000);
 c('POST','/api/group-orders/o-demo/lock',{},o);c('POST','/api/group-orders/o-demo/confirm',{},o);
 c('PATCH','/api/admin/restaurants/r1/menu/m1',{priceFils:6000,available:false},a);
 c('PATCH','/api/admin/restaurants/r1',{isOpen:false},a);
 assert.equal(c('GET','/api/group-orders/o-demo/bill',{},s).body.data.foodTotalFils,5000);
});
