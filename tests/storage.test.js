import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {hydrateSeed} from '../src/mocks/engine.js';
import {saveDatabase,getDatabase,importDatabase,exportDatabase} from '../src/mocks/storage.js';
const records=new Map();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,String(v)),removeItem:k=>records.delete(k)},configurable:true});
const seed=JSON.parse(fs.readFileSync(new URL('../public/data/db.json',import.meta.url)));
test('storage persists state, export excludes sessions, import restores records and invalidates sessions',async()=>{
 const db=hydrateSeed(seed);db.orders[0].title='عنوان محفوظ للاختبار';db.sessions=[{token:'dummy',userId:'u1',expiresAt:new Date(Date.now()+3600000).toISOString()}];
 saveDatabase(db);assert.equal(getDatabase().orders[0].title,'عنوان محفوظ للاختبار');
 const exported=JSON.parse(await exportDatabase());assert.equal(exported.sessions.length,0);assert.equal(getDatabase().sessions.length,1);
 await importDatabase(exported);assert.equal(getDatabase().orders[0].title,'عنوان محفوظ للاختبار');assert.equal(getDatabase().sessions.length,0);
 const before=JSON.stringify(getDatabase());exported.orders[0].cartItems[0].productId='bad';
 await assert.rejects(()=>importDatabase(exported));assert.equal(JSON.stringify(getDatabase()),before);
});
