/* Infrastructure supplied by the instructor. Students implement src/App.jsx and UI.
 * This is a local teaching simulation, never production authentication or payments.
 */
export const STATUSES = ['Open','Locked','Confirmed','Out for Delivery','Delivered','Cancelled'];
const clone = (x) => structuredClone(x);
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const fail = (status, code, message, fields) => { throw Object.assign(new Error(message), {status, code, fields}); };
const ensure = (condition, status, code, message, fields) => { if (!condition) fail(status,code,message,fields); };
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const text = (v, field, min=1, max=120) => {
  ensure(typeof v === 'string' && v.trim().length >= min && v.trim().length <= max,422,'VALIDATION_ERROR',`تحقق من الحقل: ${field}`,{[field]:`نص من ${min} إلى ${max} حرف`});
  return v.trim();
};
const publicUser = ({id,name,email,role}) => ({id,name,email,role:role??'member'});
const iso = (now) => new Date(now).toISOString();
const dateValue = (value, field) => {
  ensure(typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)),422,'VALIDATION_ERROR',`أرسل ${field} بصيغة ISO مع المنطقة الزمنية`);
  return Date.parse(value);
};
export function hydrateSeed(seed, now=Date.now()) {
  function walk(v) {
    if (typeof v === 'string' && /^\$NOW[+-]\d+$/.test(v)) return iso(now + Number(v.slice(4)));
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)]));
    return v;
  }
  return walk(seed);
}
export function autoLock(db, now=Date.now()) {
  for (const order of db.orders) if (order.status==='Open' && Date.parse(order.closesAt)<=now) order.status='Locked';
  db.sessions = db.sessions.filter(s => Date.parse(s.expiresAt)>now);
}
function availableProduct(db, order, productId) {
  const product = db.menuItems.find(p=>p.id===productId);
  ensure(product && product.restaurantId===order.restaurantId,422,'INVALID_PRODUCT','المنتج ليس من مطعم هذا الطلب');
  ensure(product.available,409,'PRODUCT_UNAVAILABLE','المنتج غير متوفر حاليًا');
  const restaurant=db.restaurants.find(r=>r.id===order.restaurantId);
  ensure(restaurant?.isOpen,409,'RESTAURANT_CLOSED','المطعم مغلق حاليًا');
  return product;
}
function memberOf(order, uid) { return order.members.find(m=>m.userId===uid); }
function openOrder(order) { ensure(order.status==='Open',409,'ORDER_NOT_OPEN','الطلب مغلق؛ لا يمكن تعديل السلة أو العضوية'); }
function organizerOnly(order, uid) { ensure(order.organizerId===uid,403,'FORBIDDEN','هذه العملية متاحة لمنظّم الطلب فقط'); }
function decorateItems(db, order, uid) {
  return order.cartItems.filter(i=>!uid || i.userId===uid).map(item=>{
    const p=db.menuItems.find(p=>p.id===item.productId);
    return {...item,name:p.name,unitPriceFils:p.priceFils,lineTotalFils:p.priceFils*item.quantity};
  });
}
function billSnapshot(db, order) {
  const items=decorateItems(db,order);
  const active=order.members.filter(m=>items.some(i=>i.userId===m.userId))
    .sort((a,b)=>Date.parse(a.joinedAt)-Date.parse(b.joinedAt) || a.userId.localeCompare(b.userId));
  const fee=active.length ? order.deliveryFeeFils : 0;
  const base=active.length ? Math.floor(fee/active.length) : 0;
  const remainder=active.length ? fee%active.length : 0;
  const bills=order.members.map(m=>{
    const own=items.filter(i=>i.userId===m.userId);
    const index=active.findIndex(a=>a.userId===m.userId);
    const foodTotalFils=own.reduce((sum,i)=>sum+i.lineTotalFils,0);
    const deliveryShareFils=index>=0 ? base+(index<remainder ? 1 : 0) : 0;
    return {userId:m.userId,name:db.users.find(u=>u.id===m.userId).name,items:own,foodTotalFils,deliveryShareFils,totalFils:foodTotalFils+deliveryShareFils};
  });
  const foodTotalFils=items.reduce((sum,i)=>sum+i.lineTotalFils,0);
  const groups=[];
  for (const item of items) {
    const match=groups.find(g=>g.productId===item.productId && g.note===item.note);
    if (match) {match.quantity+=item.quantity;match.lineTotalFils+=item.lineTotalFils;}
    else groups.push({productId:item.productId,name:item.name,note:item.note,quantity:item.quantity,unitPriceFils:item.unitPriceFils,lineTotalFils:item.lineTotalFils});
  }
  return {bills,items:groups,participantCount:order.members.length,orderingMemberCount:active.length,foodTotalFils,deliveryFeeFils:fee,totalFils:foodTotalFils+fee};
}
function summary(db, order) {
  const snap=order.confirmedSnapshot || billSnapshot(db,order);
  const bills=snap.bills.map(b=>({...b,paid:order.payments.some(p=>p.userId===b.userId&&p.paid),paidAt:order.payments.find(p=>p.userId===b.userId)?.paidAt??null}));
  const paidTotalFils=bills.filter(b=>b.paid).reduce((sum,b)=>sum+b.totalFils,0);
  return {...clone(snap),bills,orderId:order.id,status:order.status,isFinal:!!order.confirmedSnapshot,paidTotalFils,unpaidTotalFils:order.status==='Cancelled'?0:snap.totalFils-paidTotalFils};
}
function orderView(db,o,uid) {
  const {cartItems,payments,confirmedSnapshot,members,...basic}=o;
  return {...basic,restaurantName:db.restaurants.find(r=>r.id===o.restaurantId).name,isOrganizer:o.organizerId===uid,memberCount:members.length,orderingMemberCount:members.filter(m=>cartItems.some(i=>i.userId===m.userId)).length,myQuantity:cartItems.filter(i=>i.userId===uid).reduce((n,i)=>n+i.quantity,0)};
}
function validOrderFields(input, now) {
  const title=text(input.title,'title',3,80);
  const pickupLocation=text(input.pickupLocation,'pickupLocation',3,160);
  const note=text(input.note??'','note',0,300);
  const closes=dateValue(input.closesAt,'closesAt');
  const expected=dateValue(input.expectedAt,'expectedAt');
  ensure(closes>now,422,'INVALID_DEADLINE','وقت إغلاق الطلب يجب أن يكون في المستقبل');
  ensure(expected>closes,422,'INVALID_DELIVERY_TIME','وقت الاستلام المتوقع يجب أن يكون بعد الإغلاق');
  ensure(integer(input.deliveryFeeFils,0,100000),422,'INVALID_FEE','رسوم التوصيل عدد صحيح بالفلس بين 0 و100000');
  return {title,pickupLocation,note,closesAt:iso(closes),expectedAt:iso(expected),deliveryFeeFils:input.deliveryFeeFils};
}
export function handleApi(db, {method='GET', path, token='', body={}}, now=Date.now()) {
  method=method.toUpperCase();
  const url=new URL(path,'http://mock.local');
  const p=url.pathname.replace(/\/$/,'');
  autoLock(db,now); // Also applied to rejected mutations and read requests.
  try {
    ensure(body && typeof body==='object' && !Array.isArray(body),400,'INVALID_JSON','جسم الطلب يجب أن يكون JSON Object');
    const ok=(data,status=200)=>({status,body:{data}});
    if (method==='POST' && p==='/api/auth/register') {
      ensure(!('role' in body),422,'ROLE_NOT_ALLOWED','التسجيل ينشئ عضوًا فقط؛ لا يمكن اختيار دور الأدمن');
      const name=text(body.name,'name',2,60);
      const email=text(body.email,'email',5,120).toLowerCase();
      ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),422,'VALIDATION_ERROR','البريد الإلكتروني غير صحيح',{email:'أدخل بريدًا صحيحًا'});
      ensure(typeof body.password==='string' && body.password.length>=8 && body.password.length<=72,422,'VALIDATION_ERROR','كلمة المرور من 8 إلى 72 حرفًا',{password:'من 8 إلى 72 حرفًا'});
      ensure(!db.users.some(u=>u.email===email),409,'EMAIL_EXISTS','البريد الإلكتروني مستخدم مسبقًا');
      const user={id:id('u'),name,email,password:body.password,role:'member'};
      db.users.push(user);
      return ok({user:publicUser(user)},201);
    }
    if (method==='POST' && p==='/api/auth/login') {
      const user=db.users.find(u=>u.email===String(body.email??'').trim().toLowerCase() && u.password===body.password);
      ensure(user,401,'INVALID_CREDENTIALS','البريد الإلكتروني أو كلمة المرور غير صحيحة');
      const session={token:id('demo-token'),userId:user.id,expiresAt:iso(now+8*60*60*1000)};
      db.sessions.push(session);
      return ok({user:publicUser(user),token:session.token,expiresAt:session.expiresAt});
    }
    const session=db.sessions.find(s=>s.token===token);
    const user=db.users.find(u=>u.id===session?.userId);
    ensure(user,401,'UNAUTHENTICATED','سجّل الدخول مجددًا؛ الجلسة غير موجودة أو انتهت');
    if (method==='GET' && p==='/api/auth/me') return ok({user:publicUser(user),expiresAt:session.expiresAt});
    if (method==='POST' && p==='/api/auth/logout') {db.sessions=db.sessions.filter(s=>s.token!==token);return ok({message:'تم تسجيل الخروج'});}

    // Admin manages catalog records, never restaurant login accounts.
    if(p.startsWith('/api/admin/')){
      ensure(user.role==='admin',403,'ADMIN_REQUIRED','إدارة المطاعم متاحة للأدمن فقط');
      const checkKeys=(allowed)=>ensure(Object.keys(body).length>0&&Object.keys(body).every(k=>allowed.includes(k)),422,'VALIDATION_ERROR','حقول العملية غير صحيحة');
      const restaurantFields=(input)=>{
        const name=text(input.name,'name',2,80),category=text(input.category,'category',2,40);
        const description=text(input.description??'','description',0,200);
        ensure(typeof input.isOpen==='boolean',422,'VALIDATION_ERROR','isOpen يجب أن تكون true أو false');
        return {name,category,description,isOpen:input.isOpen};
      };
      const menuFields=(input)=>{
        const name=text(input.name,'name',2,80),category=text(input.category,'category',2,40);
        ensure(integer(input.priceFils,1,1000000),422,'INVALID_PRICE','السعر عدد صحيح بالفلس من 1 إلى 1000000');
        ensure(typeof input.available==='boolean',422,'VALIDATION_ERROR','available يجب أن تكون true أو false');
        return {name,category,priceFils:input.priceFils,available:input.available};
      };
      const uniqueRestaurant=(name,except)=>ensure(!db.restaurants.some(r=>r.id!==except&&r.name.trim().toLowerCase()===name.toLowerCase()),409,'RESTAURANT_EXISTS','اسم المطعم موجود مسبقًا');
      if(method==='POST'&&p==='/api/admin/restaurants'){
        checkKeys(['name','category','description','isOpen']);
        const fields=restaurantFields({...body,isOpen:body.isOpen??false});
        ensure(!fields.isOpen,422,'CREATE_CLOSED','أضف المطعم مغلقًا، ثم أضف منتجاته وفعّل إتاحته');
        uniqueRestaurant(fields.name);
        const restaurant={id:id('r'),...fields};db.restaurants.push(restaurant);return ok(clone(restaurant),201);
      }
      const adminMatch=p.match(/^\/api\/admin\/restaurants\/([^/]+)(?:\/menu(?:\/([^/]+))?)?$/);
      if(adminMatch){
        const restaurant=db.restaurants.find(r=>r.id===adminMatch[1]);
        ensure(restaurant,404,'NOT_FOUND','المطعم غير موجود');
        const menuPath=p.includes('/menu');
        if(method==='PATCH'&&!menuPath){
          checkKeys(['name','category','description','isOpen']);
          const fields=restaurantFields({...restaurant,...body});uniqueRestaurant(fields.name,restaurant.id);
          if(fields.isOpen)ensure(db.menuItems.some(i=>i.restaurantId===restaurant.id&&i.available),409,'MENU_EMPTY','أضف منتجًا متاحًا قبل فتح المطعم');
          Object.assign(restaurant,fields);return ok(clone(restaurant));
        }
        if(method==='POST'&&menuPath&&!adminMatch[2]){
          checkKeys(['name','category','priceFils','available']);
          const fields=menuFields({...body,available:body.available??true});
          const item={id:id('m'),restaurantId:restaurant.id,...fields};db.menuItems.push(item);return ok(clone(item),201);
        }
        if(method==='PATCH'&&adminMatch[2]){
          checkKeys(['name','category','priceFils','available']);
          const item=db.menuItems.find(i=>i.id===adminMatch[2]&&i.restaurantId===restaurant.id);
          ensure(item,404,'NOT_FOUND','المنتج غير موجود في هذا المطعم');
          Object.assign(item,menuFields({...item,...body}));return ok(clone(item));
        }
      }
      fail(404,'NOT_FOUND','مسار إدارة المطاعم غير موجود');
    }
    if (method==='GET' && p==='/api/restaurants') {
      const q=(url.searchParams.get('q')??'').trim().toLowerCase();
      return ok(db.restaurants.filter(r=>!q || `${r.name} ${r.category}`.toLowerCase().includes(q)));
    }
    const restMatch=p.match(/^\/api\/restaurants\/([^/]+)(\/menu)?$/);
    if (method==='GET' && restMatch) {
      const restaurant=db.restaurants.find(r=>r.id===restMatch[1]);
      ensure(restaurant,404,'NOT_FOUND','المطعم غير موجود');
      let items=db.menuItems.filter(i=>i.restaurantId===restaurant.id);
      const category=url.searchParams.get('category');if(category)items=items.filter(i=>i.category===category);
      return ok(restMatch[2]?items:restaurant);
    }
    if (method==='GET' && p==='/api/group-orders') {
      const role=url.searchParams.get('role')||'all';
      const status=url.searchParams.get('status');
      ensure(['all','organizer','member'].includes(role)&&(!status||STATUSES.includes(status)),422,'INVALID_FILTER','قيمة الفلتر غير صحيحة');
      return ok(db.orders.filter(o=>memberOf(o,user.id) && (!status||o.status===status) && (role==='all'||(role==='organizer'?o.organizerId===user.id:o.organizerId!==user.id))).map(o=>orderView(db,o,user.id)).reverse());
    }
    if (method==='POST' && p==='/api/group-orders') {
      const restaurant=db.restaurants.find(r=>r.id===body.restaurantId);
      ensure(restaurant,422,'INVALID_RESTAURANT','اختر مطعمًا صحيحًا');
      ensure(restaurant.isOpen,409,'RESTAURANT_CLOSED','المطعم مغلق حاليًا');
      ensure(db.menuItems.some(i=>i.restaurantId===restaurant.id&&i.available),409,'MENU_EMPTY','لا توجد منتجات متاحة في هذا المطعم');
      const fields=validOrderFields(body,now);
      let joinCode;do{joinCode=crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase();}while(db.orders.some(o=>o.joinCode===joinCode));
      const order={id:id('o'),organizerId:user.id,restaurantId:restaurant.id,...fields,joinCode,status:'Open',createdAt:iso(now),members:[{userId:user.id,joinedAt:iso(now)}],cartItems:[],payments:[],confirmedSnapshot:null};
      db.orders.push(order);return ok(orderView(db,order,user.id),201);
    }
    if (method==='POST' && p==='/api/group-orders/join') {
      const joinCode=text(body.joinCode,'joinCode',6,6).toUpperCase();
      const order=db.orders.find(o=>o.joinCode===joinCode);
      ensure(order,404,'INVALID_JOIN_CODE','رمز الانضمام غير موجود');
      if(memberOf(order,user.id))return ok(orderView(db,order,user.id));
      openOrder(order);order.members.push({userId:user.id,joinedAt:iso(now)});
      return ok(orderView(db,order,user.id));
    }
    const match=p.match(/^\/api\/group-orders\/([^/]+)(.*)$/);
    ensure(match,404,'NOT_FOUND','المسار غير موجود');
    const order=db.orders.find(o=>o.id===match[1]);
    ensure(order,404,'NOT_FOUND','الطلب غير موجود');
    ensure(memberOf(order,user.id),403,'NOT_MEMBER','يجب الانضمام إلى الطلب أولًا');
    const tail=match[2];
    if(method==='GET' && !tail)return ok(orderView(db,order,user.id));
    if(method==='PATCH' && !tail){
      organizerOnly(order,user.id);openOrder(order);
      ensure(!('restaurantId' in body) && !('status' in body) && !('organizerId' in body),422,'IMMUTABLE_FIELD','لا يمكن تغيير المطعم أو المنظّم أو الحالة من هذا المسار');
      const allowed=['title','pickupLocation','note','closesAt','expectedAt','deliveryFeeFils'];
      ensure(Object.keys(body).length>0 && Object.keys(body).every(k=>allowed.includes(k)),422,'VALIDATION_ERROR','حقول التعديل غير صحيحة');
      const fields=validOrderFields({...order,...body},now);Object.assign(order,fields);return ok(orderView(db,order,user.id));
    }
    if(method==='GET' && tail==='/members')return ok(order.members.map(m=>({userId:m.userId,name:db.users.find(u=>u.id===m.userId).name,joinedAt:m.joinedAt,isOrganizer:m.userId===order.organizerId,hasItems:order.cartItems.some(i=>i.userId===m.userId)})));
    if(method==='DELETE' && tail==='/members/me'){
      openOrder(order);ensure(order.organizerId!==user.id,409,'ORGANIZER_CANNOT_LEAVE','منظّم الطلب لا يستطيع مغادرته؛ يمكنه إلغاء الطلب');
      order.members=order.members.filter(m=>m.userId!==user.id);order.cartItems=order.cartItems.filter(i=>i.userId!==user.id);return ok({message:'تمت المغادرة وحذف السلة الخاصة بك'});
    }
    if(method==='GET' && tail==='/cart'){
      const items=order.confirmedSnapshot?.bills.find(b=>b.userId===user.id)?.items??decorateItems(db,order,user.id);
      return ok({orderId:order.id,status:order.status,items:clone(items),quantity:items.reduce((n,i)=>n+i.quantity,0),foodTotalFils:items.reduce((n,i)=>n+i.lineTotalFils,0)});
    }
    if(method==='POST' && tail==='/cart/items'){
      openOrder(order);availableProduct(db,order,body.productId);
      ensure(integer(body.quantity,1,10),422,'INVALID_QUANTITY','الكمية عدد صحيح من 1 إلى 10');
      const note=text(body.note??'','note',0,200);
      const existing=order.cartItems.find(i=>i.userId===user.id && i.productId===body.productId && i.note===note);
      if(existing){ensure(existing.quantity+body.quantity<=10,422,'INVALID_QUANTITY','الكمية الإجمالية للسطر لا تتجاوز 10');existing.quantity+=body.quantity;return ok(clone(existing));}
      const item={id:id('ci'),userId:user.id,productId:body.productId,quantity:body.quantity,note};order.cartItems.push(item);return ok(clone(item),201);
    }
    const cartMatch=tail.match(/^\/cart\/items\/([^/]+)$/);
    if(cartMatch && ['PATCH','DELETE'].includes(method)){
      openOrder(order);const item=order.cartItems.find(i=>i.id===cartMatch[1]);
      ensure(item,404,'NOT_FOUND','عنصر السلة غير موجود');ensure(item.userId===user.id,403,'FORBIDDEN','يمكنك تعديل عناصر سلتك فقط');
      if(method==='DELETE'){order.cartItems=order.cartItems.filter(i=>i.id!==item.id);return ok({message:'تم حذف العنصر'});}
      ensure(Object.keys(body).length>0 && Object.keys(body).every(k=>['quantity','note'].includes(k)),422,'VALIDATION_ERROR','أرسل quantity و/أو note فقط');
      availableProduct(db,order,item.productId);
      const quantity=body.quantity??item.quantity;ensure(integer(quantity,1,10),422,'INVALID_QUANTITY','الكمية عدد صحيح من 1 إلى 10');
      const note=text(body.note??item.note,'note',0,200);
      const duplicate=order.cartItems.find(i=>i.id!==item.id && i.userId===user.id && i.productId===item.productId && i.note===note);
      if(duplicate){ensure(duplicate.quantity+quantity<=10,422,'INVALID_QUANTITY','الكمية بعد الدمج لا تتجاوز 10');duplicate.quantity+=quantity;order.cartItems=order.cartItems.filter(i=>i.id!==item.id);return ok(clone(duplicate));}
      Object.assign(item,{quantity,note});return ok(clone(item));
    }
    if(method==='POST' && tail==='/lock'){organizerOnly(order,user.id);openOrder(order);order.status='Locked';return ok(orderView(db,order,user.id));}
    if(method==='POST' && tail==='/reopen'){
      organizerOnly(order,user.id);ensure(order.status==='Locked',409,'INVALID_TRANSITION','إعادة الفتح متاحة فقط من حالة Locked');
      const closes=dateValue(body.closesAt,'closesAt');
      const expected=dateValue(body.expectedAt??order.expectedAt,'expectedAt');
      ensure(closes>now && expected>closes,422,'INVALID_DEADLINE','اختر وقت إغلاق مستقبلي قبل وقت الاستلام المتوقع');
      Object.assign(order,{status:'Open',closesAt:iso(closes),expectedAt:iso(expected)});return ok(orderView(db,order,user.id));
    }
    if(method==='POST' && tail==='/confirm'){
      organizerOnly(order,user.id);ensure(order.status==='Locked',409,'INVALID_TRANSITION','أغلق الطلب قبل تأكيده');
      ensure(order.cartItems.length>0,409,'EMPTY_ORDER','لا يمكن تأكيد طلب بلا منتجات');
      for(const item of order.cartItems)availableProduct(db,order,item.productId);
      order.confirmedSnapshot=billSnapshot(db,order);order.status='Confirmed';return ok(orderView(db,order,user.id));
    }
    if(method==='PATCH' && tail==='/status'){
      organizerOnly(order,user.id);
      const next=body.status;
      ensure((['Open','Locked'].includes(order.status)&&next==='Cancelled')||(order.status==='Confirmed'&&next==='Out for Delivery')||(order.status==='Out for Delivery'&&next==='Delivered'),409,'INVALID_TRANSITION','هذا الانتقال بين الحالات غير مسموح');
      order.status=next;return ok(orderView(db,order,user.id));
    }
    if(method==='GET' && tail==='/summary'){organizerOnly(order,user.id);return ok(summary(db,order));}
    if(method==='GET' && tail==='/bill'){
      ensure(order.status!=='Cancelled',409,'ORDER_CANCELLED','الطلب ملغى ولا توجد مبالغ مستحقة');
      const result=summary(db,order);const bill=result.bills.find(b=>b.userId===user.id);
      return ok({...bill,orderId:order.id,status:order.status,isFinal:result.isFinal});
    }
    const payMatch=tail.match(/^\/members\/([^/]+)\/payment$/);
    if(method==='PATCH' && payMatch){
      organizerOnly(order,user.id);ensure(order.confirmedSnapshot,409,'NOT_CONFIRMED','يُسجّل الدفع بعد تأكيد الطلب');
      ensure(typeof body.paid==='boolean',422,'VALIDATION_ERROR','paid يجب أن تكون true أو false');
      const bill=order.confirmedSnapshot.bills.find(b=>b.userId===payMatch[1]);
      ensure(bill,404,'NOT_FOUND','المشارك غير موجود');ensure(bill.totalFils>0,409,'EMPTY_BILL','لا يوجد مبلغ لتسجيل دفعه لهذا المشارك');
      const existing=order.payments.find(p=>p.userId===bill.userId);
      const payment={userId:bill.userId,paid:body.paid,paidAt:body.paid?(existing?.paid?existing.paidAt:iso(now)):null};
      if(existing)Object.assign(existing,payment);else order.payments.push(payment);return ok(payment);
    }
    fail(404,'NOT_FOUND','المسار أو Method غير مدعوم');
  } catch(error) {
    if(!error.status)throw error;
    return {status:error.status,body:{error:{code:error.code,message:error.message,...(error.fields?{fields:error.fields}:{})}}};
  }
}
