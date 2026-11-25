(function(){
const store={
  get(k,d){try{const v=localStorage.getItem("gps4_"+k);if(!v)return d;const x=JSON.parse(v);return Array.isArray(d)&&!Array.isArray(x)||typeof d==="boolean"&&typeof x!=="boolean"?d:x}catch(e){return d}},
  set(k,v){try{localStorage.setItem("gps4_"+k,JSON.stringify(v))}catch(e){}}
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const view=$("#view");
/* Безопасность: картинки только как data:image, тексты с ограничением длины, файлы до 15 МБ */
const safeImg=u=>typeof u==="string"&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u)?u:"";
const clip=(v,n)=>String(v==null?"":v).trim().slice(0,n);
const MAX_FILE=15*1024*1024;
const CAP_MAX={seat:60,parcel:5000,car:10,drive:3};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=n=>(Math.round(n*100)/100).toLocaleString("ru-RU",{maximumFractionDigits:2})+" €";
const H=36e5;

/* ---------- Сервер: Supabase + вход через Telegram или почту. Пустой config.js = демо-режим ---------- */
const CFG=window.GTG_CONFIG||{};
const LIVE=!!(CFG.supabaseUrl&&CFG.supabaseKey&&/^https:\/\//.test(CFG.supabaseUrl));
const SB=LIVE?String(CFG.supabaseUrl).replace(/\/+$/,""):"";
function apiErr(status,j){const e=new Error(j&&(j.message||j.msg||j.error_description||j.error)||"server");e.status=status;e.code=j&&(j.code||j.error_code||j.error);return e}
const errText=e=>e&&/[а-яё]/i.test(e.message||"")?e.message:e&&e.status===429?"Слишком много попыток. Подождите пару минут":e&&e.status?"Ошибка сервера ("+e.status+(e.code?" "+String(e.code).slice(0,40):"")+"). Попробуйте ещё раз":"Нет связи с сервером. Попробуйте ещё раз";
/* Сессия Supabase живёт в localStorage (на GitHub Pages нет своего сервера для cookie). Защита: CSP, esc(), короткий срок жизни токена */
const api={
  s:store.get("sess",null),
  setS(x){this.s=x&&x.access_token?{a:x.access_token,r:x.refresh_token,e:Date.now()+(x.expires_in||3600)*1000}:null;store.set("sess",this.s)},
  async auth(path,body,tok){const r=await fetch(SB+"/auth/v1/"+path,{method:"POST",headers:{apikey:CFG.supabaseKey,"Content-Type":"application/json",...(tok?{Authorization:"Bearer "+tok}:{})},body:JSON.stringify(body||{})});
    const j=await r.json().catch(()=>null);if(!r.ok)throw apiErr(r.status,j);return j},
  async token(){
    if(this.s&&this.s.e-60000>Date.now())return this.s.a;
    if(this.s&&this.s.r){try{this.setS(await this.auth("token?grant_type=refresh_token",{refresh_token:this.s.r}));return this.s.a}catch(e){if(!e.status||e.status>=500)throw e;this.setS(null)}}
    this.setS(await this.auth("signup",{}));return this.s.a}, /* анонимная сессия: её потом привязывает к профилю вход через Telegram */
  async call(path,opt,again){const t=await this.token();
    const r=await fetch(SB+path,{...opt,headers:{apikey:CFG.supabaseKey,Authorization:"Bearer "+t,"Content-Type":"application/json",...(opt.headers||{})}});
    if(r.status===401&&!again&&this.s){this.s.e=0;return this.call(path,opt,true)}
    const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
    if(!r.ok)throw apiErr(r.status,j);return j},
  get(q){return this.call("/rest/v1/"+q,{method:"GET"})},
  post(t,b,ret){return this.call("/rest/v1/"+t,{method:"POST",headers:{Prefer:ret?"return=representation":"return=minimal"},body:JSON.stringify(b)})},
  patch(q,b){return this.call("/rest/v1/"+q,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(b)})},
  del(q){return this.call("/rest/v1/"+q,{method:"DELETE"})},
  rpc(f,a){return this.call("/rest/v1/rpc/"+f,{method:"POST",body:JSON.stringify(a||{})})},
  fn(action,x){return this.call("/functions/v1/tg-login",{method:"POST",body:JSON.stringify({action,...x})})}
};

/* Города: [широта, долгота, страна] */
const CITIES={
 "Кишинёв":[47.01,28.86,"MD"],"Бельцы":[47.76,27.93,"MD"],"Кагул":[45.90,28.19,"MD"],"Унгены":[47.21,27.80,"MD"],"Комрат":[46.30,28.65,"MD"],"Сороки":[48.16,28.30,"MD"],"Оргеев":[47.38,28.82,"MD"],
 "Берлин":[52.52,13.40,"DE"],"Мюнхен":[48.14,11.58,"DE"],"Франкфурт":[50.11,8.68,"DE"],"Гамбург":[53.55,9.99,"DE"],"Кёльн":[50.94,6.96,"DE"],"Штутгарт":[48.78,9.18,"DE"],"Нюрнберг":[49.45,11.08,"DE"],
 "Рим":[41.90,12.50,"IT"],"Милан":[45.46,9.19,"IT"],"Болонья":[44.49,11.34,"IT"],"Падуя":[45.41,11.88,"IT"],"Турин":[45.07,7.69,"IT"],"Верона":[45.44,10.99,"IT"],"Неаполь":[40.85,14.27,"IT"],"Венеция":[45.44,12.32,"IT"],
 "Цюрих":[47.37,8.54,"CH"],"Женева":[46.20,6.14,"CH"],"Базель":[47.56,7.59,"CH"],"Берн":[46.95,7.45,"CH"],
 "Вена":[48.21,16.37,"AT"],"Прага":[50.08,14.44,"CZ"],"Варшава":[52.23,21.01,"PL"],"Бухарест":[44.43,26.10,"RO"],"Яссы":[47.16,27.59,"RO"],"Будапешт":[47.50,19.04,"HU"],
 "Париж":[48.86,2.35,"FR"],"Лион":[45.76,4.84,"FR"],"Мадрид":[40.42,-3.70,"ES"],"Барселона":[41.39,2.17,"ES"],"Лиссабон":[38.72,-9.14,"PT"],"Лондон":[51.51,-0.13,"GB"],
 "Амстердам":[52.37,4.90,"NL"],"Брюссель":[50.85,4.35,"BE"],"Одесса":[46.48,30.72,"UA"],"Стамбул":[41.01,28.98,"TR"],"София":[42.70,23.32,"BG"],"Афины":[37.98,23.73,"GR"]
};
const cityNames=Object.keys(CITIES);
function dist(a,b){const r=Math.PI/180,dLat=(b[0]-a[0])*r,dLon=(b[1]-a[1])*r;const x=Math.sin(dLat/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLon/2)**2;return 6371*2*Math.asin(Math.sqrt(x))}
const roadKm=(a,b)=>Math.round(dist(a,b)*1.25);
function nearestCity(lat,lon){let best=null,bd=1e9;for(const n of cityNames){const d=dist([lat,lon],CITIES[n]);if(d<bd){bd=d;best=n}}return{name:best,d:bd}}
function place(name){const c=CITIES[name];return c?{name,lat:c[0],lon:c[1]}:null}

const KINDS={
  seat:{t:"Пассажиры",unit:"мест",color:"--k-seat",price:"за место"},
  parcel:{t:"Посылки",unit:"кг",color:"--k-parcel",price:"за кг"},
  car:{t:"Трал",unit:"авто",color:"--k-car",price:"за авто"},
  drive:{t:"Перегон",unit:"авто",color:"--k-drive",price:"за перегон"}
};
const now=Date.now();
const R=(id,from,to,inH,driver,vehicle,caps,prices,rating,extra,carrier)=>({carrier:carrier||"private",id,from:place(from),to:place(to),at:Math.round((now+inH*H)/9e5)*9e5,driver,vehicle,caps,prices,rating,note:extra||""});
const seedRoutes=[
  R("r1","Кишинёв","Мюнхен",14,"Ион","VW Passat, универсал",{seat:4,parcel:40},{seat:110,parcel:1.5},4.9,"Еду через Яссы, Будапешт, Вену. Могу забрать по Кишинёву."),
  R("r2","Бельцы","Франкфурт",30,"Василе","Маршрутка Mercedes Sprinter, 8 мест",{seat:5,parcel:250},{seat:120,parcel:1.2},4.8,"Остановки: Унгены, Яссы, Нюрнберг.","bus"),
  R("r3","Милан","Кишинёв",6,"Андрей","Mercedes Sprinter, грузовой",{parcel:300},{parcel:1},4.9,"Забираю посылки по Милану до 16:00. Доставка до двери в Кишинёве и Бельцах."),
  R("r4","Болонья","Кишинёв",40,"Сергей","Iveco Daily",{seat:3,parcel:200},{seat:130,parcel:1.1},4.7,"Прием посылок в Болонье и Падуе.","bus"),
  R("r5","Рим","Бельцы",70,"Михаил","Ford Transit",{parcel:400},{parcel:1.2},4.6,""),
  R("r6","Падуя","Кишинёв",20,"Дорин","Renault Master",{seat:2,parcel:150},{seat:120,parcel:1},5.0,"Через Венецию и Верону."),
  R("r7","Цюрих","Кишинёв",26,"Николай","Трал на 2 машины + Iveco",{car:1,parcel:100},{car:650,parcel:1.5},4.9,"Забираю авто в Цюрихе, Базеле, Берне. Документы и растаможка не входят."),
  R("r8","Базель","Кишинёв",96,"Евгений","Автовоз на 8 машин",{car:3},{car:550},4.8,"Погрузка в Базеле, Цюрихе и Мюнхене."),
  R("r9","Франкфурт","Кишинёв",50,"Виктор","Эвакуатор-платформа",{car:1},{car:700},4.7,"Могу забрать машину с аукциона или из салона."),
  R("r10","Кишинёв","Париж",48,"Александру","Skoda Superb",{seat:3},{seat:140},4.9,""),
  R("r11","Мюнхен","Кишинёв",9,"Петру","Mercedes Vito",{seat:4,parcel:120},{seat:110,parcel:1.3},4.8,""),
  R("r12","Кишинёв","Рим",60,"Лилия","Toyota Corolla",{seat:2,parcel:20},{seat:130,parcel:2},5.0,"Не курим в машине."),
  R("r13","Турин","Кагул",80,"Георге","VW Crafter",{parcel:350},{parcel:1},4.7,""),
  R("r14","Кишинёв","Берлин",22,"Дмитрий","Opel Vivaro",{seat:6,parcel:80},{seat:120,parcel:1.4},4.6,""),
  R("r15","Кишинёв","Рим",48,"Molda Trans","Автобус Setra, 50 мест",{seat:12,parcel:300},{seat:95,parcel:1},4.6,"Рейсовый автобус. Остановки: Бухарест, Будапешт, Болонья.","bus"),
  R("r16","Кишинёв","Милан",16,"Влад","Toyota RAV4",{seat:3,parcel:30},{seat:100,parcel:1.5},4.9,"Еду сам на своей машине, не хочу ехать с пустыми местами."),
  R("r17","Париж","Кишинёв",20,"Кристина","Renault Scenic",{seat:2,parcel:60},{seat:150,parcel:1.5},4.8,"Возьму посылки со сладостями и продуктами, передам в руки в Кишинёве."),
  R("r18","Лион","Кишинёв",55,"EuroBus MD","Маршрутка Mercedes Sprinter",{seat:6,parcel:200},{seat:140,parcel:1.2},4.5,"","bus"),
  R("d1","Цюрих","Кишинёв",40,"Алексей","Без своей машины",{drive:1},{drive:250},4.9,"Буду в Цюрихе 26 октября. Пригоню вашу машину в Кишинёв, права категории B, стаж 12 лет."),
  R("d2","Мюнхен","Бельцы",60,"Сергиу","Без своей машины",{drive:1},{drive:220},4.8,"Еду в Мюнхен на автобусе, обратно могу пригнать машину."),
  R("d3","Милан","Кишинёв",30,"Олег","Без своей машины",{drive:1},{drive:230},5.0,"Перегоняю машины 5 лет. Нужны доверенность и Green Card."),
  R("d4","Женева","Кишинёв",70,"Марин","Без своей машины",{drive:1},{drive:260},4.7,""),
  R("p1","Рим","Кишинёв",18,"Ирина","Рейс Рим – Кишинёв",{parcel:5},{parcel:6},4.9,"Лечу завтра, возьму документы или маленькую посылку до 5 кг."),
  R("m1","Мюнхен","Кишинёв",36,"Артём","BMW R 1250 GS",{seat:1},{seat:90},4.8,"Возьму одного пассажира, шлем дам."),
  R("t1","Франкфурт","Кишинёв",28,"Валерий","MAN, тент 20 т",{parcel:2000},{parcel:.6},4.7,"Беру крупные грузы: мебель, паллеты, технику.")
];
const VT_OF={r1:"car",r2:"minibus",r3:"minibus",r4:"minibus",r5:"minibus",r6:"minibus",r7:"trailer",r8:"trailer",r9:"tow",r10:"car",r11:"minibus",r12:"car",r13:"minibus",r14:"minibus",r15:"bus",r16:"car",r17:"car",r18:"minibus",p1:"plane",m1:"moto",t1:"truck"};
seedRoutes.forEach(r=>{if(VT_OF[r.id])r.vt=VT_OF[r.id]});
const MEET_OF={r1:["Кишинёв","ул. Каля Мошилор, 2/1, Северный автовокзал"],r3:["Милан","Piazza Duca d'Aosta, у вокзала Milano Centrale"],r15:["Кишинёв","ул. Влайку Пыркэлаб, 70, Центральный автовокзал"],r16:["Кишинёв","бул. Дачия, 47, парковка у Malldova"],r17:["Париж","Porte Maillot, парковка у Palais des Congrès"]};
seedRoutes.forEach(r=>{const m=MEET_OF[r.id];if(m)r.meet={city:m[0],street:m[1],lat:r.from.lat,lon:r.from.lon}});

/* Запросы «ищу транспорт» (оранжевые точки ожидания) */
const WANT={seat:"Ищу место",parcel:"Ищу, кто возьмёт посылку",car:"Ищу трал для машины",drive:"Ищу, кто пригонит машину"};
function seedReqs(){const Q=(id,from,to,inH,name,people,kind,note)=>({id,from:place(from),to:place(to),at:Math.round((now+inH*H)/36e5)*36e5,name,people,kind,note});
  return [Q("q1","Кишинёв","Бухарест",20,"Ана",2,"seat","С ребёнком, багаж небольшой."),Q("q2","Кишинёв","Бухарест",44,"Ион",1,"seat",""),
    Q("q3","Бельцы","Варшава",26,"Наталья",1,"parcel","Коробка 10 кг, документы и подарки."),Q("q4","Кишинёв","Афины",70,"Михай",3,"seat","Можем выехать в любой день на этой неделе."),
    Q("q5","Рим","Кишинёв",30,"Елена",1,"parcel","Продукты и сладости, 8 кг."),Q("q6","Цюрих","Кишинёв",50,"Виорел",1,"car","Купил BMW X3, деньги продавцу переведены."),
    Q("q7","Кишинёв","Бухарест",30,"Дан",1,"seat","")]}
function waitHubs(){const m={};state.requests.filter(q=>q.at>Date.now()-12*H).forEach(q=>{const k=q.from.name;const h=m[k]||(m[k]={t:"wait",name:k,lat:q.from.lat,lon:q.from.lon,n:0,people:0});h.n++;h.people+=q.people});return Object.values(m)}
/* Плата за подачу объявления. Сейчас всё бесплатно, чтобы набрать пользователей.
   Вернуть платную подачу: PAID=true (цена в FEE, в леях). */
const PAID=false;
const FEE=PAID?1:0;
const lei=n=>n+" "+(n%10===1&&n%100!==11?"лей":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"лея":"леев");

let state={
  user:store.get("user",null),
  tab:store.get("tab","map"),
  routes:LIVE?[]:store.get("routes",[]).length?store.get("routes",[]):seedRoutes,
  chats:LIVE?[]:store.get("chats",[]),
  bookings:LIVE?[]:store.get("bookings",[]),
  maxp:null,
  requests:LIVE?[]:store.get("requests",[]).length?store.get("requests",[]):seedReqs(),
  seenIntro:store.get("seenIntro",false),
  support:store.get("support",[]),
  shared:store.get("shared",false),
  reviews:LIVE?[]:store.get("reviews",[]),
  kind:"all",
  A:place("Милан"),B:place("Кишинёв"),pick:null,sel:null,
  pub:{kind:"seat",A:null,B:null,pick:"A",vt:"car"},
  vt:"all",
  auth:{step:"phone",phone:"+373 69 123 456",sent:null},
  openChat:null
};
/* В рабочем режиме маршруты, брони и чаты живут на сервере, в браузер они не сохраняются */
const save=()=>{store.set("user",state.user);store.set("tab",state.tab);store.set("seenIntro",state.seenIntro);store.set("support",state.support);store.set("shared",state.shared);
  if(!LIVE){store.set("routes",state.routes);store.set("chats",state.chats);store.set("bookings",state.bookings);store.set("requests",state.requests);store.set("reviews",state.reviews)}};
if(LIVE&&state.user&&!state.user.id)state.user=null;

/* ---------- История действий (видна только админу) ----------
   Записываем: какой экран открыт, на какую кнопку нажали, выбранный город, подачу объявления, бронь, вход и выход.
   Только если человек разрешил (TRK.on===true). НИКОГДА не пишем: пароли, коды входа, текст сообщений и отзывов, то, что печатают в поля.
   Хранится не дольше 12 месяцев (настраивается в админке), потом сервер удаляет записи сам. */
const TRK={on:store.get("trk",null),q:[],sid:Math.random().toString(36).slice(2,12),last:"",tm:0,busy:false};
const trkDev=()=>(matchMedia("(max-width:899px)").matches?"phone":"pc")+(matchMedia("(display-mode: standalone)").matches?"-app":"");
/* Убираем из подписей всё, что похоже на номер, почту или код */
const trkClean=v=>clip(String(v==null?"":v).replace(/\s+/g," ").replace(/[^\s@]+@[^\s@]+/g,"…").replace(/[+\d][\d\s().-]{4,}\d/g,"…").replace(/«[^»]*»/g,"«…»"),80);
function trk(n,p,t){
  if(TRK.on!==true||!/^[a-z_]{1,32}$/.test(n))return;
  const e={n,at:Date.now(),s:trkScreenName()};if(t)e.t=trkClean(t);
  if(p&&typeof p==="object"){const o={};Object.keys(p).slice(0,8).forEach(k=>{const v=p[k];if(v!=null&&v!=="")o[k]=typeof v==="number"?v:trkClean(v).slice(0,60)});e.p=o}
  if(!LIVE){const L=store.get("trklog",[]);L.push({...e,sid:TRK.sid,dev:trkDev()});store.set("trklog",L.slice(-1500));return}
  TRK.q.push(e);if(TRK.q.length>=20)trkFlush();else if(!TRK.tm)TRK.tm=setTimeout(trkFlush,8000);
}
/* Отправляем только когда у браузера уже есть сессия: ради записи не создаём новых анонимных аккаунтов */
async function trkFlush(keep){
  clearTimeout(TRK.tm);TRK.tm=0;
  if(!LIVE||!TRK.q.length||TRK.busy||!api.s)return;
  const batch=TRK.q.splice(0,50);TRK.busy=true;
  try{await api.call("/rest/v1/rpc/log_events",{method:"POST",keepalive:!!keep,body:JSON.stringify({p_events:batch,p_sid:TRK.sid,p_device:trkDev()})})}
  catch(e){if(!e.status||e.status>=500)TRK.q.unshift(...batch.slice(0,200-TRK.q.length))}
  finally{TRK.busy=false}
  if(TRK.q.length)TRK.tm=setTimeout(trkFlush,8000);
}
document.addEventListener("visibilitychange",()=>{if(document.hidden)trkFlush(true)});
function trkScreenName(){
  if(!state.user)return "auth:"+(state.auth&&state.auth.step||"start");
  if(state.tab==="chats"&&state.openChat)return "chat";
  return state.tab||"map";
}
function trkScreen(){const s=trkScreenName();if(s===TRK.last)return;TRK.last=s;trk("screen")}
/* Подпись нажатой кнопки: data-ev, aria-label, вкладка или короткий текст кнопки. Тексты переписки не берём */
function trkLabel(el){
  if(el.dataset.ev)return el.dataset.ev;
  if(el.closest(".chatlog,.msg"))return "";
  if(el.dataset.c!=null)return "Открыть чат";
  if(el.dataset.person!=null)return "Профиль человека";
  if(el.dataset.tab)return "Вкладка: "+((el.querySelector("span")||el).textContent.trim());
  const a=el.getAttribute("aria-label")||el.getAttribute("title");
  const txt=(el.textContent||"").trim();
  return txt&&txt.length<=50?txt:a||(el.id?"#"+el.id:"Кнопка");
}
document.addEventListener("click",e=>{
  if(TRK.on!==true)return;
  const el=e.target.closest&&e.target.closest("button,a,[role=option],label.filebtn,summary");
  if(!el||el.closest("#trkbar")||state.tab==="admin"&&state.user)return;
  const l=trkLabel(el);if(l)trk("click",null,l);
},true);
function trkSet(v){TRK.on=v;store.set("trk",v);const b=$("#trkbar");if(b)b.remove();
  if(v){TRK.last="";trkScreen();trk("consent",{on:1})}}
/* Короткое уведомление внизу экрана при первом входе */
function trkAsk(){
  if(TRK.on!==null||$("#trkbar"))return;
  const d=document.createElement("div");d.id="trkbar";d.className="trkbar card";d.setAttribute("role","region");d.setAttribute("aria-label","История действий");
  d.innerHTML=`<p class="small" style="margin:0">Чтобы делать приложение удобнее, мы можем записывать, какие экраны вы открываете и какие кнопки нажимаете. Пароли, коды входа, текст сообщений и то, что вы печатаете, не записываем никогда. История хранится не дольше 12 месяцев, её видит только администратор.</p>
    <div class="row"><button class="btn sm" id="trkyes" type="button">Разрешаю</button><button class="btn ghost sm" id="trkno" type="button">Не надо</button><button class="btn ghost sm" id="trkmore" type="button">Подробнее</button></div>`;
  document.body.appendChild(d);
  d.querySelector("#trkyes").onclick=()=>{trkSet(true);toast("Спасибо! Выключить можно в профиле")};
  d.querySelector("#trkno").onclick=()=>{trkSet(false);toast("Хорошо, ничего не записываем")};
  d.querySelector("#trkmore").onclick=privacySheet;
}
function privacySheet(){
  sheet(`<h2>Конфиденциальность</h2>
    <div class="small" style="display:grid;gap:8px">
      <p style="margin:0"><b>Что мы храним.</b> Почту, имя, номер телефона (если вы его дали), подключён ли Telegram, ваши объявления, брони, отзывы и переписку. Номер телефона видит только тот, с кем у вас бронь. Переписку видите только вы и собеседник.</p>
      <p style="margin:0"><b>История действий.</b> Только если вы разрешили: какие экраны вы открываете, на какие кнопки нажимаете, какой город выбрали в поиске, когда подали объявление или бронь, когда вошли и вышли. Пароли, коды входа, текст сообщений и то, что вы печатаете, не записываются. Историю видит только администратор, чтобы находить ошибки и делать приложение удобнее. Она хранится не дольше 12 месяцев и потом удаляется сама. Мы не продаём и не передаём её рекламным сетям.</p>
      <p style="margin:0"><b>Ваши права.</b> Можно в любой момент выключить запись истории, стереть её или удалить аккаунт со всеми данными: всё это в профиле. Вопросы пишите в чат поддержки.</p>
    </div>
    <p class="small muted" style="margin:0">Сейчас запись истории: <b>${TRK.on===true?"включена":"выключена"}</b>.</p>
    <div class="row"><button class="btn sm" id="pvon" type="button">${TRK.on===true?"Выключить запись":"Разрешить запись"}</button>${LIVE&&api.s?`<button class="btn ghost sm" id="pvdel" type="button">Стереть мою историю</button>`:""}</div>
    <button class="btn ghost" id="pvok" type="button">Закрыть</button>`,s=>{
    s.querySelector("#pvok").onclick=closeSheet;
    s.querySelector("#pvon").onclick=()=>{const v=TRK.on!==true;if(!v){TRK.q=[]}trkSet(v);closeSheet();toast(v?"Запись истории включена":"Запись истории выключена");if(state.user&&state.tab==="profile")renderProfile()};
    const del=s.querySelector("#pvdel");if(del)del.onclick=()=>{TRK.q=[];api.rpc("forget_my_events").then(()=>{closeSheet();toast("Ваша история действий стёрта")},liveFail)};
  });
}

function doneSheet(title,text){sheet(`<div class="done"><div class="big" aria-hidden="true">✓</div><h2>${esc(title)}</h2>${text?`<p class="small muted">${esc(text)}</p>`:""}</div><button class="btn" id="dok" type="button">Хорошо</button>`,s=>{s.querySelector("#dok").onclick=closeSheet;s.querySelector("#dok").focus()})}
function toast(msg){trk("toast",null,msg);const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
function when(t){
  const d=new Date(t),hh=String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  const day=x=>{const y=new Date(x);y.setHours(0,0,0,0);return y.getTime()};
  const dd=Math.round((day(t)-day(Date.now()))/864e5);
  const M=["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const lbl=dd===0?"сегодня":dd===1?"завтра":dd===2?"послезавтра":d.getDate()+" "+M[d.getMonth()];
  const inH=(t-Date.now())/H;
  return {txt:lbl+", "+hh, rel:inH<1?"скоро":inH<24?"через "+Math.round(inH)+" ч":"через "+Math.round(inH/24)+" дн.", soon:inH<24};
}
function closeSheet(){const s=$(".scrim");if(s)s.remove()}
function sheet(html,bind){closeSheet();const s=document.createElement("div");s.className="scrim";s.innerHTML=`<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;s.onclick=e=>{if(e.target===s)closeSheet()};document.body.appendChild(s);{const h=s.querySelector("h2,b");if(!(state.tab==="admin"&&state.user))trk("sheet",null,h?h.textContent:"Окно")}bind&&bind(s);const f=s.querySelector("button,input");f&&f.focus()}

/* ---------- Вход по телефону ---------- */
function renderAuth(){
  if(LIVE)return renderAuthLive();
  const a=state.auth;$("#tabs").hidden=true;$("#who").innerHTML="";
  if(a.step==="phone"){
    view.innerHTML=`<h1>Вход по номеру телефона</h1>
      <p class="muted">Попутчики, посылки и перевозка машин по всей Европе. Пароль не нужен, пришлём код в SMS.</p>
      <form class="card" id="f"><label for="phone">Номер телефона<input id="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(a.phone)}"></label>
      <button class="btn" type="submit">Получить код</button>
      <p class="small muted">Подходит любой номер: Молдова, Румыния, Италия, Германия и другие страны.</p></form>
      <button class="btn ghost" id="demo" type="button">Войти без SMS (демо)</button>
      <button class="btn ghost sm" id="priv" type="button">Конфиденциальность</button>`;
    $("#priv").onclick=privacySheet;
    $("#demo").onclick=()=>{trk("login",{method:"demo"});state.user={name:"Вова",phone:a.phone};save();render();toast("Вы вошли в демо-режиме")};
    $("#f").onsubmit=e=>{e.preventDefault();const p=$("#phone").value.trim();if(p.replace(/\D/g,"").length<8){toast("Проверьте номер: нужен код страны и номер");return}
      a.phone=clip(p,30);a.sent=String(Math.floor(1000+Math.random()*9000));a.step="code";render()};
  }else if(a.step==="code"){
    view.innerHTML=`<h1>Введите код из SMS</h1>
      <p class="muted">Отправили на <span class="mono">${esc(a.phone)}</span>. <button class="btn ghost sm" id="back" type="button">Изменить</button></p>
      <form class="card" id="f"><div class="hint">Демо-режим: настоящая SMS не приходит. Код <b class="mono">${a.sent}</b> уже подставлен, просто нажмите «Подтвердить».</div>
      <div class="code-row">${[0,1,2,3].map(i=>`<input id="c${i}" inputmode="numeric" maxlength="1" aria-label="Цифра ${i+1}">`).join("")}</div>
      <button class="btn" type="submit">Подтвердить</button></form>`;
    const ins=[0,1,2,3].map(i=>$("#c"+i));
    ins.forEach((el,i)=>{el.oninput=()=>{el.value=el.value.replace(/\D/g,"");if(el.value&&ins[i+1])ins[i+1].focus()};el.onkeydown=e=>{if(e.key==="Backspace"&&!el.value&&ins[i-1])ins[i-1].focus()}});
    ins[0].addEventListener("paste",e=>{const d=(e.clipboardData.getData("text")||"").replace(/\D/g,"").slice(0,4);if(d.length){e.preventDefault();d.split("").forEach((c,i)=>ins[i].value=c)}});
    a.sent.split("").forEach((c,i)=>ins[i].value=c);$("#f button[type=submit]").focus();$("#back").onclick=()=>{a.step="phone";render()};
    $("#f").onsubmit=e=>{e.preventDefault();if(ins.map(i=>i.value).join("")!==a.sent){toast("Код не совпал. Проверьте цифры");return}a.step="name";render()};
  }else{
    view.innerHTML=`<h1>Как вас зовут?</h1><p class="muted">Имя увидят водители и пассажиры в чате.</p>
      <form class="card" id="f"><label for="name">Имя<input id="name" autocomplete="given-name" value="Вова" required></label><button class="btn" type="submit">Готово</button></form>`;
    $("#f").onsubmit=e=>{e.preventDefault();trk("register",{method:"demo"});state.user={name:clip($("#name").value,60)||"Гость",phone:a.phone};save();render();toast("Номер подтверждён")};
  }
}

/* ---------- Рабочий режим: вход через Telegram или почту ---------- */
const live={people:{},byName:{},photos:{},poll:null,tick:null,n:0,sig:""};
const EXTRA_KEYS=["photo","ltype","cname","idno","cphone","cphone2","fax","email","ig","fb"];
const pickExtra=o=>{const x={};EXTRA_KEYS.forEach(k=>{if(o[k]!=null&&o[k]!=="")x[k]=k==="photo"?safeImg(o[k])||undefined:clip(o[k],200)});return x};
function userFromProfile(p){const x=p.extra&&typeof p.extra==="object"&&!Array.isArray(p.extra)?p.extra:{};
  return {...pickExtra(x),id:p.id,name:clip(p.name,60),phone:p.phone||"",phoneOk:!!p.phone_ok,loginEmail:p.email||"",tg:!!p.telegram,docs:!!p.verified,isAdmin:!!p.is_admin}}
const pushProfile=()=>api.patch("profiles?id=eq."+state.user.id,{name:state.user.name,extra:pickExtra(state.user)});
function stopTgPoll(){if(live.poll){clearInterval(live.poll);live.poll=null}}
const okEmail=v=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const codeInput=(id,max=6)=>`<input id="${id}" inputmode="numeric" autocomplete="one-time-code" maxlength="${max}" pattern="[0-9]*" required class="mono" style="font-size:22px;letter-spacing:6px">`;
async function finishLogin(){
  const p=await api.rpc("my_profile");if(!p||!p.id)throw new Error("no profile");
  const u=userFromProfile(p),a=state.auth;a.prof=u;
  if(!u.name){a.step="name";render();return}
  if(!u.tg&&!a.google){a.step="linktg";render();return}
  enterLive(u);
}
/* ---------- Вход через Google: Supabase OAuth с PKCE. Секрет Google хранится только в Supabase, в браузер и в GitHub он не попадает ---------- */
const b64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const backUrl=()=>location.origin+location.pathname;
async function googleStart(b){
  if(b){b.disabled=true;b.setAttribute("aria-busy",true)}
  try{
    const v=b64u(crypto.getRandomValues(new Uint8Array(32)));
    const ch=b64u(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
    store.set("pkce",{v,t:Date.now()});
    location.assign(SB+"/auth/v1/authorize?"+new URLSearchParams({provider:"google",redirect_to:backUrl(),code_challenge:ch,code_challenge_method:"s256"}));
  }catch(e){if(b){b.disabled=false;b.setAttribute("aria-busy",false)}toast("Не получилось открыть Google. Попробуйте ещё раз")}
}
/* Google вернул человека на сайт с ?code=… : меняем код на сессию и находим (или создаём) профиль по почте */
async function googleReturn(){
  const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));
  const code=q.get("code"),err=q.get("error")||h.get("error"),errd=q.get("error_description")||h.get("error_description")||"";
  const p=store.get("pkce",null);
  if(!p||!(code||err))return;
  store.set("pkce",null);history.replaceState(null,"",backUrl());
  const a=state.auth;
  if(err){toast(/not enabled|unsupported provider/i.test(errd)?"Вход через Google ещё не включён на сервере":"Вход через Google отменён");return}
  if(Date.now()-p.t>6e5){toast("Время входа вышло. Нажмите «Войти через Google» ещё раз");return}
  a.step="gwait";render();
  let em="";
  try{const j=await api.auth("token?grant_type=pkce",{auth_code:code,code_verifier:p.v});api.setS(j);
    const m=j.user&&j.user.user_metadata||{};em=String(j.user&&j.user.email||"").toLowerCase();a.gname=clip(m.full_name||m.name||"",60)}
  catch(e){a.step="start";render();toast("Не удалось войти через Google. Попробуйте ещё раз");return}
  a.google=true;
  try{await api.rpc("link_email");await finishLogin();return}
  catch(e){
    try{await api.auth("logout",{},api.s&&api.s.a)}catch(x){}api.setS(null);a.google=false;
    if(!/Telegram/.test(e.message||"")||!em){a.step="start";render();toast(errText(e));return}
  }
  /* К аккаунту уже подключён Telegram: как и с почтой, нужен ещё код из Telegram */
  a.email=em;
  try{a.login=await api.fn("login_code",{email:em});a.step="tgcode";render();toast("К аккаунту подключён Telegram. Отправили туда код для входа")}
  catch(e){a.step="start";render();toast(errText(e))}
}
function enterLive(u){trk("login",{method:state.auth.google?"google":state.auth.login?"telegram":"email"});state.user=u;state.auth={step:"start"};save();render();toast("Вы вошли");startLive()}
/* Подключить Telegram к профилю: бот попросит поделиться номером, потом туда будут приходить коды входа */
async function tgLinkSheet(btn,done){
  const busy=on=>{if(btn){btn.disabled=on;btn.setAttribute("aria-busy",on)}};busy(true);
  let t;try{t=await api.fn("link_start")}
  catch(e){busy(false);toast(e.status===429?"Слишком много попыток. Подождите 10 минут":e.code==="bot_not_configured"?"Бот ещё не настроен на сервере":errText(e));return}
  busy(false);stopTgPoll();
  sheet(`<h2>Подключите Telegram</h2>
    <ol class="small" style="margin:0;padding-left:20px;display:grid;gap:6px">
      <li>Нажмите кнопку ниже, откроется наш бот.</li><li>Нажмите «Старт» (Start).</li><li>Нажмите «📱 Поделиться номером».</li></ol>
    <div class="kv"><span class="muted">Код сверки</span><b class="mono" style="font-size:22px;letter-spacing:4px">${esc(t.code)}</b></div>
    <p class="small muted">Бот покажет такой же код. Если код другой, ничего не нажимайте.</p>
    <a class="btn" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;text-align:center;display:block">Открыть Telegram</a>
    <p class="small muted" id="tgst" role="status">Ждём подтверждения…</p>
    <button class="btn ghost" id="tgx" type="button">Отмена</button>`,s=>{
    s.querySelector("#tgx").onclick=()=>{stopTgPoll();closeSheet()};
    const till=Date.now()+(t.ttl||600)*1000;
    live.poll=setInterval(async()=>{
      if(!document.body.contains(s)){stopTgPoll();return}
      if(Date.now()>till){stopTgPoll();closeSheet();toast("Время вышло. Нажмите «Подключить Telegram» ещё раз");return}
      let r;try{r=await api.fn("link_check",{token:t.token})}catch(e){return}
      if(!document.body.contains(s))return;
      if(r.status==="wait"){const st=s.querySelector("#tgst");if(st)st.textContent="Бот открыт. Нажмите «Поделиться номером» в Telegram…"}
      else if(r.status==="taken"){stopTgPoll();closeSheet();toast("Этот Telegram уже подключён к другому аккаунту")}
      else if(r.status==="expired"){stopTgPoll();closeSheet();toast("Ссылка устарела, попробуйте ещё раз")}
      else if(r.status==="ok"){stopTgPoll();closeSheet();toast("Telegram подключён. Коды для входа будут приходить туда");done&&done()}
    },2500)});
}
function renderAuthLive(){
  const a=state.auth;$("#tabs").hidden=true;$("#who").innerHTML="";
  const busy=(b,on)=>{b.disabled=on;b.setAttribute("aria-busy",on)};
  const sendTgCode=async b=>{busy(b,true);
    try{a.login=await api.fn("login_code",{email:a.email});a.step="tgcode";render();toast("Код отправлен")}
    catch(e){busy(b,false);toast(e.status===429?"Слишком много попыток. Подождите 10 минут":e.code==="anonymous_provider_disabled"?"Сервер ещё не настроен: включите анонимный вход в Supabase":"Не удалось связаться с сервером. Попробуйте ещё раз")}};
  if(a.step==="gwait"){
    view.innerHTML=`<h1>Входим через Google…</h1><p class="muted" role="status">Подождите пару секунд.</p>`;
  }else if(a.step==="tgcode"&&a.login){
    view.innerHTML=`<h1>Код из Telegram</h1>
      <p class="muted">Если аккаунт с почтой <b>${esc(a.email)}</b> есть и к нему подключён Telegram, бот${a.login.bot?` <b>@${esc(a.login.bot)}</b>`:""} прислал вам код из 6 цифр.</p>
      <form class="card" id="f"><label for="oc">Код<br>${codeInput("oc")}</label>
      <button class="btn" type="submit">Войти</button>
      <p class="small muted">Никому не сообщайте этот код. Мы никогда его не спрашиваем: ни в чате, ни по телефону.</p>
      <p class="small muted">Код обычно приходит за несколько секунд. Если не пришёл и после повторной отправки, подождите час: мы ограничиваем число кодов, чтобы никто не мог засыпать вас сообщениями.</p></form>
      <button class="btn ghost" id="again" type="button">Код не пришёл? Отправить ещё раз</button>
      <button class="btn ghost" id="mail" type="button">Telegram ещё не подключён? Войти кодом из письма</button>
      <button class="btn ghost" id="back" type="button">Изменить почту</button>`;
    $("#back").onclick=()=>{a.step="start";render()};
    $("#again").onclick=()=>sendTgCode($("#again"));
    $("#mail").onclick=()=>{a.mode="login";a.step="email";render()};
    $("#f").onsubmit=async e=>{e.preventDefault();const code=$("#oc").value.replace(/\D/g,""),b=$("#f button");
      if(code.length!==6){toast("Впишите все 6 цифр из Telegram");return}
      busy(b,true);let r;
      try{r=await api.fn("login_verify",{token:a.login.token,code})}catch(e){busy(b,false);toast(e.status===429?"Слишком много попыток. Подождите пару минут":errText(e));return}
      if(r.status==="ok"){try{await finishLogin()}catch(e){busy(b,false);toast(errText(e))}return}
      busy(b,false);$("#oc").value="";
      if(r.status==="locked"){a.step="start";render();toast("Слишком много неверных попыток. Запросите новый код")}
      else if(r.status==="expired"){a.step="start";render();toast("Код устарел. Запросите новый")}
      else if(r.status==="denied"){a.step="start";render();toast("Код отменён кнопкой «Это не я» в Telegram")}
      else toast("Код не подошёл. Проверьте цифры")};
  }else if(a.step==="email"){
    const reg=a.mode!=="login";
    view.innerHTML=`<h1>${reg?"Регистрация":"Вход кодом из письма"}</h1>
      <p class="muted">${reg?"Пришлём на почту код, чтобы убедиться, что почта ваша. Пароль не нужен.":"Подходит, только если к аккаунту ещё не подключён Telegram."}</p>
      <form class="card" id="f"><label for="em">Электронная почта<input id="em" type="email" inputmode="email" autocomplete="email" required value="${esc(a.email||"")}"></label>
      <button class="btn" type="submit">Получить код на почту</button>
      ${reg?`<p class="small muted">После почты подключите Telegram: туда будут приходить коды для входа. Это бесплатно, без SMS.</p>`:""}</form>
      ${reg?`<button class="btn ghost" id="gg" type="button">Или войти через Google</button>`:""}
      <button class="btn ghost" id="back" type="button">Назад</button>`;
    if(reg)$("#gg").onclick=()=>googleStart($("#gg"));
    $("#back").onclick=()=>{a.step="start";render()};
    $("#f").onsubmit=async e=>{e.preventDefault();const v=clip($("#em").value,200).trim().toLowerCase(),b=$("#f button");
      if(!okEmail(v)){toast("Проверьте почту: в ней должны быть @ и точка");return}
      busy(b,true);try{await api.auth("otp",{email:v,create_user:true});a.email=v;a.step="email-code";render()}
      catch(e){busy(b,false);toast(e.status===429?"Код уже отправлен. Подождите минуту и попробуйте снова":"Не удалось отправить письмо. Попробуйте позже")}};
  }else if(a.step==="email-code"){
    view.innerHTML=`<h1>Введите код из письма</h1><p class="muted">Отправили на <b>${esc(a.email)}</b>. Если письма нет, проверьте папку «Спам».</p>
      <form class="card" id="f"><label for="oc">Код<br>${codeInput("oc",10)}</label>
      <button class="btn" type="submit">Подтвердить</button></form>
      <button class="btn ghost" id="back" type="button">Изменить почту</button>`;
    $("#back").onclick=()=>{a.step="email";render()};
    $("#f").onsubmit=async e=>{e.preventDefault();const code=$("#oc").value.replace(/\D/g,""),b=$("#f button");
      if(code.length<6){toast("Впишите все цифры из письма");return}
      busy(b,true);
      try{api.setS(await api.auth("verify",{type:"email",email:a.email,token:code}))}
      catch(e){busy(b,false);toast(e.status===429?"Слишком много попыток. Подождите пару минут":"Код не подошёл или устарел. Проверьте цифры");return}
      try{await api.rpc("link_email");await finishLogin()}
      catch(e){busy(b,false);
        if(e.status===401||e.status===403||/Telegram/.test(e.message||"")){try{await api.auth("logout",{},api.s&&api.s.a)}catch(x){}api.setS(null);a.step="start";render()}
        toast(errText(e))}};
  }else if(a.step==="name"&&a.prof){
    const u=a.prof;
    view.innerHTML=`<h1>Как вас зовут?</h1><p class="muted">Имя увидят водители и пассажиры в чате.</p>
      <form class="card" id="f"><label for="name">Имя<input id="name" autocomplete="given-name" required value="${esc(a.gname||"")}"></label>
      <button class="btn" type="submit">Дальше</button></form>`;
    $("#f").onsubmit=async e=>{e.preventDefault();const n=clip($("#name").value,60).trim(),b=$("#f button");if(!n){toast("Впишите имя");return}
      busy(b,true);try{await api.patch("profiles?id=eq."+u.id,{name:n});u.name=n;trk("register",{method:a.google?"google":"email"});if(u.tg||a.google)enterLive(u);else{a.step="linktg";render()}}
      catch(e){busy(b,false);toast(errText(e))}};
  }else if(a.step==="linktg"&&a.prof){
    const u=a.prof;
    view.innerHTML=`<h1>Последний шаг: Telegram</h1>
      <p class="muted">Почта подтверждена. Теперь подключите Telegram: при каждом входе бот будет присылать туда код. Так в ваш аккаунт не войдёт никто, даже если узнает почту.</p>
      <div class="card"><button class="btn" id="tgl" type="button">Подключить Telegram</button>
      <p class="small muted">Бот попросит поделиться номером телефона. Номер увидит только тот, с кем у вас будет бронь.</p></div>
      <button class="btn ghost" id="later" type="button">Позже</button>`;
    $("#tgl").onclick=()=>tgLinkSheet($("#tgl"),()=>finishLogin().catch(e=>toast(errText(e))));
    $("#later").onclick=()=>{enterLive(u);toast("Пока Telegram не подключён, входите кодом из письма")};
  }else{
    view.innerHTML=`<h1>Вход</h1>
      <p class="muted">Попутчики, посылки и перевозка машин по всей Европе. Бесплатно и без пароля: код для входа придёт в Telegram.</p>
      <form class="card" id="f"><label for="em">Почта, с которой вы регистрировались<input id="em" type="email" inputmode="email" autocomplete="email" required value="${esc(a.email||"")}"></label>
      <button class="btn" type="submit">Получить код в Telegram</button></form>
      <div class="card"><p class="small muted" style="margin:0">Нет Telegram? Войдите через Google. Подходит и для первого входа: аккаунт создастся сам.</p><button class="btn ghost" id="gg" type="button">Войти через Google</button></div>
      <div class="card"><p class="small muted" style="margin:0">Впервые здесь?</p><button class="btn ghost" id="reg" type="button">Зарегистрироваться по почте</button></div>
      <button class="btn ghost sm" id="priv" type="button">Конфиденциальность</button>`;
    $("#priv").onclick=privacySheet;
    $("#gg").onclick=()=>googleStart($("#gg"));
    $("#reg").onclick=()=>{a.mode="reg";a.step="email";render()};
    $("#f").onsubmit=e=>{e.preventDefault();const v=clip($("#em").value,200).trim().toLowerCase();
      if(!okEmail(v)){toast("Проверьте почту: в ней должны быть @ и точка");return}
      a.email=v;sendTgCode($("#f button"))};
  }
}

/* ---------- Рабочий режим: загрузка данных с сервера ---------- */
const num=v=>Number.isFinite(+v)&&+v>=0?+v:0;
const okPt=p=>p&&typeof p==="object"&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)?{name:clip(p.name,120),lat:+p.lat,lon:+p.lon}:null;
const pname=id=>{const P=live.people[id];if(!P)return "Пользователь";const x=P.extra||{};return clip(x.ltype==="company"&&x.cname?x.cname:P.name,100)||"Пользователь"};
function routeFromRow(x){const d=x.data||{},caps={},prices={};
  Object.keys(KINDS).forEach(k=>{if(x.caps&&x.caps[k]!=null){caps[k]=num(x.caps[k]);prices[k]=num(d.prices&&d.prices[k])}});
  const from=okPt(d.from),to=okPt(d.to),m=d.meet&&typeof d.meet==="object"?d.meet:null;
  return {id:x.id,owner:x.owner,mine:!!state.user&&x.owner===state.user.id,from,to,at:Date.parse(x.at),caps,prices,driver:clip(d.driver,100)||"Водитель",
    vehicle:clip(d.vehicle,80),note:clip(d.note,300),vt:VT[d.vt]?d.vt:null,carrier:d.carrier==="bus"?"bus":"private",hasPhoto:!!x.has_photo,photo:live.photos[x.id]||null,
    meet:m?{city:clip(m.city,80),street:clip(m.street,120),lat:Number.isFinite(+m.lat)?+m.lat:from.lat,lon:Number.isFinite(+m.lon)?+m.lon:from.lon}:null}}
function reqFromRow(x){const d=x.data||{};return {id:x.id,owner:x.owner,mine:!!state.user&&x.owner===state.user.id,from:okPt(d.from),to:okPt(d.to),at:Date.parse(x.at),
  name:clip(d.name,100)||"Пользователь",people:Math.min(9,Math.max(1,Math.round(num(d.people))||1)),kind:WANT[d.kind]?d.kind:"seat",note:clip(d.note,300)}}
async function loadPeople(ids){
  const need=[...new Set(ids)].filter(id=>id&&!live.people[id]);
  for(let i=0;i<need.length;i+=80){const rows=await api.get("profiles?select=id,name,verified,phone_ok,extra,created_at&id=in.("+need.slice(i,i+80).join(",")+")");
    rows.forEach(p=>{live.people[p.id]=p})}
  live.byName={};Object.keys(live.people).forEach(id=>{live.byName[pname(id)]=live.people[id]});
}
async function loadPhotos(rs){
  const need=rs.filter(r=>r.has_photo&&!(r.id in live.photos)).map(r=>r.id);
  for(let i=0;i<need.length;i+=10){const rows=await api.get("routes?select=id,photo&id=in.("+need.slice(i,i+10).join(",")+")");rows.forEach(r=>{live.photos[r.id]=safeImg(r.photo)||null})}
}
function buildChats(ms){const me=state.user.id,map={},old={};state.chats.forEach(c=>old[c.id]=c);
  for(const m of ms){const out=m.sender===me,peer=out?m.recipient:m.sender,key=(m.route_id||"")+"|"+(m.request_id||"")+"|"+peer;
    const c=map[key]||(map[key]={id:key,route:m.route_id,req:m.request_id,peer,with:pname(peer),title:"",msgs:[],unread:0,unreadIds:[],last:0,draft:old[key]&&old[key].draft||""});
    const t=Date.parse(m.created_at);c.msgs.push({me:out,text:clip(m.body,1000),t});c.last=t;if(m.title)c.title=clip(m.title,200);
    if(!out&&!m.read_at){c.unread++;c.unreadIds.push(m.id)}}
  const local=state.chats.filter(c=>!c.msgs.length&&!map[c.id]);
  state.chats=[...local,...Object.values(map).sort((a,b)=>b.last-a.last)];
}
async function loadMsgs(){
  const ms=(await api.get("messages?select=id,sender,recipient,route_id,request_id,title,body,read_at,created_at&order=created_at.desc&limit=1000")).reverse();
  await loadPeople(ms.map(m=>m.sender===state.user.id?m.recipient:m.sender));buildChats(ms);
}
async function loadAll(){
  const iso=t=>new Date(t).toISOString();
  const [rs,qs,bs,rv]=await Promise.all([
    api.get("routes?select=id,owner,at,caps,data,has_photo&at=gte."+iso(Date.now()-2*H)+"&order=at.asc&limit=500"),
    api.get("requests?select=id,owner,at,data&at=gte."+iso(Date.now()-24*H)+"&order=at.asc&limit=500"),
    api.get("bookings?select=*&order=created_at.desc&limit=200"),
    api.get("reviews?select=id,booking_id,author_name,target,target_name,stars,body,created_at&order=created_at.desc&limit=1000")]);
  await loadPeople([...rs.map(r=>r.owner),...qs.map(q=>q.owner),...rv.map(r=>r.target)]);
  await loadPhotos(rs);
  state.routes=rs.map(routeFromRow).filter(r=>r.from&&r.to);
  state.requests=qs.map(reqFromRow).filter(q=>q.from&&q.to);
  state.reviews=rv.map(r=>({to:r.target_name,who:r.author_name,stars:Math.min(5,Math.max(1,r.stars|0)),text:clip(r.body,1000),t:Date.parse(r.created_at),booking:r.booking_id}));
  const me=state.user.id;
  state.bookings=bs.map(b=>{const d=b.data||{};return {id:b.id,route:b.route_id,title:clip(d.title,200),kind:b.kind,qty:b.qty,cost:num(d.cost),at:Date.parse(d.at),
    driver:clip(d.driver,100),passenger:clip(d.passenger,100),asDriver:b.driver===me,reviewed:state.reviews.some(r=>r.booking===b.id)}});
  await loadMsgs();
}
/* Обновление: чат каждые 5 секунд, когда он открыт; остальное раз в минуту */
async function syncLive(full){
  if(!state.user||document.hidden)return;
  try{if(full)await loadAll();else await loadMsgs()}catch(e){if(e.status===401||e.status===403)liveLogout(true);return}
  updateBadge();
  if(state.tab!=="chats"||$(".scrim"))return;
  const sig=state.chats.map(c=>c.id+":"+c.msgs.length+":"+c.unread).join();if(sig===live.sig)return;live.sig=sig;
  if(state.openChat){const c=state.chats.find(x=>x.id===state.openChat);if(!c)return;const ci=$("#ci"),f=document.activeElement===ci;c.draft=ci?ci.value:c.draft;renderChat(c);if(f&&$("#ci"))$("#ci").focus()}
  else renderChats();
}
async function startLive(){
  try{const p=await api.rpc("my_profile");if(!p||!p.id)return liveLogout(true);Object.assign(state.user,userFromProfile(p));save();await loadAll()}
  catch(e){if(e.status===401||e.status===403)return liveLogout(true);toast("Нет связи с сервером. Данные обновятся позже")}
  render();
  clearInterval(live.tick);live.n=0;
  live.tick=setInterval(()=>{live.n++;if(live.n%12===0)syncLive(true);else if(state.tab==="chats"||live.n%3===0)syncLive(false)},5000);
}
async function liveLogout(expired,msg){
  clearInterval(live.tick);stopTgPoll();
  if(!expired){trk("logout");await trkFlush();try{await api.del("sessions?uid=not.is.null")}catch(e){}try{if(api.s)await api.auth("logout",{},api.s.a)}catch(e){}}
  api.setS(null);Object.assign(live,{people:{},byName:{},photos:{},sig:""});
  Object.assign(state,{user:null,routes:[],requests:[],chats:[],bookings:[],reviews:[],openChat:null,auth:{step:"start"}});save();render();
  if(msg||expired)toast(msg||"Сессия закончилась, войдите ещё раз");
}
const liveFail=e=>{toast(errText(e));return null};

/* ---------- Карта ---------- */
let mapCtx=null;
function buildMap(box,opts){
  const W=box.clientWidth,Hh=box.clientHeight;
  const svg=d3.select(box).append("svg").attr("viewBox",`0 0 ${W} ${Hh}`).attr("role","img").attr("aria-label","Карта Европы с маршрутами");
  const proj=d3.geoMercator().fitExtent([[10,10],[W-10,Hh-10]],{type:"MultiPoint",coordinates:opts.fit||[[-2,38],[31,54]]});
  const path=d3.geoPath(proj);
  const g=svg.append("g");
  const feats=window.EU_MAP.map(c=>({type:"Feature",properties:{n:c.n},geometry:{type:"MultiPolygon",coordinates:c.c}}));
  g.append("g").selectAll("path").data(feats).join("path").attr("class",d=>"country"+(d.properties.n==="Moldova"?" md":"")).attr("d",path);
  if(window.EU_ROADS){
    const ds=["","",""];
    for(const r of window.EU_ROADS){let x=r[1],y=r[2],p=proj([x/100,y/100]),d="M"+p[0].toFixed(1)+","+p[1].toFixed(1);
      for(let i=3;i<r.length;i+=2){x+=r[i];y+=r[i+1];p=proj([x/100,y/100]);d+="L"+p[0].toFixed(1)+","+p[1].toFixed(1)}ds[r[0]]+=d}
    [2,1,0].forEach(c=>g.append("path").attr("class","road r"+c).attr("d",ds[c]));
  }
  const lr=g.append("g"), lc=g.append("g");
  (window.EU_PLACES||[]).forEach(([n,lat,lon,rk])=>{const [x,y]=proj([lon,lat]),cl="c"+rk;
    lc.append("circle").attr("class","cdot scl "+cl).attr("data-r",rk===0?3.5:2.8).attr("r",rk===0?3.5:2.8).attr("cx",x).attr("cy",y);
    lc.append("text").attr("class","clbl "+cl).attr("data-x",x).attr("data-y",y).attr("data-dx",5).attr("data-dy",3.5).attr("data-fs",rk===0?11:10).attr("x",x+5).attr("y",y+3.5).style("font-size",(rk===0?11:10)+"px").style("stroke-width","2.5px").text(n);
    lc.append("circle").attr("class","chit scl "+cl).attr("data-r",11).attr("r",11).attr("cx",x).attr("cy",y)
      .on("click",e=>{e.stopPropagation();opts.onCity&&opts.onCity({name:n,lat,lon})});
  });
  const lp=g.append("g"), ll=g.append("g");
  let k=1;
  const zoom=d3.zoom().scaleExtent([1,40]).translateExtent([[-W*.5,-Hh*.5],[W*1.5,Hh*1.5]]).on("zoom",e=>{g.attr("transform",e.transform);k=e.transform.k;g.selectAll(".scl").attr("r",function(){return +this.dataset.r/k});
    g.selectAll("text[data-x]").each(function(){const d=this.dataset;this.style.fontSize=(+(d.fs||11))/k+"px";this.style.strokeWidth=(d.fs?2.5:3)/k+"px";this.setAttribute("x",+d.x+(+(d.dx||10))/k);this.setAttribute("y",+d.y+(+(d.dy||-8))/k)});
    g.selectAll(".sclg").attr("transform",function(){return `translate(${this.dataset.x},${this.dataset.y}) scale(${1/k})`});
    svg.classed("z1",k>=1.7).classed("z2",k>=3).classed("z3",k>=5)});
  svg.call(zoom).on("dblclick.zoom",null);
  svg.on("click",e=>{if(e.defaultPrevented)return;const [x,y]=d3.zoomTransform(svg.node()).invert(d3.pointer(e));const ll_=proj.invert([x,y]);opts.onPick&&opts.onPick(ll_[1],ll_[0])});
  const xy=p=>proj([p.lon,p.lat]);
  return {svg,g,lr,lp,ll,xy,zoom,get k(){return k},zoomBy:f=>svg.transition().duration(250).call(zoom.scaleBy,f),
    focus(points,mz){if(!points.length)return;const pts=points.map(xy);const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
      const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const s=Math.min(mz?30:8,0.6/Math.max((x1-x0)/W,(y1-y0)/Hh,0.08));
      svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity.translate(W/2,Hh/2).scale(s).translate(-(x0+x1)/2-(x1-x0)*0.06,-(y0+y1)/2))}};
}
function arcPath(m,a,b){const p=m.xy(a),q=m.xy(b);const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,dx=q[0]-p[0],dy=q[1]-p[1];const c=[mx-dy*.18,my+dx*.18];return `M${p[0]},${p[1]}Q${c[0]},${c[1]} ${q[0]},${q[1]}`}
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function mainKind(r){return r.caps.car?"car":r.caps.drive?"drive":r.caps.seat?"seat":"parcel"}
const VT={car:{t:"Личный автомобиль",s:"Личный авто",ph:"Toyota Corolla, 4 места"},bus:{t:"Маршрутный автобус",s:"Автобус",ph:"Setra, 50 мест"},minibus:{t:"Маршрутный микроавтобус",s:"Микроавтобус",ph:"Mercedes Sprinter, 18 мест"},
  tow:{t:"Эвакуатор",s:"Эвакуатор",ph:"Эвакуатор-платформа, 1 авто"},trailer:{t:"Трал",s:"Трал",ph:"Трал на 2 машины"},truck:{t:"Грузовик",s:"Грузовик",ph:"MAN, тент 20 т"},moto:{t:"Мотоцикл",s:"Мотоцикл",ph:"Honda Africa Twin"},plane:{t:"Самолёт",s:"Самолёт",ph:"Рейс Милан – Кишинёв"}};
const isBus=r=>r.vt==="bus"||r.vt==="minibus";
const carrierName=r=>r.vt&&VT[r.vt]?VT[r.vt].t:r.caps.drive?"Едет без машины, пригонит вашу":"Частный водитель";
function hubPoints(list){const m={};
  const add=(p,t,r)=>{const key=t+":"+p.name;const h=m[key]||(m[key]={t,name:p.name,lat:p.lat,lon:p.lon,n:0});h.n++};
  list.forEach(r=>{add(r.from,"dep",r);add(r.to,"arr",r)});
  const v=Object.values(m);v.forEach(h=>{h.both=!!m[(h.t==="dep"?"arr":"dep")+":"+h.name]});return v}
function drawPin(m,p,label,fill){
  m.lp.append("circle").attr("class","scl").attr("data-r",8).attr("r",8/m.k).attr("cx",m.xy(p)[0]).attr("cy",m.xy(p)[1]).attr("fill",fill).attr("stroke",css("--surface")).attr("stroke-width",2).attr("vector-effect","non-scaling-stroke");
  const [x,y]=m.xy(p);m.ll.append("text").attr("class","city-lbl").attr("data-x",x).attr("data-y",y).attr("x",x+10/m.k).attr("y",y-8/m.k).style("font-size",11/m.k+"px").style("stroke-width",3/m.k+"px").text(label);
}

/* Подробная карта: OpenStreetMap через MapLibre и OpenFreeMap. Пока она грузится, показываем «Загружаем карту»; встроенная схема только если загрузить не удалось */
/* Версия MapLibre записана ещё и в CSP в index.html (script-src и style-src): при обновлении поменяйте её и там */
const GL={on:false,failed:false,style:"https://tiles.openfreemap.org/styles/liberty",ver:"4.7.1",
  /* Отпечатки файлов MapLibre 4.7.1: если CDN подменит файл, браузер его не запустит */
  js:"sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj",css:"sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V"};
let curGL=null;const GLVIEW={};
/* Ключ Geoapify (бесплатно 3000 запросов в день, коммерческое использование разрешено): поиск адресов и маршруты по дорогам.
   Пустой ключ: маршруты считает демо-сервер OSRM, адрес ищется в Nominatim только по кнопке «Найти» (подсказки при наборе их правила запрещают) */
const GEO_KEY="";
const geoUrl=(path,q)=>`https://api.geoapify.com/v1/${path}?${new URLSearchParams({...q,apiKey:GEO_KEY})}`;
const reMapTabs=()=>{if(state.user&&(state.tab==="map"||state.tab==="publish"))render(true)};
function glFail(){if(GL.on||GL.failed)return;GL.failed=true;reMapTabs()}
function probeRealMap(){
  const ctl=new AbortController();setTimeout(()=>ctl.abort(),10000);setTimeout(glFail,20000);
  fetch(GL.style,{signal:ctl.signal}).then(r=>{if(!r.ok)throw 0;
    const l=document.createElement("link");l.rel="stylesheet";l.href=`https://unpkg.com/maplibre-gl@${GL.ver}/dist/maplibre-gl.css`;l.integrity=GL.css;l.crossOrigin="anonymous";document.head.appendChild(l);
    const sc=document.createElement("script");sc.src=`https://unpkg.com/maplibre-gl@${GL.ver}/dist/maplibre-gl.js`;sc.integrity=GL.js;sc.crossOrigin="anonymous";
    sc.onload=()=>{if(!window.maplibregl)return glFail();GL.on=true;reMapTabs()};sc.onerror=glFail;
    document.head.appendChild(sc);
  }).catch(glFail);
}
function arcCoords(a,b){const n=40,dx=b.lon-a.lon,dy=b.lat-a.lat,c=[(a.lon+b.lon)/2+dy*.18,(a.lat+b.lat)/2-dx*.18],out=[];
  for(let i=0;i<=n;i++){const t=i/n,u=1-t;out.push([u*u*a.lon+2*u*t*c[0]+t*t*b.lon,u*u*a.lat+2*u*t*c[1]+t*t*b.lat])}return out}
function glMap(box,opts){
  if(curGL){curGL.remove();curGL=null}
  const el=document.createElement("div");el.style.cssText="position:absolute;inset:0";box.prepend(el);
  const vk=state.tab,v0=GLVIEW[vk]||{center:[17,47],zoom:3.2};
  const map=new maplibregl.Map({container:el,style:GL.style,center:v0.center,zoom:v0.zoom,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false});
  map.touchZoomRotate.disableRotation();curGL=map;
  map.on("moveend",()=>{if(curGL===map)GLVIEW[vk]={center:map.getCenter().toArray(),zoom:map.getZoom()}});
  let loaded=false,items=[];const q=[];const ready=f=>loaded?f():q.push(f);
  map.on("load",()=>{loaded=true;
    map.addSource("ourcities",{type:"geojson",data:{type:"FeatureCollection",features:(window.EU_PLACES||[]).map(([n,lat,lon,rk])=>({type:"Feature",properties:{name:n,rk},geometry:{type:"Point",coordinates:[lon,lat]}}))}});
    map.addLayer({id:"ourcities",type:"circle",source:"ourcities",filter:["<=",["get","rk"],["step",["zoom"],-1,4.5,0,5.5,1,6.5,2,7.5,3]],paint:{"circle-radius":4,"circle-color":"#ffffff","circle-stroke-color":"#1E2A39","circle-stroke-width":1.5}});
    q.splice(0).forEach(f=>f())});
  const fc=fs=>({type:"FeatureCollection",features:fs});
  const set=(id,data,layers)=>{const src=map.getSource(id);if(src){src.setData(data);return}map.addSource(id,{type:"geojson",data});layers.forEach(l=>{try{map.addLayer({...l,source:id})}catch(e){console.error("layer "+l.id+": "+e.message)}})};
  map.on("click",e=>{
    const box=[[e.point.x-8,e.point.y-8],[e.point.x+8,e.point.y+8]];
    const cf=map.getLayer("ourcities")?map.queryRenderedFeatures(box,{layers:["ourcities"]}):[];
    if(cf.length&&opts.onCity){const c=cf[0];opts.onCity({name:c.properties.name,lat:c.geometry.coordinates[1],lon:c.geometry.coordinates[0]});return}
    const hf=map.getLayer("hub-dep")?map.queryRenderedFeatures(box,{layers:["hub-dep","hub-arr"]}):[];
    if(hf.length&&opts.onHub){const h=hf[0];opts.onHub({t:h.properties.t,name:h.properties.name,lat:h.geometry.coordinates[1],lon:h.geometry.coordinates[0]});return}
    const ls=["routes"].filter(l=>map.getLayer(l));
    const f=ls.length&&!opts.picking()?map.queryRenderedFeatures(box,{layers:ls}).filter(x=>x.properties.shown):[];
    if(f.length){opts.onSelect&&opts.onSelect(f[0].properties.id);return}
    opts.onPick&&opts.onPick(e.lngLat.lat,e.lngLat.lng);
  });
  const api={
    routes(list){items=list;ready(()=>{
      set("routes",fc(list.map(x=>({type:"Feature",properties:{id:x.r.id,col:x.col,shown:x.shown,sel:x.r.id===state.sel},geometry:{type:"LineString",coordinates:arcCoords(x.r.from,x.r.to)}}))),
        [{id:"routes",type:"line",layout:{"line-cap":"round"},paint:{"line-color":["get","col"],"line-width":["case",["get","sel"],5,2.5],"line-opacity":["case",["get","shown"],.9,.15]}}]);
    })},
    waits(ws,busy){ws.forEach(h=>{const d=document.createElement("div");d.className="glwait";d.setAttribute("role","button");d.setAttribute("aria-label","Ждут транспорт: "+h.name);d.innerHTML=`<i></i><b>${esc(h.people)}</b>`;
      d.addEventListener("click",e=>{e.stopPropagation();opts.onWait&&opts.onWait(h)});
      new maplibregl.Marker({element:d,offset:[0,busy.has(h.name)?-22:0]}).setLngLat([h.lon,h.lat]).addTo(map)})},
    points(hs){ready(()=>{
      const data=fc(hs.map(h=>({type:"Feature",properties:{t:h.t,name:h.name,n:h.n},geometry:{type:"Point",coordinates:[h.lon,h.lat]}})));
      const lay=(t,dx)=>({id:"hub-"+t,type:"circle",filter:["==",["get","t"],t],paint:{"circle-radius":["+",8,["min",["get","n"],6]],"circle-color":css(t==="dep"?"--dep":"--arr"),"circle-stroke-width":2,"circle-stroke-color":"#ffffff","circle-translate":[dx,0]}});
      const lbl=(t,dx)=>({id:"hubn-"+t,type:"symbol",filter:["==",["get","t"],t],layout:{"text-field":["to-string",["get","n"]],"text-font":["Noto Sans Bold"],"text-size":11,"text-allow-overlap":true},paint:{"text-color":"#ffffff","text-translate":[dx,0]}});
      set("hubs",data,[lay("dep",-8),lay("arr",8)]);
      set("hubsn",data,[lbl("dep",-8),lbl("arr",8)]);
    })},
    select(){api.routes(items)},
    pin(p,label,color){const d=document.createElement("div");d.className="glpin";d.dataset.lbl=label;d.innerHTML=`<i style="background:${color}"></i><span>${esc(label)}</span>`;new maplibregl.Marker({element:d,anchor:"left",offset:[-8,0]}).setLngLat([p.lon,p.lat]).addTo(map)},
    line(a,b,col){ready(()=>set("draft",{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:arcCoords(a,b)}},[{id:"draft",type:"line",paint:{"line-color":col,"line-width":4,"line-dasharray":[2,1.5]}}]))},
    road(geo){ready(()=>set("road",geo?{type:"Feature",properties:{},geometry:geo}:fc([]),[{id:"road",type:"line",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":css("--accent"),"line-width":5,"line-opacity":.95}}]))},
    focus(points,mz){ready(()=>{const b=new maplibregl.LngLatBounds();points.forEach(p=>b.extend([p.lon,p.lat]));map.fitBounds(b,{padding:{top:60,bottom:40,left:50,right:110},maxZoom:mz||9,duration:500})})},
    zoomBy(f){map.easeTo({zoom:map.getZoom()+Math.log2(f),duration:250})}
  };
  return api;
}
function svgMap(box,opts){
  const m=buildMap(box,opts);
  return {
    routes(list){list.forEach(x=>{
      m.lr.append("path").attr("class","route"+(x.shown?"":" dim")+(state.sel===x.r.id?" sel":"")).attr("data-id",x.r.id).attr("d",arcPath(m,x.r.from,x.r.to)).attr("stroke",x.col)
        .on("click",e=>{e.stopPropagation();if(x.shown)opts.onSelect&&opts.onSelect(x.r.id)});
    })},
    waits(ws,busy){ws.forEach(h=>{const [x,y]=m.xy(h),dy=busy.has(h.name)?-20:0;
      const gg=m.lp.append("g").attr("class","hub wait sclg").attr("data-x",x).attr("data-y",y).attr("transform",`translate(${x},${y}) scale(${1/m.k})`)
        .attr("role","button").attr("aria-label","Ждут транспорт: "+h.name+", человек: "+h.people).on("click",e=>{e.stopPropagation();opts.onWait&&opts.onWait(h)});
      gg.append("circle").attr("class","ring").attr("cy",dy).attr("r",10);
      gg.append("circle").attr("class","core").attr("cy",dy).attr("r",10).attr("stroke",css("--surface")).attr("stroke-width",2);
      gg.append("text").attr("y",dy).text(h.people);
    })},
    points(hs){hs.forEach(h=>{const [x,y]=m.xy(h),dx=h.both?(h.t==="dep"?-8:8):0,r=8+Math.min(h.n,6);
      const gg=m.lp.append("g").attr("class","hub sclg").attr("data-x",x).attr("data-y",y).attr("transform",`translate(${x},${y}) scale(${1/m.k})`)
        .attr("role","button").attr("aria-label",(h.t==="dep"?"Отправление: ":"Прибытие: ")+h.name+", поездок: "+h.n)
        .on("click",e=>{e.stopPropagation();opts.onHub&&opts.onHub(h)});
      gg.append("circle").attr("cx",dx).attr("r",r).attr("fill",css(h.t==="dep"?"--dep":"--arr")).attr("stroke",css("--surface")).attr("stroke-width",2);
      gg.append("text").attr("x",dx).attr("y",0).text(h.n);
    })},
    select(id){m.lr.selectAll("path").classed("sel",function(){return this.dataset.id===id});m.lr.selectAll("path").filter(function(){return this.dataset.id===id}).raise()},
    pin(p,label,color){drawPin(m,p,label,color)},
    line(a,b,col){m.lr.append("path").attr("class","route sel").attr("d",arcPath(m,a,b)).attr("stroke",col)},
    road(){},focus:m.focus,zoomBy:m.zoomBy
  };
}
function waitMap(box){box.insertAdjacentHTML("afterbegin",`<div class="maploading" role="status">Загружаем подробную карту…</div>`);
  const noop=()=>{};return {routes:noop,waits:noop,points:noop,select:noop,pin:noop,line:noop,road:noop,focus:noop,zoomBy:noop}}
const makeMap=(box,opts)=>GL.on?glMap(box,opts):GL.failed?svgMap(box,opts):waitMap(box);
const mapNote=()=>GL.on?`Карта © OpenStreetMap, OpenFreeMap. Маршрут по дорогам считает ${GEO_KEY?"Geoapify":"OSRM"}.`:!GL.failed?"Загружаем подробную карту OpenStreetMap…":"Карта дорог Европы: трассы, шоссе и основные дороги (Natural Earth). Приближайте, чтобы увидеть больше дорог и городов. Полная карта всех улиц OpenStreetMap работает в версии на сайте.";

/* Поиск мест и маршрутов по дорогам */
const roadCache={};
async function roadRoute(r){
  if(roadCache[r.id])return roadCache[r.id];
  if(GEO_KEY){const j=await (await fetch(geoUrl("routing",{waypoints:`${r.from.lat},${r.from.lon}|${r.to.lat},${r.to.lon}`,mode:"drive"}))).json();
    const f=j.features&&j.features[0];if(!f)throw new Error("no route");
    return roadCache[r.id]={geo:f.geometry,km:Math.round(f.properties.distance/1000),h:f.properties.time/3600}}
  const j=await (await fetch(`https://router.project-osrm.org/route/v1/driving/${r.from.lon},${r.from.lat};${r.to.lon},${r.to.lat}?overview=simplified&geometries=geojson`)).json();
  if(!j.routes||!j.routes[0])throw new Error("no route");
  return roadCache[r.id]={geo:j.routes[0].geometry,km:Math.round(j.routes[0].distance/1000),h:j.routes[0].duration/3600};
}
async function geoRev(lat,lon){const j=await (await fetch(geoUrl("geocode/reverse",{lat,lon,lang:"ru",format:"json"}))).json();return (j.results||[])[0]||{}}
async function revGeo(lat,lon){if(GEO_KEY)try{const a=await geoRev(lat,lon),n=a.city||a.village||a.municipality||a.county||a.state;return n?n+(a.country?", "+a.country:""):null}catch(e){return null}
  try{const j=await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=ru`)).json();
  const a=j.address||{},n=a.city||a.town||a.village||a.municipality||a.county||a.state;return n?n+(a.country?", "+a.country:""):null}catch(e){return null}}
async function revStreet(lat,lon){if(GEO_KEY)try{const a=await geoRev(lat,lon);return {city:a.city||a.village||"",street:[a.street,a.housenumber].filter(Boolean).join(", ")}}catch(e){return null}
  try{const j=await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&accept-language=ru`)).json();
  const a=j.address||{};return {city:a.city||a.town||a.village||"",street:[a.road||a.pedestrian||a.square,a.house_number].filter(Boolean).join(", ")}}catch(e){return null}}
function setPlace(obj,p,rer){const k=obj.pick||"A";trk("search",{field:k==="A"?"откуда":"куда",city:p&&p.name,where:obj===state?"карта":"я еду"});obj[k]=p;obj.pick=k==="A"&&!obj.B?"B":null;if(obj===state)state.sel=null;rer()}
function nearestPlace(lat,lon){let best=null,bd=1e9;for(const o of placeIdx()){const d=dist([lat,lon],[o.lat,o.lon]);if(d<bd){bd=d;best=o}}return{o:best,d:bd}}
/* Меняет подпись точки на месте, не перерисовывая экран и карту (иначе карта мигает и страница прыгает) */
function renamePoint(obj,k,p,nm,rer){const old=p.name;p.name=nm;
  const btn=$((obj===state?"#p":"#q")+k+" span");if(!btn)return rer();btn.textContent=nm;
  $$(".glpin").forEach(d=>{const l=d.dataset.lbl||"";if(l.endsWith(" · "+old)){d.dataset.lbl=l.slice(0,-old.length)+nm;d.querySelector("span").textContent=d.dataset.lbl}});
  if(obj===state.pub&&k==="A"&&obj.cityFor===old){const c=$("#pcity"),was=old.replace(/^Точка у /,"").split(",")[0],now=nm.split(",")[0];
    if(c&&c.value===was)c.value=now;if(obj.form&&obj.form.pcity===was)obj.form.pcity=now;obj.cityFor=nm}
  save()}
function setPoint(obj,lat,lon,rer){
  const n=nearestCity(lat,lon),snap=GL.on?25:120,k=obj.pick;
  const np=n.d<snap?null:nearestPlace(lat,lon);
  const p=n.d<snap?place(n.name):{name:"Точка у "+(np&&np.o&&np.d<n.d?np.o.name:n.name),lat,lon};
  setPlace(obj,p,rer);
  if(GL.on&&n.d>=snap)revGeo(lat,lon).then(nm=>{if(nm&&obj[k]===p)renamePoint(obj,k,p,nm,rer)});
}
function searchForm(obj){return obj.pick?`<form class="searchwrap" id="sq"><div class="searchrow"><input id="q" autocomplete="off" autocapitalize="words" placeholder="${obj.pick==="A"?"Откуда: впишите город":"Куда: впишите город"}" aria-label="${obj.pick==="A"?"Город отправления":"Город назначения"}" aria-autocomplete="list" aria-controls="sugg"><button class="btn sm" type="submit">Найти</button></div><div class="sugg" id="sugg" role="listbox" aria-label="Подходящие города"></div></form>`:""}
const normTxt=s=>s.toLowerCase().replace(/ё/g,"е").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[-‐–—.,'’`()]/g," ").replace(/\s+/g," ").trim();
const TRL={а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",і:"i",ї:"i",є:"e",ґ:"g"};
const latTxt=s=>[...s].map(c=>TRL[c]??c).join("");
const CC_RU={MD:"Молдова",RO:"Румыния",UA:"Украина",IT:"Италия",DE:"Германия",FR:"Франция",ES:"Испания",PT:"Португалия",GB:"Великобритания",IE:"Ирландия",BE:"Бельгия",NL:"Нидерланды",LU:"Люксембург",CH:"Швейцария",AT:"Австрия",CZ:"Чехия",SK:"Словакия",PL:"Польша",HU:"Венгрия",BG:"Болгария",GR:"Греция",TR:"Турция",RS:"Сербия",HR:"Хорватия",SI:"Словения",BA:"Босния",ME:"Черногория",MK:"Сев. Македония",AL:"Албания",DK:"Дания",SE:"Швеция",NO:"Норвегия",FI:"Финляндия",EE:"Эстония",LV:"Латвия",LT:"Литва",BY:"Беларусь",RU:"Россия",CY:"Кипр",MT:"Мальта",IS:"Исландия",GE:"Грузия",AM:"Армения",AZ:"Азербайджан",KZ:"Казахстан"};
let PLACE_IDX=null;
function placeIdx(){if(PLACE_IDX)return PLACE_IDX;
  const out=[],add=(name,alts,lat,lon,cc)=>{const n=normTxt(name);
    const keys=new Set([n,latTxt(n)]);(alts||"").split("|").forEach(a=>{if(a){const k=normTxt(a);keys.add(k);keys.add(latTxt(k))}});
    const ex=out.find(o=>{const d=dist([o.lat,o.lon],[lat,lon]);return d<6||(o.n===n||o.keys.includes(n))&&d<40});
    if(ex){ex.keys=[...new Set([...ex.keys,...keys])];ex.cc=ex.cc||cc;return}
    out.push({name,lat,lon,cc,n,keys:[...keys]})};
  cityNames.forEach(c=>add(c,"",CITIES[c][0],CITIES[c][1],CITIES[c][2]));
  (window.EU_CITIES||[]).forEach(([n,a,la,lo,cc])=>add(n,a,la,lo,cc));
  (window.EU_PLACES||[]).forEach(([n,la,lo])=>add(n,"",la,lo,""));
  return PLACE_IDX=out}
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;let p=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[b.length]}
function findPlaces(q,max=8){const qn=normTxt(q);if(!qn)return[];const ql=latTxt(qn),tol=qn.length>=7?2:qn.length>=4?1:0;
  const res=[];placeIdx().forEach((o,i)=>{let best=9;
    for(const k of o.keys){for(const v of qn===ql?[qn]:[qn,ql]){
      const sc=k===v?0:k.startsWith(v)?1:k.includes(" "+v)?2:v.length>=3&&k.includes(v)?3:tol&&lev(v,k.slice(0,Math.max(v.length,k.length)))<=tol?4:9;
      if(sc<best)best=sc}}
    if(best<9)res.push([best,i,o])});
  res.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const good=res.filter(x=>x[0]<4);
  return (good.length?good:res).slice(0,max).map(x=>x[2])}
const placeLabel=o=>o.cc&&CC_RU[o.cc]?CC_RU[o.cc]:o.osm?"OpenStreetMap":"";
async function osmFind(v,typing){if(GEO_KEY)try{const j=await (await fetch(geoUrl(typing?"geocode/autocomplete":"geocode/search",{text:v,lang:"ru",limit:5,format:"json"}))).json();
  return (j.results||[]).map(x=>({name:x.name||x.city||x.address_line1,lat:+x.lat,lon:+x.lon,osm:true,cc:(x.country_code||"").toUpperCase(),sub:[x.city!==x.name&&x.city,x.country].filter(Boolean).join(", ")}))}catch(e){return[]}
  if(typing)return[];
  try{const j=await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ru&q=${encodeURIComponent(v)}`)).json();
  return j.map(x=>({name:x.display_name.split(",")[0].trim(),lat:+x.lat,lon:+x.lon,osm:true,cc:"",sub:x.display_name.split(",").slice(1,3).join(",").trim()}))}catch(e){return[]}}
function bindSearch(obj,rer){const f=$("#sq");if(!f)return;const q=$("#q"),box=$("#sugg");let cur=[],tm=0,seq=0;
  const pick=o=>setPlace(obj,{name:o.name,lat:o.lat,lon:o.lon},rer);
  const draw=()=>{box.innerHTML=cur.map((o,i)=>`<button type="button" role="option" data-i="${i}"><span>${esc(o.name)}</span><small>${esc(o.sub||placeLabel(o))}</small></button>`).join("");
    box.querySelectorAll("button").forEach(b=>b.onclick=()=>pick(cur[+b.dataset.i]))};
  q.oninput=()=>{const v=q.value.trim();cur=v?findPlaces(v):[];draw();clearTimeout(tm);
    if(GL.on&&GEO_KEY&&v.length>=3&&cur.length<4){const my=++seq;tm=setTimeout(async()=>{const r=await osmFind(v,true);if(my!==seq)return;
      r.forEach(o=>{if(!cur.some(c=>dist([c.lat,c.lon],[o.lat,o.lon])<15))cur.push(o)});cur=cur.slice(0,8);draw()},450)}};
  q.onkeydown=e=>{if(e.key==="ArrowDown"&&box.firstChild){e.preventDefault();box.firstChild.focus()}};
  box.onkeydown=e=>{const t=e.target;if(e.key==="ArrowDown"&&t.nextSibling){e.preventDefault();t.nextSibling.focus()}if(e.key==="ArrowUp"){e.preventDefault();(t.previousSibling||q).focus()}};
  f.onsubmit=async e=>{e.preventDefault();const v=q.value.trim();if(!v){q.focus();return}
    const loc=findPlaces(v,1);if(loc[0])return pick(loc[0]);
    if(GL.on){const r=await osmFind(v);if(r[0])return pick(r[0])}
    toast(`Не нашли «${v}». Проверьте написание или отметьте точку на карте`)}}

function matches(r){
  if(state.kind!=="all"&&!(r.caps[state.kind]>0))return false;
  if(state.vt!=="all"&&r.vt!==state.vt)return false;
  if(state.maxp!=null){const ks=state.kind!=="all"?[state.kind]:Object.keys(r.caps).filter(k=>r.caps[k]>0);if(!ks.some(k=>r.prices[k]!=null&&r.prices[k]<=state.maxp))return false}
  if(state.A&&dist([state.A.lat,state.A.lon],[r.from.lat,r.from.lon])>300)return false;
  if(state.B&&dist([state.B.lat,state.B.lon],[r.to.lat,r.to.lon])>300)return false;
  return r.at>Date.now()-H;
}
function renderMap(){
  const kinds=[["all","Все",null],...Object.entries(KINDS).map(([k,v])=>[k,v.t,v.color])];
  view.innerHTML=`
    <div class="pickbar">
      <button class="pick" id="pA" aria-pressed="${state.pick==="A"}"><small>Откуда</small><span>${state.A?esc(state.A.name):"Любой город"}</span></button>
      <button class="pick" id="pB" aria-pressed="${state.pick==="B"}"><small>Куда</small><span>${state.B?esc(state.B.name):"Любой город"}</span></button>
    </div>
    <div class="seg hscroll" id="vts" aria-label="Вид транспорта">${[["all","Любой транспорт"],...Object.entries(VT).map(([k,v])=>[k,v.s])].map(([k,t])=>`<button type="button" data-v="${k}" aria-pressed="${state.vt===k}">${t}</button>`).join("")}</div>
    <div class="seg" id="kinds">${kinds.map(([k,t,c])=>`<button type="button" data-k="${k}" aria-pressed="${state.kind===k}">${c?`<i class="dot" style="background:var(${c})"></i>`:""}${t}</button>`).join("")}</div>
    <label class="pricef" for="maxp">${state.kind==="all"?"Моя цена до, €":`Моя цена ${KINDS[state.kind].price} до, €`}<input id="maxp" type="number" inputmode="decimal" min="0" step="any" placeholder="любая" value="${state.maxp??""}"></label>
    ${searchForm(state)}
    <div class="mapbox ${state.pick?"picking":""}" id="mb">
      <div class="mapbar"><span class="pill" id="maphint"></span></div>
      <div class="zoom"><button type="button" id="zin" aria-label="Приблизить">+</button><button type="button" id="zout" aria-label="Отдалить">−</button></div>
    </div>
    <div class="legend"><span><i class="dot" style="background:var(--dep);width:12px;height:12px"></i>Отправление</span><span><i class="dot" style="background:var(--arr);width:12px;height:12px"></i>Прибытие</span><span><i class="dot" style="background:var(--wait);width:12px;height:12px"></i>Ждут транспорт</span><span>Цифра: сколько поездок или людей</span></div>
    <p class="small muted">${mapNote()}</p>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h2 id="cnt"></h2><button class="btn ghost sm" id="reset" type="button">Сбросить</button></div>
    <button class="btn ghost" id="wantbtn" type="button">Не нашли транспорт? Поставить точку ожидания</button>
    <p class="small muted">Цены ориентировочные. Окончательную цену вы согласуете с водителем во внутреннем чате.</p>
    <div class="list" id="offers"></div>
    ${shareCard()}`;
  const mb=$("#mb");
  const m=makeMap(mb,{picking:()=>!!state.pick,onCity:c=>{if(state.pick)setPlace(state,c,renderMap);else citySheet(c)},onWait:h=>{if(state.pick)setPlace(state,{name:h.name,lat:h.lat,lon:h.lon},renderMap);else waitSheet(h)},onHub:h=>{if(state.pick)setPlace(state,{name:h.name,lat:h.lat,lon:h.lon},renderMap);else citySheet(h,h.t==="dep"?"out":"in")},onSelect:id=>selectRoute(id),onPick:(lat,lon)=>{if(state.pick)setPoint(state,lat,lon,renderMap)}});
  mapCtx=m;
  const list=state.routes.filter(matches).sort((a,b)=>a.at-b.at);
  const shown=new Set(list.map(r=>r.id));
  m.routes(state.routes.filter(r=>r.at>Date.now()-H).map(r=>({r,col:css(KINDS[mainKind(r)].color),shown:shown.has(r.id)})));
  const hp=hubPoints(list);m.points(hp);m.waits(waitHubs(),new Set([...hp.map(h=>h.name),state.A&&state.A.name,state.B&&state.B.name]));
  if(state.A)m.pin(state.A,"А · "+state.A.name,css("--ink"));
  if(state.B)m.pin(state.B,"Б · "+state.B.name,css("--warn"));
  $("#maphint").textContent=state.pick==="A"?"Нажмите на карту: откуда едете или отправляете":state.pick==="B"?"Нажмите на карту: куда":"Нажмите на любую цветную точку";
  $("#cnt").textContent=list.length?`Ближайшие отправления: ${list.length}`:"Нет подходящих отправлений";
  $("#offers").innerHTML=list.length?list.map(offerCard).join(""):`<div class="card empty">По этому направлению пока никто не едет. Попробуйте другой город рядом или включите «Все» типы.</div>`;
  const focusPts=[state.A,state.B].filter(Boolean);
  if(focusPts.length===2)m.focus(focusPts);
  bindOffers();bindSearch(state,renderMap);$("#wantbtn").onclick=()=>newWaitSheet();bindShare();
  $("#pA").onclick=()=>{state.pick=state.pick==="A"?null:"A";renderMap()};
  $("#pB").onclick=()=>{state.pick=state.pick==="B"?null:"B";renderMap()};
  $$("#kinds button").forEach(b=>b.onclick=()=>{state.kind=b.dataset.k;state.sel=null;renderMap()});
  $$("#vts button").forEach(b=>b.onclick=()=>{state.vt=b.dataset.v;state.sel=null;renderMap()});
  {let tm=0;$("#maxp").oninput=e=>{clearTimeout(tm);tm=setTimeout(()=>{const v=e.target.value.trim();state.maxp=v===""?null:Math.max(0,+v);state.sel=null;renderMap();const el=$("#maxp");el.focus()},600)}}
  $("#zin").onclick=()=>m.zoomBy(1.6);$("#zout").onclick=()=>m.zoomBy(1/1.6);
  $("#reset").onclick=()=>{state.A=null;state.B=null;state.kind="all";state.vt="all";state.maxp=null;state.sel=null;state.pick=null;renderMap()};
}
function selectRoute(id){
  {const r=state.routes.find(x=>x.id===id);if(r&&state.sel!==id)trk("route_open",{route:r.from.name+" → "+r.to.name})}
  state.sel=id;mapCtx.select(id);
  $$(".offer").forEach(o=>o.classList.toggle("sel",o.dataset.id===id));
  const el=$(`.offer[data-id="${id}"]`);el&&el.scrollIntoView({behavior:"smooth",block:"center"});
  if(!GL.on)return;
  const r=state.routes.find(x=>x.id===id),info=()=>$(`.offer[data-id="${id}"] .roadinfo`);
  if(info())info().textContent="Строим маршрут по дорогам…";
  roadRoute(r).then(x=>{if(state.sel!==id)return;mapCtx.road(x.geo);if(info())info().textContent=`По дорогам: ${x.km} км, в пути ≈${Math.round(x.h)} ч`})
    .catch(()=>{if(info())info().textContent="Маршрут по дорогам сейчас не построить, попробуйте позже"});
}
function citySheet(c,side){
  const near=p=>dist([c.lat,c.lon],[p.lat,p.lon])<60,live=r=>r.at>Date.now()-H;
  const out=state.routes.filter(r=>live(r)&&near(r.from)).sort((a,b)=>a.at-b.at);
  const inn=state.routes.filter(r=>live(r)&&near(r.to)).sort((a,b)=>a.at-b.at);
  side=side||(out.length||!inn.length?"out":"in");
  const list=side==="out"?out:inn;
  const sum=a=>{const seats=a.reduce((x,r)=>x+(r.caps.seat||0),0),by={};a.forEach(r=>{const n=r.vt?VT[r.vt].s:"Перегон";by[n]=(by[n]||0)+1});
    return [...Object.entries(by).map(([n,c])=>n+": "+c),seats?seats+" своб. мест":""].filter(Boolean).join(" · ")||"нет поездок"};
  sheet(`<h2>${esc(c.name)}</h2>
    <div class="citysum"><button type="button" data-s="out" aria-pressed="${side==="out"}"><span class="small muted"><i class="dot" style="background:var(--dep)"></i> Выезжают отсюда</span><b>${out.length}</b><span class="small muted">${sum(out)}</span></button>
      <button type="button" data-s="in" aria-pressed="${side==="in"}"><span class="small muted"><i class="dot" style="background:var(--arr)"></i> Едут сюда</span><b>${inn.length}</b><span class="small muted">${sum(inn)}</span></button></div>
    <div class="list">${list.length?list.map(offerCard).join(""):`<p class="small muted">${side==="out"?"Отсюда пока никто не выезжает.":"Сюда пока никто не едет."} Попробуйте соседний город или опубликуйте свой маршрут.</p>`}</div>
    <div class="row"><button class="btn ghost sm" type="button" id="csA">Искать отсюда</button><button class="btn ghost sm" type="button" id="csB">Искать сюда</button></div>
    <button class="btn ghost" type="button" id="csX">Закрыть</button>`,s=>{
    s.querySelectorAll(".citysum button").forEach(b=>b.onclick=()=>citySheet(c,b.dataset.s));
    bindOffers();s.querySelectorAll(".offer").forEach(o=>o.onclick=null);
    const pt={name:c.name,lat:c.lat,lon:c.lon};
    s.querySelector("#csA").onclick=()=>{closeSheet();state.A=pt;state.pick=null;state.sel=null;state.tab="map";render()};
    s.querySelector("#csB").onclick=()=>{closeSheet();state.B=pt;state.pick=null;state.sel=null;state.tab="map";render()};
    s.querySelector("#csX").onclick=closeSheet;
  });
}
function waitSheet(h){
  const reqs=state.requests.filter(q=>q.at>Date.now()-12*H&&dist([h.lat,h.lon],[q.from.lat,q.from.lon])<60).sort((a,b)=>a.at-b.at);
  const by={};reqs.forEach(q=>(by[q.to.name]=by[q.to.name]||[]).push(q));
  sheet(`<h2><i class="dot" style="background:var(--wait)"></i> Ждут транспорт из ${esc(h.name)}</h2>
    <p class="small muted">Эти люди не нашли попутку. Едете в ту же сторону? Напишите им и договоритесь о цене.</p>
    ${Object.entries(by).map(([to,qs])=>`<div class="card"><div class="kv"><span>→ ${esc(to)}</span><span>${qs.reduce((x,q)=>x+q.people,0)} чел. · ${qs.length} запр.</span></div>
      ${qs.map(q=>`<div class="kv" style="align-items:center"><span style="font-weight:400">${q.mine?esc(q.name)+" (вы)":nameBtn(q.name)} · <span class="mono">${when(q.at).txt}</span><br><span class="small muted">${WANT[q.kind]}${q.kind==="seat"?", "+q.people+" чел.":""}${q.note?" · "+esc(q.note):""}</span></span>${q.mine?`<button class="btn ghost sm" data-delq="${q.id}" type="button">Убрать</button>`:`<button class="btn sm" data-wq="${q.id}" type="button">Написать</button>`}</div>`).join("")}
      <button class="btn ghost sm" type="button" data-go="${esc(to)}">Я еду в ${esc(to)}: опубликовать маршрут</button></div>`).join("")||`<p class="small muted">Здесь пока никто не ждёт.</p>`}
    <button class="btn ghost" type="button" id="wX">Закрыть</button>`,s=>{
    s.querySelector("#wX").onclick=closeSheet;
    s.querySelectorAll("[data-wq]").forEach(b=>b.onclick=()=>openReqChat(b.dataset.wq));
    s.querySelectorAll("[data-delq]").forEach(b=>b.onclick=()=>{if(LIVE){delReq(b.dataset.delq,()=>{closeSheet();render()});return}state.requests=state.requests.filter(q=>q.id!==b.dataset.delq);save();closeSheet();toast("Точка ожидания убрана");render()});
    s.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{const to=reqs.find(q=>q.to.name===b.dataset.go).to;state.pub.A={name:h.name,lat:h.lat,lon:h.lon};state.pub.B=to;state.pub.pick=null;state.tab="publish";save();render()});
  });
}
function newWaitSheet(){
  const A=state.A,B=state.B;
  if(!A||!B){toast("Сначала укажите вверху «Откуда» и «Куда»");state.pick=!A?"A":"B";renderMap();return}
  const d=new Date(Date.now()+864e5).toISOString().slice(0,10);
  sheet(`<h2><i class="dot" style="background:var(--wait)"></i> Поставить точку ожидания</h2>
    <p class="small muted">На карте загорится мигающая оранжевая точка. Водители, которые едут в эту сторону, увидят её и напишут вам.</p>
    <div class="kv"><span class="muted">Маршрут</span><span>${esc(A.name)} → ${esc(B.name)}</span></div>
    <label for="wk">Что нужно<select id="wk">${Object.entries(WANT).map(([k,t])=>`<option value="${k}" ${state.kind===k?"selected":""}>${t}</option>`).join("")}</select></label>
    <div class="row"><label for="wd">Когда<input id="wd" type="date" value="${d}"></label><label for="wp">Сколько человек<input id="wp" type="number" min="1" max="9" value="1"></label></div>
    <label for="wn">Комментарий<input id="wn" placeholder="Например: багаж 1 чемодан"></label>
    <button class="btn" id="wok" type="button">Поставить точку</button>
    <button class="btn ghost" id="wcl" type="button">Отмена</button>`,s=>{
    s.querySelector("#wcl").onclick=closeSheet;
    s.querySelector("#wok").onclick=()=>{
      if(LIVE){const kd=s.querySelector("#wk").value,at=new Date(s.querySelector("#wd").value+"T09:00").getTime();
        if(!Number.isFinite(at)){toast("Проверьте дату");return}
        api.post("requests",{at:new Date(at).toISOString(),data:{from:okPt(A),to:okPt(B),kind:WANT[kd]?kd:"seat",people:Math.min(9,Math.max(1,Math.round(+s.querySelector("#wp").value)||1)),note:clip(s.querySelector("#wn").value,300)}})
          .then(()=>loadAll()).then(()=>{trk("wait_publish",{from:A.name,to:B.name,kind:kd});closeSheet();toast("Точка ожидания поставлена. Водители увидят её на карте");renderMap()},liveFail);return}
      state.requests.push({id:"q"+Date.now(),from:A,to:B,at:new Date(s.querySelector("#wd").value+"T09:00").getTime(),name:state.user.name,people:Math.min(9,Math.max(1,Math.round(+s.querySelector("#wp").value)||1)),kind:WANT[s.querySelector("#wk").value]?s.querySelector("#wk").value:"seat",note:clip(s.querySelector("#wn").value,300),mine:true});
      trk("wait_publish",{from:A.name,to:B.name});save();closeSheet();toast("Точка ожидания поставлена. Водители увидят её на карте");renderMap();
    };
  });
}
function delReq(id,then){api.del("requests?id=eq."+id).then(()=>{state.requests=state.requests.filter(q=>q.id!==id);toast("Точка ожидания убрана");then()},liveFail)}
function openReqChat(id){const q=state.requests.find(x=>x.id===id);let c=state.chats.find(x=>x.req===id&&(!LIVE||x.peer===q.owner));
  if(!c){c={id:LIVE?"|"+id+"|"+q.owner:"c"+Date.now(),req:id,peer:q.owner,with:q.name,title:`Ищет: ${q.from.name} → ${q.to.name}`,msgs:[],unread:0};state.chats.unshift(c);
    c.draft=`Здравствуйте! Я еду ${q.from.name} → ${q.to.name} ${when(q.at).txt.split(",")[0]}. Могу взять${q.kind==="seat"?" вас":""}. Обсудим цену?`}
  save();state.openChat=c.id;state.tab="chats";render()}
function capPills(r){return Object.entries(r.caps).filter(([,v])=>v>0).map(([k,v])=>`<span class="pill"><i class="dot" style="background:var(${KINDS[k].color})"></i>${KINDS[k].t}: ${v} ${KINDS[k].unit} · от ${eur(r.prices[k])} ${KINDS[k].price}</span>`).join("")}
function offerCard(r){
  const w=when(r.at);const mine=r.mine;
  return `<div class="card offer${state.sel===r.id?" sel":""}" data-id="${r.id}">
    <div class="route-t">${esc(r.from.name)} → ${esc(r.to.name)}</div>
    <div class="side"><span class="when ${w.soon?"soon":""}">${w.rel}</span></div>
    <div class="meta"><span class="mono">${w.txt}</span> · ≈${roadKm([r.from.lat,r.from.lon],[r.to.lat,r.to.lon])} км<br>${nameBtn(r.driver)} ${ratingTxt(person(r.driver))} · ${esc(r.vehicle)}${r.meet&&r.meet.street?`<br>Отправление: ${esc(r.meet.city)}, ${esc(r.meet.street)}, в ${new Date(r.at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}`:""}${r.note?`<br>${esc(r.note)}`:""}</div>
    ${safeImg(r.photo)?`<img class="vphoto" src="${safeImg(r.photo)}" alt="Фото транспорта: ${esc(r.vehicle)}">`:""}
    <div class="caps"><span class="pill ${isBus(r)?"go":""}">${carrierName(r)}</span>${capPills(r)}</div>
    <div class="roadinfo"></div>
    <div class="acts">${mine?`<span class="pill ok">Ваш маршрут, ждите сообщений</span>`:`<button class="btn ghost sm" data-chat="${r.id}">Написать</button><button class="btn sm" data-book="${r.id}">Забронировать</button>`}</div>
  </div>`;
}
function bindOffers(){
  $$("[data-chat]").forEach(b=>b.onclick=e=>{e.stopPropagation();openChatFor(b.dataset.chat)});
  $$("[data-book]").forEach(b=>b.onclick=e=>{e.stopPropagation();bookSheet(b.dataset.book)});
  $$(".offer").forEach(o=>o.onclick=()=>selectRoute(o.dataset.id));
}

/* ---------- Бронирование и оплата ---------- */
function bookSheet(id){
  const r=state.routes.find(x=>x.id===id);
  const ks=Object.keys(r.caps).filter(k=>r.caps[k]>0);
  let k=state.kind!=="all"&&r.caps[state.kind]?state.kind:ks[0],qty=k==="parcel"?0:1;
  const draw=s=>{
    const cost=r.prices[k]*qty,fee=0;
    s.querySelector(".sheet").innerHTML=`
      <h2>${esc(r.from.name)} → ${esc(r.to.name)}</h2>
      <p class="small muted">${when(r.at).txt} · ${esc(r.driver)}, ${esc(r.vehicle)}</p>
      <div class="seg" id="bk">${ks.map(x=>`<button type="button" data-k="${x}" aria-pressed="${x===k}"><i class="dot" style="background:var(${KINDS[x].color})"></i>${KINDS[x].t}</button>`).join("")}</div>
      <label for="qty">${k==="seat"?"Сколько мест":k==="parcel"?"Вес посылки, кг":k==="drive"?"Сколько машин пригнать":"Сколько машин"}<input id="qty" type="number" min="1" max="${r.caps[k]}" step="1" value="${qty?Math.min(qty,r.caps[k]):""}" placeholder="${k==="parcel"?"впишите вес":""}"></label>
      ${k==="car"||k==="drive"?`<label for="carinfo">${k==="drive"?"Какую машину пригнать":"Какая машина"}<input id="carinfo" placeholder="Например: Audi A4, 2019, на ходу"></label>`:""}
      ${k==="drive"?`<p class="small muted">Для перегона понадобятся доверенность на водителя, страховка Green Card и документы на машину.</p>`:""}
      <div class="kv"><span class="muted">Водителю, ориентировочно</span><span>${qty?eur(cost):"—"}</span></div>
      <div class="kv"><span class="muted">Бронь в приложении</span><span>бесплатно</span></div>
      <p class="small muted">Точную цену вы согласуете с водителем в чате и платите ему напрямую.</p>
      <button class="btn" id="pay" type="button">Забронировать</button>
      <button class="btn ghost" id="cl" type="button">Отмена</button>`;
    s.querySelectorAll("#bk button").forEach(b=>b.onclick=()=>{k=b.dataset.k;qty=k==="parcel"?0:1;draw(s)});
    s.querySelector("#qty").oninput=e=>{const v=+e.target.value||0;qty=v?Math.max(1,Math.min(r.caps[k],v)):0;s.querySelector(".kv span:last-child").textContent=qty?eur(r.prices[k]*qty):"—"};
    s.querySelector("#cl").onclick=closeSheet;
    s.querySelector("#pay").onclick=()=>{
      const qv=+s.querySelector("#qty").value||0;if(qv<=0){toast(k==="parcel"?"Впишите вес посылки":"Впишите количество");s.querySelector("#qty").focus();return}
      qty=Math.max(1,Math.min(r.caps[k],qv));
      if(LIVE){const b=s.querySelector("#pay"),ci=s.querySelector("#carinfo");b.disabled=true;
        api.rpc("book_route",{p_route:r.id,p_kind:k,p_qty:qty,p_info:ci?clip(ci.value,200):""}).then(()=>loadAll())
          .then(()=>{trk("booking",{kind:k,qty,route:r.from.name+" → "+r.to.name});closeSheet();toast("Забронировано. Водитель получил сообщение в чате");updateBadge();if(state.tab==="map")renderMap()},e=>{b.disabled=false;toast(errText(e))});return}
      r.caps[k]-=qty;
      state.bookings.unshift({id:"B-"+Math.floor(1e4+Math.random()*9e4),route:r.id,title:`${r.from.name} → ${r.to.name}`,kind:k,qty,cost:r.prices[k]*qty,fee,at:r.at,driver:r.driver});
      const c=chatFor(r);c.msgs.push({me:false,text:`Бронь подтверждена: ${KINDS[k].t.toLowerCase()}, ${qty} ${KINDS[k].unit}. Напишите, где удобно встретиться.`,t:Date.now()});c.unread=(c.unread||0)+1;
      trk("booking",{kind:k,qty,route:r.from.name+" → "+r.to.name});save();closeSheet();toast("Забронировано. Водитель написал вам в чат");updateBadge();if(state.tab==="map")renderMap();
    };
  };
  sheet("",draw);
}

/* ---------- Чаты ---------- */
function chatFor(r){let c=state.chats.find(x=>x.route===r.id&&(!LIVE||x.peer===r.owner));if(!c){c={id:LIVE?r.id+"||"+r.owner:"c"+Date.now(),route:r.id,peer:r.owner,with:r.driver,title:`${r.from.name} → ${r.to.name}`,msgs:[],unread:0};state.chats.unshift(c)}return c}
function openChatFor(id){const r=state.routes.find(x=>x.id===id);const c=chatFor(r);
  if(!c.msgs.length){const k=state.kind!=="all"?state.kind:mainKind(r);
    c.draft=k==="parcel"?`Здравствуйте! Хочу передать посылку из ${state.A&&state.A.name.indexOf("Точка")<0?state.A.name:r.from.name} в ${r.to.name}. Примерно 5 кг. Когда и где можно отдать?`
      :k==="drive"?`Здравствуйте! Я купил машину в ${r.from.name}, нужно пригнать её в ${r.to.name}. Машина оплачена, документы готовы. Сколько возьмёте за перегон?`
      :k==="car"?`Здравствуйте! Нужно перевезти машину из ${r.from.name} в ${r.to.name}. Есть место на трале?`
      :`Здравствуйте! Есть свободное место до ${r.to.name}? Откуда забираете?`}
  save();state.openChat=c.id;state.tab="chats";render()}
const REPLIES={
  parcel:["Добрый день! Да, беру. Привезите сегодня до 16:00, адрес скину. Оплата 1 € за кг, можно при получении.","Посылку заберу. Подпишите имя и телефон получателя на коробке."],
  car:["Здравствуйте! Одно место на трале есть. Машина на ходу? Пришлите фото и адрес погрузки.","Погрузка утром в день выезда. Документы на машину передайте мне в руки."],
  req:["Здравствуйте! Да, ещё ищу. Во сколько выезжаете и сколько это будет стоить?","Подходит, договорились. Напишите, где и во сколько встречаемся."],
  drive:["Здравствуйте! Могу пригнать. Нужны доверенность на моё имя, Green Card и документы на машину. Топливо и платные дороги за ваш счёт, за работу 250 €, можно обсудить.","Пришлите фото машины и адрес продавца. По дороге буду присылать, где я."],
  seat:["Привет! Место есть. Забираю с центральной автостанции или по адресу за 5 €.","Багаж до 20 кг входит в цену. Напишите номер, я добавлю вас в список."]
};
function renderChats(){
  if(state.openChat){const c=state.chats.find(x=>x.id===state.openChat);if(c)return renderChat(c);state.openChat=null}
  view.innerHTML=`<h1>Чаты</h1>${state.chats.length?`<div class="list">${state.chats.map(c=>{const last=c.msgs[c.msgs.length-1];
    return `<button class="card thread" data-c="${c.id}"><span class="ava">${esc(c.with[0])}</span><span class="t"><b>${esc(c.with)}</b> <span class="small muted">· ${esc(c.title)}</span><p class="small muted">${last?esc((last.me?"Вы: ":"")+last.text):"Новый чат"}</p></span>${c.unread?`<span class="pill go">${c.unread}</span>`:""}</button>`}).join("")}</div>`
    :`<div class="card empty">Здесь будут переписки с водителями и перевозчиками. Найдите маршрут на карте и нажмите «Написать».</div>`}`;
  $$("[data-c]").forEach(b=>b.onclick=()=>{state.openChat=b.dataset.c;renderChats()});
  trkScreen();
}
function renderChat(c){
  if(LIVE&&c.unreadIds&&c.unreadIds.length){api.patch("messages?id=in.("+c.unreadIds.join(",")+")",{read_at:new Date().toISOString()}).catch(()=>{});c.unreadIds=[]}
  c.unread=0;save();updateBadge();
  const r=state.routes.find(x=>x.id===c.route);
  const tm=t=>new Date(t).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
  view.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><button class="btn ghost sm" id="bk" type="button">← Чаты</button><span class="ava">${esc(c.with[0])}</span><div style="min-width:0"><b>${esc(c.with)}</b><p class="small muted">${esc(c.title)}${r?" · "+when(r.at).txt:""}</p></div></div>
    <div class="chatlog" id="log">${c.msgs.length?c.msgs.map(m=>`<div class="msg ${m.me?"me":""}">${esc(m.text)}<time>${tm(m.t)}</time></div>`).join(""):`<p class="small muted">Напишите водителю: что везёте, откуда забрать, когда удобно. Номер телефона покажем после брони.</p>`}</div>
    ${r&&!r.mine?`<button class="btn ghost sm" id="bkr" type="button" style="align-self:flex-start">Забронировать в этом маршруте</button>`:""}
    <form class="chatform" id="cf"><input id="ci" autocomplete="off" placeholder="Сообщение" value="${esc(c.draft||"")}"><button class="btn" type="submit">Отправить</button></form>`;
  c.draft="";
  $("#bk").onclick=()=>{state.openChat=null;renderChats()};
  if($("#bkr"))$("#bkr").onclick=()=>bookSheet(r.id);
  $("#cf").onsubmit=e=>{e.preventDefault();const v=clip($("#ci").value,1000);if(!v)return;
    if(LIVE){const ci=$("#ci");ci.disabled=true;
      api.post("messages",{recipient:c.peer,route_id:c.route||null,request_id:c.req||null,title:clip(c.title,200),body:v})
        .then(()=>{trk("message_sent");c.msgs.push({me:true,text:v,t:Date.now()});c.draft="";renderChat(c);$("#ci").focus();loadMsgs().catch(()=>{})},e=>{ci.disabled=false;toast(errText(e))});return}
    trk("message_sent");c.msgs.push({me:true,text:v,t:Date.now()});save();renderChat(c);
    const k=r?mainKind(r):"seat";const pool=c.req?REPLIES.req:/пригна|перегон/i.test(v)?REPLIES.drive:/посыл|кг|короб/i.test(v)?REPLIES.parcel:/машин|авто|трал/i.test(v)?REPLIES.car:REPLIES[k];
    const n=c.msgs.filter(m=>!m.me).length;
    setTimeout(()=>{c.msgs.push({me:false,text:pool[n%pool.length],t:Date.now()});if(state.openChat===c.id&&state.tab==="chats")renderChat(c);else{c.unread=(c.unread||0)+1;updateBadge()}save()},1400)};
  window.scrollTo(0,document.body.scrollHeight);
  trkScreen();
}
function updateBadge(){const n=state.chats.reduce((s,c)=>s+(c.unread||0),0);const b=$("#badge");b.hidden=!n;b.textContent=n}

/* ---------- Я еду: публикация ---------- */
function renderPublish(){
  const p=state.pub,y0=window.scrollY;
  const f0=$("#pf");if(f0){p.form={};f0.querySelectorAll("input:not([type=file])").forEach(i=>p.form[i.id]=i.value)}
  p.form=p.form||{};
  const cityOf=n=>n.replace(/^Точка у /,"").split(",")[0];
  if(p.A&&p.cityFor!==p.A.name){p.form.pcity=cityOf(p.A.name);p.cityFor=p.A.name;if(p.M&&dist([p.M.lat,p.M.lon],[p.A.lat,p.A.lon])>80)p.M=null}
  view.innerHTML=`<h1>Я еду, могу взять</h1>
    <p class="muted">Отметьте на карте, откуда выезжаете и куда едете. Пассажиры и отправители увидят маршрут и напишут вам.</p>
    <div class="pickbar">
      <button class="pick" id="qA" aria-pressed="${p.pick==="A"}"><small>Откуда</small><span>${p.A?esc(p.A.name):"Нажмите на карту"}</span></button>
      <button class="pick" id="qB" aria-pressed="${p.pick==="B"}"><small>Куда</small><span>${p.B?esc(p.B.name):"Нажмите на карту"}</span></button>
    </div>
    ${searchForm(p)}
    <div class="mapbox picking" id="pm"><div class="mapbar"><span class="pill">${p.pick==="A"?"Нажмите точку отправления":p.pick==="B"?"Нажмите точку прибытия":p.pick==="M"?"Приблизьте и нажмите точное место встречи":"Маршрут отмечен"}</span></div>
      <div class="zoom"><button type="button" id="zin" aria-label="Приблизить">+</button><button type="button" id="zout" aria-label="Отдалить">−</button></div></div>
    <form class="card" id="pf">
      <h2>Когда и откуда выезжаете</h2>
      <div class="row"><label for="pd">Дата<input id="pd" type="date" required></label><label for="pt">Время выезда<input id="pt" type="time" value="06:00" step="900" required></label></div>
      <div class="row"><label for="pcity">Город<input id="pcity" placeholder="Например: Кишинёв" required></label><label for="pstreet">Улица и дом<input id="pstreet" placeholder="ул. Измаил, 33"></label></div>
      <button class="btn ghost sm" type="button" id="pmeet" style="align-self:flex-start">${p.M?"Изменить точку на карте":"Отметить точное место на карте"}</button>
      <p class="small muted" id="pmeetinfo">${p.M?`Место встречи отмечено: <span class="mono">${p.M.lat.toFixed(5)}, ${p.M.lon.toFixed(5)}</span>`:"Пассажиры увидят точку на карте и придут прямо к ней."}</p>
      <div><p class="small muted" style="margin-bottom:6px">На чём едете</p>
        <div class="seg vtgrid" id="pvt">${Object.entries(VT).map(([k,v])=>`<button type="button" data-v="${k}" aria-pressed="${p.vt===k}">${v.t}</button>`).join("")}<button type="button" data-v="none" aria-pressed="${p.vt==="none"}">Без транспорта, пригоню чужую машину</button></div></div>
      <div class="photobox" ${p.vt==="none"?"hidden":""}>${p.photo?`<img src="${safeImg(p.photo)}" alt="Фото вашего транспорта">`:""}
        <label class="btn ghost sm filebtn" for="pphoto">${p.photo?"Заменить фото":"Загрузить фото транспорта"}<input id="pphoto" type="file" accept="image/*"></label>
        ${p.photo?`<button class="btn ghost sm" type="button" id="pphotodel">Убрать</button>`:""}</div>
      <label for="pv" id="pvl" ${p.vt==="none"?"hidden":""}>${p.vt==="plane"?"Рейс":"Транспорт"}<input id="pv" value="" placeholder="${p.vt!=="none"?VT[p.vt].ph:""}"></label>
      <p class="small muted">Что можете взять и за сколько. Заполните только то, что берёте, и впишите свою цену. Пустые строки не публикуются.</p>
      <div class="row"><label for="cs">Свободных мест<input id="cs" type="number" inputmode="numeric" min="0" max="60" placeholder="сколько"></label><label for="ps">Ваша цена за место, €<input id="ps" type="number" inputmode="decimal" min="0" step="any" placeholder="впишите цену"></label></div>
      <div class="row"><label for="cp">Посылки, до кг<input id="cp" type="number" inputmode="numeric" min="0" placeholder="сколько кг"></label><label for="pp">Ваша цена за кг, €<input id="pp" type="number" inputmode="decimal" min="0" step="any" placeholder="впишите цену"></label></div>
      <div class="row"><label for="cc">Места на трале, авто<input id="cc" type="number" inputmode="numeric" min="0" max="10" placeholder="сколько"></label><label for="pc">Ваша цена за авто, €<input id="pc" type="number" inputmode="decimal" min="0" step="any" placeholder="впишите цену"></label></div>
      <div class="row"><label for="cd">Перегон: пригоню авто<input id="cd" type="number" inputmode="numeric" min="0" max="3" placeholder="сколько"></label><label for="pdr">Ваша цена за перегон, €<input id="pdr" type="number" inputmode="decimal" min="0" step="any" placeholder="впишите цену"></label></div>
      <label for="pn">Комментарий<input id="pn" placeholder="Например: остановки в Яссах и Вене"></label>
      <div class="kv"><span class="muted">Подача объявления</span><span>${!FEE?"бесплатно":LIVE?"пока бесплатно":lei(FEE)}</span></div>
      ${FEE&&LIVE?`<p class="small muted">Плата ${lei(FEE)} за объявление начнёт действовать, когда подключим оплату картой.</p>`:""}
      <button class="btn" type="submit">${!FEE?"Опубликовать бесплатно":LIVE?"Опубликовать":`Оплатить ${lei(FEE)} и опубликовать`}</button>
    </form>`;
  const d=new Date(Date.now()+864e5);$("#pd").value=d.toISOString().slice(0,10);
  Object.entries(p.form).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&el.closest("#pf"))el.value=v});
  const setMeet=(lat,lon)=>{p.M={lat,lon};p.pick=null;renderPublish();
    if(GL.on)revStreet(lat,lon).then(a=>{if(!a)return;const st=$("#pstreet"),ci=$("#pcity");if(st&&a.street){st.value=a.street;p.form.pstreet=a.street}if(ci&&a.city){ci.value=a.city;p.form.pcity=a.city}})};
  const m=makeMap($("#pm"),{picking:()=>!!p.pick,
    onCity:c=>{if(p.pick==="M")setMeet(c.lat,c.lon);else if(p.pick)setPlace(p,c,renderPublish);else toast("Нажмите «Откуда» или «Куда», чтобы поменять точку")},
    onPick:(lat,lon)=>{if(p.pick==="M")setMeet(lat,lon);else if(p.pick)setPoint(p,lat,lon,renderPublish)}});
  if(p.A)m.pin(p.A,"А · "+p.A.name,css("--ink"));
  if(p.B)m.pin(p.B,"Б · "+p.B.name,css("--warn"));
  if(p.M)m.pin(p.M,"Место встречи",css("--dep"));
  if(p.pick==="M"&&p.A)m.focus([p.M||p.A],15);
  else if(p.A&&p.B){m.line(p.A,p.B,css("--accent"));m.focus([p.A,p.B])}
  $$("#pvt button").forEach(b=>b.onclick=()=>{p.vt=b.dataset.v;renderPublish()});
  $("#pphoto").onchange=e=>{const file=e.target.files&&e.target.files[0];if(!file)return;
    if(!/^image\//.test(file.type)){toast("Выберите файл с фотографией");return}
    if(file.size>MAX_FILE){toast("Фото слишком большое, нужно до 15 МБ");return}
    const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,640/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);p.photo=c.toDataURL("image/jpeg",.78);renderPublish();toast("Фото добавлено")};im.onerror=()=>toast("Не получилось открыть фото, попробуйте другое");im.src=rd.result};rd.readAsDataURL(file)};
  if($("#pphotodel"))$("#pphotodel").onclick=()=>{p.photo=null;renderPublish()};
  $("#pmeet").onclick=()=>{if(!p.A){toast("Сначала выберите, откуда выезжаете");p.pick="A";renderPublish();return}p.pick="M";renderPublish();$("#pm").scrollIntoView({behavior:"smooth",block:"center"})};
  bindSearch(p,renderPublish);
  if(window.scrollY!==y0)window.scrollTo(0,y0);
  $("#zin").onclick=()=>m.zoomBy(1.6);$("#zout").onclick=()=>m.zoomBy(1/1.6);
  $("#qA").onclick=()=>{p.pick="A";renderPublish()};$("#qB").onclick=()=>{p.pick="B";renderPublish()};
  $("#pf").onsubmit=e=>{e.preventDefault();
    if(!p.A||!p.B){toast("Отметьте на карте обе точки: откуда и куда");return}
    const caps={},prices={};let bad=null;
    for(const [k,c,pr,need,what] of [["seat","cs","ps","Впишите цену за место","Укажите, сколько свободных мест"],["parcel","cp","pp","Впишите цену за кг","Укажите, сколько кг посылок возьмёте"],["car","cc","pc","Впишите цену за авто на трале","Укажите, сколько авто возьмёте на трал"],["drive","cd","pdr","Впишите цену за перегон","Укажите, сколько авто пригоните"]]){
      const cv=$("#"+c).value.trim(),pv=$("#"+pr).value.trim(),v=Math.floor(+cv)||0;
      if(v>CAP_MAX[k]){bad=["Проверьте число: слишком большое значение",c];break}
      if(+pv>100000){bad=["Проверьте цену: слишком большое значение",pr];break}
      if(v>0&&(pv===""||+pv<0)){bad=[need,pr];break}
      if(v<=0&&pv!==""){bad=[what,c];break}
      if(v>0){caps[k]=v;prices[k]=+pv}}
    if(bad){toast(bad[0]);$("#"+bad[1]).focus();return}
    if(!Object.keys(caps).length){toast("Укажите, что можете взять, и впишите свою цену");$("#cs").focus();return}
    const at=new Date($("#pd").value+"T"+$("#pt").value).getTime();
    if(!Number.isFinite(at)||at<Date.now()-H){toast("Проверьте дату и время выезда");$("#pd").focus();return}
    const vt=p.vt==="none"?null:p.vt;const mp=p.M||p.A;const meet={city:clip($("#pcity").value,80)||p.A.name,street:clip($("#pstreet").value,120),lat:mp.lat,lon:mp.lon};
    const r={id:"m"+Date.now(),meet,photo:vt?p.photo||null:null,vt,carrier:vt==="bus"||vt==="minibus"?"bus":"private",from:p.A,to:p.B,at,driver:state.user.ltype==="company"&&state.user.cname?state.user.cname:state.user.name,vehicle:vt?(clip($("#pv").value,80)||VT[vt].t):"Без своей машины",caps,prices,rating:5,note:clip($("#pn").value,300),mine:true};
    if(LIVE){const b=$("#pf button[type=submit]");b.disabled=true;
      api.post("routes",{at:new Date(at).toISOString(),caps,photo:safeImg(r.photo)||null,data:{from:okPt(r.from),to:okPt(r.to),meet,vt,carrier:r.carrier,vehicle:r.vehicle,prices,note:r.note}},true)
        .then(rows=>{live.photos[rows[0].id]=safeImg(r.photo)||null;return loadAll().then(()=>rows[0].id)})
        .then(id=>{trk("route_publish",{from:p.A.name,to:p.B.name,what:Object.keys(caps).join(",")});state.A=p.A;state.B=p.B;state.kind="all";state.sel=id;state.tab="map";state.pub={kind:"seat",A:null,B:null,pick:"A",vt:"car"};save();
          toast("Маршрут опубликован. Ждите сообщений от пассажиров");render()},e=>{b.disabled=false;toast(errText(e))});return}
    state.routes.push(r);save();trk("route_publish",{from:p.A.name,to:p.B.name,what:Object.keys(caps).join(",")});
    state.A=p.A;state.B=p.B;state.kind="all";state.sel=r.id;state.tab="map";state.pub={kind:"seat",A:null,B:null,pick:"A",vt:"car"};
    toast("Маршрут опубликован. Ждите сообщений от пассажиров");render();
  };
}

/* ---------- Профиль и тарифы ---------- */
function renderProfile(){
  const bs=state.bookings;
  view.innerHTML=`<h1>${esc(state.user.name)}</h1>
    <p class="muted mono">${esc(LIVE&&!state.user.phone?state.user.loginEmail:state.user.phone)}</p>
    <div class="card"><div style="display:flex;gap:12px;align-items:center"><span class="ava big">${safeImg(state.user.photo)?`<img src="${safeImg(state.user.photo)}" alt="Ваше фото">`:esc(state.user.name[0])}</span>
        <div><h2>Мой профиль ${state.user.docs?vbadge:""}</h2><p class="small muted">${ratingTxt(person(state.user.name))}</p></div></div>
      <div class="trust">${!LIVE||state.user.phoneOk?`<span><b class="y">✓</b>Номер телефона подтверждён</span>`:`<span><b class="y">✓</b>Почта подтверждена</span><span><b class="n">–</b>Номер телефона не подтверждён</span>`}
        ${LIVE?state.user.tg?`<span><b class="y">✓</b>Telegram подключён: коды для входа приходят туда</span>`:`<span><b class="n">–</b>Telegram не подключён <button class="btn sm" id="utg" type="button" style="margin-left:auto">Подключить</button></span>`:""}
        <span><b class="${state.user.photo?"y":"n"}">${state.user.photo?"✓":"–"}</b>Фото профиля <label class="btn ghost sm filebtn" for="uphoto" style="margin-left:auto">${state.user.photo?"Заменить":"Добавить"}<input id="uphoto" type="file" accept="image/*"></label></span>
        <span><b class="${state.user.docs?"y":"n"}">${state.user.docs?"✓":"–"}</b>${state.user.docs?"Документы проверены":"Документы не проверены"} ${state.user.docs?"":`<button class="btn sm" id="uverify" type="button" style="margin-left:auto">Пройти проверку</button>`}</span></div>
      ${LIVE?`<label for="uname">Имя<input id="uname" autocomplete="given-name" value="${esc(state.user.name)}"></label>`:""}
      ${LIVE&&!state.user.phoneOk?`<label for="uphone">Телефон<input id="uphone" type="tel" inputmode="tel" value="${esc(state.user.phone||"")}" placeholder="+373 69 123 456"></label><p class="small muted">Номер увидит только тот, с кем у вас бронь. Подтвердить номер можно, подключив Telegram.</p>`:""}
      <div><p class="small muted" style="margin-bottom:6px">Кто вы</p><div class="seg" id="ltype"><button type="button" data-l="person" aria-pressed="${state.user.ltype!=="company"}">Физическое лицо</button><button type="button" data-l="company" aria-pressed="${state.user.ltype==="company"}">Юридическое лицо</button></div></div>
      ${state.user.ltype==="company"?`<p class="small muted">Для перевозчиков, автобусов и маршруток. Рядом с названием появится значок «Компания», а контакты увидят все пассажиры.</p>
        <label for="ucname">Название компании<input id="ucname" value="${esc(state.user.cname||"")}" placeholder="Например: Trans Nord SRL"></label>
        <label for="uidno">Регистрационный номер (IDNO)<input id="uidno" inputmode="numeric" value="${esc(state.user.idno||"")}" placeholder="13 цифр"></label>
        <div class="row"><label for="ucphone">Телефон<input id="ucphone" type="tel" value="${esc(state.user.cphone||state.user.phone)}"></label><label for="ucphone2">Второй телефон<input id="ucphone2" type="tel" value="${esc(state.user.cphone2||"")}" placeholder="необязательно"></label></div>
        <div class="row"><label for="ufax">Факс<input id="ufax" type="tel" value="${esc(state.user.fax||"")}" placeholder="если есть"></label><label for="uemail">E-mail<input id="uemail" type="email" value="${esc(state.user.email||"")}" placeholder="office@company.md"></label></div>`:""}
      <p class="small muted">Добавьте ссылки на свои страницы, чтобы попутчики могли узнать вас до поездки.</p>
      <label for="uig">Instagram<input id="uig" type="url" inputmode="url" placeholder="https://instagram.com/ваш_ник" value="${esc(state.user.ig||"")}"></label>
      <label for="ufb">Facebook<input id="ufb" type="url" inputmode="url" placeholder="https://facebook.com/ваша_страница" value="${esc(state.user.fb||"")}"></label>
      <div class="row"><button class="btn sm" id="usoc" type="button">Сохранить</button><button class="btn ghost sm" type="button" data-person="${esc(state.user.ltype==="company"&&state.user.cname?state.user.cname:state.user.name)}">Как меня видят</button></div>
    </div>
    ${shareCard()}
    <div class="card"><h2>Сколько стоит</h2>
      ${FEE?`<div class="kv"><span>Регистрация, поиск, чат и бронь</span><b>бесплатно</b></div>
      <div class="kv"><span>Подача объявления (маршрута)</span><b>${LIVE?"пока бесплатно":lei(FEE)}</b></div>`:`<div class="kv"><span>Регистрация, поиск, чат, бронь и подача объявлений</span><b>бесплатно</b></div>`}
      <p class="small muted">Без подписок и комиссий. Цену поездки вы согласуете с водителем в чате.</p>
    </div>
    <div class="card"><h2>Мои брони</h2>
      ${bs.length?bs.map(b=>`<div class="kv"><span>${esc(b.title)}<br><span class="small muted">${KINDS[b.kind].t}: ${b.qty} ${KINDS[b.kind].unit} · ${b.asDriver?"у вас забронировал(а) "+esc(b.passenger):esc(b.driver)} · ${when(b.at).txt}</span>${LIVE?`<br><button class="btn ghost sm" type="button" data-bphone="${esc(b.id)}">Показать телефон</button>`:""}</span><span>${eur(b.cost)}<br>${b.asDriver?"":b.reviewed?`<span class="pill ok">Отзыв оставлен</span>`:`<button class="btn ghost sm" type="button" data-rev="${esc(b.id)}">Оставить отзыв</button>`}</span></div>`).join("")
        :`<p class="small muted">Пока нет броней. Найдите маршрут на карте и нажмите «Забронировать».</p>`}
    </div>
    <div class="card"><h2>Мои маршруты</h2>
      ${state.routes.filter(r=>r.mine).map(r=>`<div class="kv"><span>${esc(r.from.name)} → ${esc(r.to.name)}<br><span class="small muted">${when(r.at).txt}</span></span><span class="small">${Object.entries(r.caps).map(([k,v])=>v+" "+KINDS[k].unit).join(", ")}${LIVE?`<br><button class="btn ghost sm" type="button" data-delr="${esc(r.id)}">Снять</button>`:""}</span></div>`).join("")||`<p class="small muted">Едете сами? Опубликуйте маршрут во вкладке «Я еду».</p>`}
    </div>
    <div class="card"><h2>Мои точки ожидания</h2>
      ${state.requests.filter(q=>q.mine).map(q=>`<div class="kv"><span>${esc(q.from.name)} → ${esc(q.to.name)}<br><span class="small muted">${WANT[q.kind]} · ${when(q.at).txt}</span></span><button class="btn ghost sm" data-delq="${q.id}" type="button">Убрать</button></div>`).join("")||`<p class="small muted">Не нашли транспорт? На карте нажмите «Поставить точку ожидания».</p>`}
    </div>
    ${admOk()?`<div class="card"><h2>Админка</h2><p class="small muted" style="margin:0">Кто пользуется приложением, какие экраны открывают и куда нажимают.</p><button class="btn" id="uadmin" type="button">Открыть админку</button></div>`:""}
    <div class="card"><h2>История действий</h2><p class="small muted" style="margin:0">${TRK.on===true?"Запись включена: мы видим, какие экраны вы открываете и какие кнопки нажимаете. Текст сообщений, коды и то, что вы печатаете, не записываются.":"Запись выключена. Если включите, нам будет проще находить ошибки и делать приложение удобнее."}</p>
      <div class="row"><button class="btn ghost sm" id="utrk" type="button">${TRK.on===true?"Выключить запись":"Включить запись"}</button><button class="btn ghost sm" id="upriv" type="button">Конфиденциальность</button></div></div>
    <button class="btn ghost" id="reintro" type="button">Как пользоваться приложением</button>
    <button class="btn ghost" id="out" type="button">Выйти</button>
    ${LIVE?`<button class="btn ghost" id="outall" type="button">Выйти на всех устройствах</button><button class="btn ghost" id="delacc" type="button">Удалить аккаунт и все данные</button>`
      :`<button class="btn ghost" id="wipe" type="button">Сбросить демо-данные</button>`}`;
  $$("[data-delq]").forEach(b=>b.onclick=()=>{if(LIVE){delReq(b.dataset.delq,renderProfile);return}state.requests=state.requests.filter(q=>q.id!==b.dataset.delq);save();renderProfile()});
  $("#reintro").onclick=()=>showIntro(0);bindShare();
  if($("#uadmin"))$("#uadmin").onclick=()=>{ADM.user=null;ADM.ov=null;ADM.users=null;goTab("admin")};
  $("#upriv").onclick=privacySheet;
  $("#utrk").onclick=()=>{const v=TRK.on!==true;if(!v)TRK.q=[];trkSet(v);toast(v?"Запись истории включена":"Запись истории выключена");renderProfile()};
  $$("[data-rev]").forEach(x=>x.onclick=()=>reviewSheet(state.bookings.find(b=>b.id===x.dataset.rev)));
  if($("#uverify"))$("#uverify").onclick=verifySheet;
  $("#usoc").onclick=()=>{const ig=$("#uig").value.trim(),fb=$("#ufb").value.trim();
    if(ig&&!okUrl(ig,"instagram.com")){toast("Ссылка Instagram должна начинаться с https://instagram.com/");return}
    if(fb&&!okUrl(fb,"facebook.com")){toast("Ссылка Facebook должна начинаться с https://facebook.com/");return}
    if(state.user.ltype==="company"){const g=id=>$("#"+id).value.trim();const em=g("uemail");
      if(!g("ucname")){toast("Укажите название компании");return}
      if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){toast("Проверьте e-mail: в нём должны быть @ и точка");return}
      Object.assign(state.user,{cname:clip(g("ucname"),100),idno:clip(g("uidno"),20),cphone:clip(g("ucphone"),30),cphone2:clip(g("ucphone2"),30),fax:clip(g("ufax"),30),email:clip(em,120)})}
    state.user.ig=ig;state.user.fb=fb;
    if(LIVE){const n=clip($("#uname").value,60),ph=$("#uphone")?$("#uphone").value.trim():"";if(!n){toast("Впишите имя");return}
      if(ph&&ph.replace(/\D/g,"").length<8){toast("Проверьте номер: нужен код страны и номер");return}
      state.user.name=n;pushProfile().then(()=>ph&&ph!==state.user.phone?api.rpc("set_phone",{p:ph}).then(()=>{state.user.phone="+"+ph.replace(/\D/g,"")}):null)
        .then(()=>{save();renderProfile();doneSheet("Отлично! Ваш профиль изменён!","Теперь попутчики увидят обновлённые данные.")},liveFail);return}
    save();renderProfile();doneSheet("Отлично! Ваш профиль изменён!","Теперь попутчики увидят обновлённые данные.")};
  $$("#ltype button").forEach(x=>x.onclick=()=>{state.user.ltype=x.dataset.l;save();renderProfile()});
  $("#uphoto").onchange=e=>{const file=e.target.files&&e.target.files[0];if(!file||!/^image\//.test(file.type))return;if(file.size>MAX_FILE){toast("Фото слишком большое, нужно до 15 МБ");return}
    const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,240/Math.min(im.width,im.height));const c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);state.user.photo=c.toDataURL("image/jpeg",.8);save();renderProfile();if(LIVE)pushProfile().then(()=>toast("Фото профиля добавлено"),liveFail);else toast("Фото профиля добавлено")};im.onerror=()=>toast("Не получилось открыть фото, попробуйте другое");im.src=rd.result};rd.readAsDataURL(file)};
  $$("[data-bphone]").forEach(x=>x.onclick=()=>api.rpc("booking_phone",{p_booking:x.dataset.bphone}).then(t=>{x.outerHTML=t?`<a class="mono" href="tel:${esc(t)}">${esc(t)}</a>`:`<span class="small muted">Номер не указан</span>`},liveFail));
  $$("[data-delr]").forEach(x=>x.onclick=()=>api.del("routes?id=eq."+x.dataset.delr).then(()=>{state.routes=state.routes.filter(r=>r.id!==x.dataset.delr);toast("Маршрут снят");renderProfile()},liveFail));
  if(LIVE){
    $("#out").onclick=()=>liveLogout(false);
    if($("#utg"))$("#utg").onclick=()=>tgLinkSheet($("#utg"),()=>api.rpc("my_profile").then(p=>{Object.assign(state.user,userFromProfile(p));save();renderProfile()},liveFail));
    $("#outall").onclick=()=>api.fn("logout_all").then(()=>liveLogout(true,"Вы вышли на всех устройствах"),liveFail);
    $("#delacc").onclick=()=>sheet(`<h2>Удалить аккаунт?</h2><p>Удалятся ваш профиль, маршруты, точки ожидания, брони и переписка. Вернуть их будет нельзя.</p>
      <button class="btn" id="dyes" type="button">Да, удалить навсегда</button><button class="btn ghost" id="dno" type="button">Отмена</button>`,s=>{
      s.querySelector("#dno").onclick=closeSheet;
      s.querySelector("#dyes").onclick=()=>api.rpc("delete_my_account").then(()=>liveLogout(true,"Аккаунт и все данные удалены"),liveFail)});
    return}
  $("#out").onclick=()=>{trk("logout");state.user=null;state.auth.step="phone";save();render()};
  $("#wipe").onclick=()=>{state.routes=seedRoutes.map(r=>({...r,caps:{...r.caps}}));state.chats=[];state.bookings=[];state.requests=seedReqs();state.support=[];state.seenIntro=false;state.shared=false;state.reviews=[];save();updateBadge();toast("Демо-данные сброшены");renderProfile()};
}

/* ---------- Ознакомление ---------- */
const dotI=v=>`<i class="dot" style="background:var(${v});width:18px;height:18px"></i>`;
const INTRO=[
  {art:`${dotI("--dep")}${dotI("--arr")}`,h:"Карта поездок",p:"Зелёная точка: отсюда выезжают. Красная: сюда приезжают. Цифра показывает, сколько поездок. Нажмите на точку и увидите, кто едет и когда."},
  {art:`<span class="pill">Пассажиры</span><span class="pill">Посылки</span><span class="pill">Трал</span><span class="pill">Перегон</span>`,h:"Что можно сделать",p:"Поехать попутчиком, передать посылку, перевезти машину на трале или найти человека, который сам пригонит вашу купленную машину."},
  {art:`<span class="btn sm ghost">Написать</span><span class="btn sm">Забронировать</span>`,h:"Договоритесь в чате",p:"Нашли водителя? Нажмите «Написать» и договоритесь о цене и месте встречи. Потом нажмите «Забронировать»."},
  {art:`<svg width="44" height="44" viewBox="0 0 44 44" class="wait"><circle class="ring" cx="22" cy="22" r="9"/><circle class="core" cx="22" cy="22" r="9"/></svg>`,h:"Никого не нашли?",p:"Поставьте оранжевую точку ожидания. Она мигает на карте, и водители, которые едут в вашу сторону, сами вам напишут."},
  {art:`<span class="pill go">Я еду</span>`,h:"Едете сами?",p:"Во вкладке «Я еду» отметьте на карте, откуда и куда едете. Возьмите попутчиков или посылки и заработайте на дороге."}
];
function showIntro(i){
  closeSheet();const st=INTRO[i],last=i===INTRO.length-1;
  const s=document.createElement("div");s.className="scrim intro";
  s.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="Как пользоваться">
    <div class="intro-step"><p class="small muted">Шаг ${i+1} из ${INTRO.length}</p><div class="intro-art">${st.art}</div><h2>${st.h}</h2><p>${st.p}</p></div>
    <div class="intro-dots">${INTRO.map((_,k)=>`<i class="${k===i?"on":""}"></i>`).join("")}</div>
    <div class="row">${i>0?`<button class="btn ghost" id="ib" type="button">Назад</button>`:`<button class="btn ghost" id="isk" type="button">Пропустить</button>`}<button class="btn" id="in" type="button">${last?"Я всё понял":"Далее"}</button></div>
  </div>`;
  document.body.appendChild(s);
  const done=()=>{state.seenIntro=true;save();closeSheet();if(last)toast("Отлично! Если забудете, нажмите «?» вверху")};
  s.querySelector("#in").onclick=()=>last?done():showIntro(i+1);
  if(s.querySelector("#ib"))s.querySelector("#ib").onclick=()=>showIntro(i-1);
  if(s.querySelector("#isk"))s.querySelector("#isk").onclick=done;
  s.querySelector("#in").focus();
}

/* ---------- Чат поддержки ---------- */
const FAQ=[
  [/оранж|ожидан|никого|не наш|нет транспорт/i,"Если никто не едет, откройте «Карта», укажите «Откуда» и «Куда» и нажмите «Не нашли транспорт? Поставить точку ожидания». На карте появится мигающая оранжевая точка, и водители вам напишут."],
  [/зел|красн|точк/i,"Зелёные точки показывают, откуда выезжают, красные показывают, куда приезжают. Цифра в точке: сколько поездок. Нажмите на точку, и откроется список водителей."],
  [/посыл|переда/i,"Чтобы отправить посылку, на карте выберите «Посылки», укажите свой город и город получателя. Нажмите «Написать» у ближайшего водителя и договоритесь, где передать коробку."],
  [/перегон|пригна|купил/i,"Купили машину за границей? Выберите «Перегон»: это люди, которые едут туда без своей машины и могут пригнать вашу. Понадобятся доверенность, страховка Green Card и документы на машину."],
  [/трал|эвакуат/i,"Выберите «Трал», чтобы найти перевозчика с автовозом или эвакуатором. Укажите, откуда забрать машину, и забронируйте место на погрузку."],
  [/цен|плат|деньг|сбор|подпис|стоит|лей/i,FEE?`Регистрация, поиск, чат и бронь бесплатные. Платная только подача объявления: ${lei(FEE)} за маршрут. Цену поездки вы согласуете с водителем в чате.`:"Всё бесплатно: регистрация, поиск, чат, бронь и подача объявлений. Цену поездки вы согласуете с водителем в чате."],
  [/опублик|водител|я еду|свою машин|заработ/i,"Если едете сами, откройте вкладку «Я еду», отметьте на карте откуда и куда, укажите свободные места, посылки или трал и нажмите «Опубликовать маршрут»."],
  [/брон/i,"Нажмите «Забронировать» у поездки, выберите, что нужно, и подтвердите бронь, это бесплатно. Водитель сразу напишет вам в чат."],
  [/чат|написа/i,"Нажмите «Написать» у любой поездки или у оранжевой точки. Все переписки лежат во вкладке «Чаты»."],
  [/поезд|ехать|место|попут/i,"Чтобы найти попутку, на карте укажите «Откуда» и «Куда». Ниже появится список ближайших выездов. Нажмите «Написать», договоритесь о цене и забронируйте место."]
];
const SUPPORT_Q=["Как найти попутку?","Как отправить посылку?","Что такое перегон?","Что значит оранжевая точка?","Сколько это стоит?"];
function supportAnswer(v){const f=FAQ.find(([re])=>re.test(v));return f?f[1]:"Спасибо за вопрос! Я передам его оператору, он ответит здесь в течение дня. А пока можно ещё раз посмотреть короткое ознакомление: кнопка «?» вверху экрана."}
function openSupport(){
  const tm=t=>new Date(t).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
  const draw=s=>{
    s.querySelector(".sheet").innerHTML=`<div style="display:flex;align-items:center;gap:10px"><span class="ava">?</span><div><b>Поддержка gotransfer</b><p class="small muted">Спросите, как пользоваться приложением</p></div></div>
      <div class="chatlog" style="min-height:160px"><div class="msg">Здравствуйте! Я помогу разобраться с приложением. Выберите вопрос или напишите свой.</div>
        ${state.support.map(m=>`<div class="msg ${m.me?"me":""}">${esc(m.text)}<time>${tm(m.t)}</time></div>`).join("")}</div>
      <div class="chips">${SUPPORT_Q.map(q=>`<button type="button">${q}</button>`).join("")}</div>
      <form class="searchrow" id="sf"><input id="si" autocomplete="off" placeholder="Ваш вопрос"><button class="btn sm" type="submit">Отправить</button></form>
      <button class="btn ghost" id="sx" type="button">Закрыть</button>`;
    const ask=v=>{trk("support_ask");state.support.push({me:true,text:v,t:Date.now()});state.support.push({me:false,text:supportAnswer(v),t:Date.now()});save();draw(s);const l=s.querySelector(".chatlog");s.querySelector(".sheet").scrollTop=l.scrollHeight};
    s.querySelectorAll(".chips button").forEach(b=>b.onclick=()=>ask(b.textContent));
    s.querySelector("#sf").onsubmit=e=>{e.preventDefault();const v=clip(s.querySelector("#si").value,500);if(v)ask(v)};
    s.querySelector("#sx").onclick=closeSheet;
  };
  sheet("",draw);
}

/* ---------- Доверие: проверка, отзывы, соцсети ---------- */
const CHECK=`<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const vbadge=`<span class="vbadge" title="Телефон и документы проверены">${CHECK}Проверен</span>`;
const REV_POOL=[["Мария",5,"Приехали вовремя, машина чистая, водитель вежливый."],["Олег",5,"Посылку доставил на следующий день, всё целое."],["Светлана",4,"Всё хорошо, только выехали на 30 минут позже."],["Игорь",5,"Помог с багажом, останавливались, когда просили."],["Татьяна",5,"Передала сладости маме, водитель сам привёз до двери."],["Раду",4,"Нормально доехали, договорились о цене без проблем."],["Анастасия",5,"Очень спокойная езда, рекомендую."]];
const hsh=t=>{let h=7;for(const c of t)h=(h*31+c.charCodeAt(0))%100003;return h};
const UNVERIFIED=["Георге","Марин","Дан"];
const COMPANIES={"Molda Trans":{idno:"1012600000001",phones:["+373 22 00 00 01","+373 69 000 001"],fax:"+373 22 00 00 02",email:"info@moldatrans.example"},
  "EuroBus MD":{idno:"1012600000002",phones:["+373 22 00 00 03"],fax:"",email:"booking@eurobus.example"}};
const cbadge=`<span class="vbadge" style="color:var(--ink)" title="Юридическое лицо">Компания</span>`;
function person(name){
  const me=state.user&&(name===state.user.name||name===state.user.cname),h=hsh(name);
  if(LIVE&&!me){const P=live.byName[name],x=P&&P.extra&&typeof P.extra==="object"?P.extra:{};
    const reviews=state.reviews.filter(r=>r.to===name).sort((a,b)=>b.t-a.t),rating=reviews.length?reviews.reduce((s,r)=>s+r.stars,0)/reviews.length:null;
    const str=v=>typeof v==="string"?clip(v,200):"";
    return {name,company:x.ltype==="company"?{idno:str(x.idno),phones:[str(x.cphone),str(x.cphone2)].filter(Boolean),fax:str(x.fax),email:str(x.email)}:null,
      phone:!!(P&&P.phone_ok),docs:!!(P&&P.verified),photo:safeImg(x.photo)||null,verified:!!(P&&P.verified),ig:str(x.ig)==="demo"?"":str(x.ig),fb:str(x.fb)==="demo"?"":str(x.fb),
      trips:state.routes.filter(r=>r.driver===name).length,since:P?new Date(P.created_at).getFullYear():new Date().getFullYear(),reviews,rating}}
  const seedRev=me?[]:[0,1,2].slice(0,2+h%2).map(i=>{const r=REV_POOL[(h+i*3)%REV_POOL.length];return {who:r[0],stars:r[1],text:r[2],t:Date.now()-(i+1)*(9+h%20)*864e5}});
  const reviews=[...state.reviews.filter(r=>r.to===name),...seedRev].sort((a,b)=>b.t-a.t);
  const rating=reviews.length?reviews.reduce((x,r)=>x+r.stars,0)/reviews.length:null;
  if(me){const u=state.user;const co=u.ltype==="company"?{idno:u.idno||"",phones:[u.cphone,u.cphone2].filter(Boolean),fax:u.fax||"",email:u.email||""}:null;return {name,me:true,company:co,phone:!LIVE||!!u.phoneOk,docs:!!u.docs,photo:u.photo||null,verified:!!u.docs,ig:u.ig||"",fb:u.fb||"",trips:state.routes.filter(r=>r.mine).length+state.bookings.length,since:2026,reviews,rating}}
  const ver=!UNVERIFIED.includes(name);
  return {name,company:COMPANIES[name]||null,phone:true,docs:ver,photo:null,verified:ver,ig:h%3!==0?"demo":"",fb:h%2===0?"demo":"",trips:5+h%170,since:2022+h%4,reviews,rating};
}
const ratingTxt=P=>P.rating?`★${P.rating.toFixed(1)} (${P.reviews.length})`:"новичок";
const nameBtn=n=>{const P=person(n);return `<button class="linkbtn" type="button" data-person="${esc(n)}">${esc(n)}</button> ${P.company?cbadge:""}${P.verified?vbadge:""}`};
const okUrl=(u,host)=>{try{const x=new URL(u);return x.protocol==="https:"&&(x.hostname===host||x.hostname.endsWith("."+host))}catch(e){return false}};
function socialBtns(P){
  const one=(v,label,host)=>!v?"":v==="demo"?`<button type="button" data-demo-social="${label}">${label}</button>`:okUrl(v,host)?`<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${label}</a>`:"";
  return one(P.ig,"Instagram","instagram.com")+one(P.fb,"Facebook","facebook.com");
}
function personSheet(name){
  const P=person(name),tm=t=>new Date(t).toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"});
  const row=(ok,t)=>`<span><b class="${ok?"y":"n"}">${ok?"✓":"–"}</b>${t}</span>`;
  const soc=socialBtns(P);
  sheet(`<div style="display:flex;gap:12px;align-items:center"><span class="ava big">${safeImg(P.photo)?`<img src="${safeImg(P.photo)}" alt="">`:esc(name[0])}</span>
      <div style="min-width:0"><h2>${esc(name)} ${P.company?cbadge:""}${P.verified?vbadge:""}</h2><p class="small muted">${ratingTxt(P)} · ${P.trips} поездок · в приложении с ${P.since} года</p></div></div>
    <div class="trust">${row(P.phone,"Номер телефона подтверждён")}${row(P.docs,P.docs?"Документы проверены":"Документы ещё не проверены")}${row(!!soc,soc?"Есть ссылки на соцсети":"Соцсети не указаны")}</div>
    ${P.company?`<div class="card"><h2>Контакты компании</h2>
      ${P.company.idno?`<div class="kv"><span class="muted">Рег. номер (IDNO)</span><span class="mono">${esc(P.company.idno)}</span></div>`:""}
      ${P.company.phones.map((t,i)=>`<div class="kv"><span class="muted">Телефон${P.company.phones.length>1?" "+(i+1):""}</span><span class="mono" style="user-select:all">${esc(t)}</span></div>`).join("")}
      ${P.company.fax?`<div class="kv"><span class="muted">Факс</span><span class="mono" style="user-select:all">${esc(P.company.fax)}</span></div>`:""}
      ${P.company.email?`<div class="kv"><span class="muted">E-mail</span><span style="user-select:all">${esc(P.company.email)}</span></div>`:""}</div>`:""}
    ${soc?`<div><p class="small muted" style="margin-bottom:6px">Посмотреть страницу перед поездкой:</p><div class="socials">${soc}</div></div>`:""}
    <h2>Отзывы</h2>
    <div>${P.reviews.length?P.reviews.map(r=>`<div class="review"><span><span class="stars">${"★".repeat(r.stars)}${"☆".repeat(5-r.stars)}</span> <b>${esc(r.who)}</b> <span class="small muted">· ${tm(r.t)}</span></span><span class="small">${esc(r.text)}</span></div>`).join(""):`<p class="small muted">Пока нет отзывов.</p>`}</div>
    <button class="btn ghost" type="button" id="pX">Закрыть</button>`,s=>{
    s.querySelector("#pX").onclick=closeSheet;
    s.querySelectorAll("[data-demo-social]").forEach(b=>b.onclick=()=>toast(`В демо ссылка ненастоящая. В рабочей версии откроется ${b.dataset.demoSocial} водителя`));
  });
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-person]");if(b){e.stopPropagation();e.preventDefault();personSheet(b.dataset.person)}},true);
function reviewSheet(b){
  let stars=5;
  const draw=s=>{s.querySelector(".sheet").innerHTML=`<h2>Отзыв о поездке</h2>
    <p class="small muted">${esc(b.title)} · водитель ${esc(b.driver)}. Отзыв увидят все, кто захочет поехать с этим водителем.</p>
    <div class="starpick" role="radiogroup" aria-label="Оценка">${[1,2,3,4,5].map(i=>`<button type="button" data-st="${i}" aria-pressed="${i<=stars}" aria-label="${i} из 5">★</button>`).join("")}</div>
    <label for="rvt">Что понравилось или нет<textarea id="rvt" placeholder="Например: приехал вовремя, помог с багажом"></textarea></label>
    <button class="btn" id="rvok" type="button">Отправить отзыв</button><button class="btn ghost" id="rvx" type="button">Отмена</button>`;
    s.querySelectorAll("[data-st]").forEach(x=>x.onclick=()=>{const t=s.querySelector("#rvt").value;stars=+x.dataset.st;draw(s);s.querySelector("#rvt").value=t});
    s.querySelector("#rvx").onclick=closeSheet;
    s.querySelector("#rvok").onclick=()=>{const t=clip(s.querySelector("#rvt").value,1000);if(!t){toast("Напишите пару слов о поездке");return}
      if(LIVE){api.post("reviews",{booking_id:b.id,stars,body:t}).then(()=>loadAll()).then(()=>{trk("review_sent",{stars});closeSheet();toast("Спасибо за отзыв!");renderProfile()},liveFail);return}
      state.reviews.push({to:b.driver,who:state.user.name,stars,text:t,t:Date.now()});b.reviewed=true;save();closeSheet();toast("Спасибо за отзыв!");renderProfile()};
  };
  sheet("",draw);
}
function verifySheet(){
  if(LIVE){toast("Проверка документов скоро появится. Мы напишем, когда её можно будет пройти");return}
  sheet(`<h2>Проверка документов</h2>
    <p>Проверка займёт пару минут: сфотографируйте паспорт или права и сделайте селфи. Проверку проводит специальный сервис (например, Veriff или Sumsub), а мы получаем только ответ «проверен» или «нет». Сами документы мы не храним.</p>
    <p class="small muted">После проверки рядом с вашим именем появится значок ${vbadge}. Таким водителям и попутчикам доверяют больше.</p>
    <button class="btn" id="vok" type="button">Пройти проверку (демо)</button><button class="btn ghost" id="vx" type="button">Позже</button>`,s=>{
    s.querySelector("#vx").onclick=closeSheet;
    s.querySelector("#vok").onclick=()=>{state.user.docs=true;save();closeSheet();toast("Готово! Теперь у вас значок «Проверен»");renderProfile()};
  });
}

/* ---------- Поделиться приложением ---------- */
const SITE_URL="https://autovinzare-code.github.io/dzhipies/";
const shareUrl=()=>/^https?:$/.test(location.protocol)&&!/claude|anthropic/.test(location.host)?location.href.split("#")[0]:SITE_URL;
const SHARE_TEXT="gotransfer: попутки, посылки и перевозка машин по Европе. Смотри на карте, кто едет в твою сторону, или бери попутчиков сам.";
function shareCard(){
  return state.shared
    ?`<div class="card sharecard"><h2>Спасибо, вы нам помогли!</h2><p>Каждый, кто узнает о gotransfer от вас, быстрее найдёт попутку или водителя для посылки.</p><button class="btn" type="button" data-share>Поделиться ещё раз</button></div>`
    :`<div class="card sharecard"><h2>Поделись один раз, помоги нам</h2><p>Чем больше людей в приложении, тем быстрее находится попутка, посылка уезжает в тот же день, а водители не едут с пустыми местами.</p><button class="btn" type="button" data-share>Поделиться приложением</button></div>`;
}
function markShared(){trk("share");if(!state.shared){state.shared=true;save();toast("Спасибо, что поделились!")}}
async function shareApp(){
  const url=shareUrl();
  if(navigator.share){try{await navigator.share({title:"gotransfer",text:SHARE_TEXT,url});markShared();rerenderShare();return}catch(e){if(e&&e.name==="AbortError")return}}
  const t=encodeURIComponent(SHARE_TEXT),u=encodeURIComponent(url),tu=encodeURIComponent(SHARE_TEXT+" "+url);
  const links=[["WhatsApp",`https://wa.me/?text=${tu}`],["Telegram",`https://t.me/share/url?url=${u}&text=${t}`],["Facebook",`https://www.facebook.com/sharer/sharer.php?u=${u}`],["Одноклассники",`https://connect.ok.ru/offer?url=${u}&title=${t}`],["ВКонтакте",`https://vk.com/share.php?url=${u}&title=${t}`],["Viber",`viber://forward?text=${tu}`]];
  sheet(`<h2>Поделиться gotransfer</h2>
    <p class="small muted">Выберите, где поделиться. Можно отправить другу или выложить у себя на странице.</p>
    <div class="sharegrid">${links.map(([n,h])=>`<a href="${h}" target="_blank" rel="noopener noreferrer">${n}</a>`).join("")}</div>
    <p class="small muted">Или скопируйте ссылку и вставьте куда угодно, например в Instagram:</p>
    <div class="sharelink"><input id="shl" readonly value="${esc(url)}" aria-label="Ссылка на приложение"><button class="btn sm" id="shc" type="button">Копировать</button></div>
    <button class="btn ghost" id="shx" type="button">Закрыть</button>`,s=>{
    s.querySelectorAll(".sharegrid a").forEach(a=>a.addEventListener("click",()=>{markShared();rerenderShare()}));
    s.querySelector("#shc").onclick=()=>{const i=s.querySelector("#shl");
      const ok=()=>{toast("Ссылка скопирована");markShared();rerenderShare()};
      try{navigator.clipboard.writeText(i.value).then(ok,()=>{i.select();toast("Выделили ссылку, скопируйте её")})}catch(e){i.select();toast("Выделили ссылку, скопируйте её")}};
    s.querySelector("#shx").onclick=closeSheet;
  });
}
function rerenderShare(){$$(".sharecard").forEach(c=>{c.outerHTML=shareCard()});bindShare()}
function bindShare(){$$("[data-share]").forEach(b=>b.onclick=shareApp)}

/* ---------- Админка: история действий людей ----------
   Данные отдаёт только сервер и только админу (функции admin_* проверяют is_admin()). Кнопка в профиле лишь удобство.
   В демо-режиме админка открывается по адресу …/#admin и показывает действия только на этом устройстве. */
const ADM={days:7,q:"",user:null,ev:[],more:false,users:null,ov:null,load:0};
const admOk=()=>!!state.user&&(LIVE?!!state.user.isAdmin:location.hash==="#admin");
const EVN={screen:"Экран",click:"Нажатие",sheet:"Окно",search:"Выбор города",route_open:"Просмотр маршрута",route_publish:"Подал объявление",
  wait_publish:"Поставил точку ожидания",booking:"Бронь",message_sent:"Отправил сообщение (текст не записывается)",review_sent:"Оставил отзыв",login:"Вход",
  register:"Регистрация",logout:"Выход",support_ask:"Вопрос в поддержку",share:"Поделился приложением",toast:"Подсказка на экране",consent:"Разрешил запись истории"};
const SCRN={map:"Карта",publish:"Я еду",chats:"Чаты",chat:"Переписка",profile:"Профиль",admin:"Админка","auth:start":"Вход","auth:email":"Ввод почты",
  "auth:email-code":"Код из письма","auth:tgcode":"Код из Telegram","auth:name":"Ввод имени","auth:linktg":"Подключение Telegram","auth:gwait":"Вход через Google",
  "auth:phone":"Вход (демо)","auth:code":"Код (демо)"};
const scrName=s=>SCRN[s]||s||"";
const DEVN={phone:"телефон",pc:"компьютер","phone-app":"телефон, приложение","pc-app":"компьютер, приложение"};
function admLocal(){return store.get("trklog",[]).filter(e=>e&&typeof e==="object").map(e=>({...e,at:new Date(e.at).toISOString()}))}
function admLocalOverview(d){const since=Date.now()-d*864e5,ev=admLocal().filter(e=>Date.parse(e.at)>since),cnt=(f,key)=>{const m={};ev.filter(f).forEach(e=>{const k=key(e);m[k]=(m[k]||0)+1});return Object.entries(m).map(([k,n])=>({k,n})).sort((a,b)=>b.n-a.n)};
  const by={};ev.forEach(e=>by[e.n]=(by[e.n]||0)+1);
  return {users_total:1,users_new:0,active_today:ev.some(e=>Date.parse(e.at)>new Date().setHours(0,0,0,0))?1:0,active:ev.length?1:0,guests:0,events:ev.length,
    routes:by.route_publish||0,requests:by.wait_publish||0,bookings:by.booking||0,by_name:by,
    screens:cnt(e=>e.n==="screen",e=>e.s).slice(0,12),clicks:cnt(e=>e.n==="click",e=>e.t).slice(0,15),
    days:cnt(()=>true,e=>e.at.slice(0,10)).sort((a,b)=>a.k<b.k?1:-1).map(x=>({d:x.k,n:x.n,u:1})),retention_months:store.get("trkret",12)}}
const admApi={
  overview:d=>LIVE?api.rpc("admin_overview",{p_days:d}):Promise.resolve(admLocalOverview(d)),
  users:q=>LIVE?api.rpc("admin_users",{p_q:q,p_limit:100,p_offset:0}):Promise.resolve([{id:"local",name:"Вы (это устройство, демо)",email:"",created_at:null,last_at:(admLocal().slice(-1)[0]||{}).at||null,n30:admLocal().length}]),
  events:(id,before)=>LIVE?api.rpc("admin_user_events",{p_profile:id,p_before:before||null,p_limit:200})
    :Promise.resolve(admLocal().filter(e=>!before||e.at<before).reverse().slice(0,200)),
  retention:m=>LIVE?api.rpc("admin_set_retention",{p_months:m}):(store.set("trkret",m),Promise.resolve())
};
const fmtDT=t=>t?new Date(t).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
function evText(e){const p=e.p&&typeof e.p==="object"?e.p:{};
  if(e.n==="screen")return scrName(e.s);
  if(e.n==="consent"||e.n==="message_sent"||e.n==="logout"||e.n==="support_ask"||e.n==="share")return "";
  if(e.n==="click"||e.n==="sheet"||e.n==="toast")return e.t||"";
  if(e.n==="search")return [p.field,p.city].filter(Boolean).join(": ")+(p.where?" ("+p.where+")":"");
  if(e.n==="booking")return [p.route,p.kind&&KINDS[p.kind]?KINDS[p.kind].t:p.kind,p.qty].filter(x=>x!=null&&x!=="").join(" · ");
  if(e.n==="route_publish"||e.n==="wait_publish")return (p.from||"")+" → "+(p.to||"")+(p.what?" · "+String(p.what).split(",").map(k=>KINDS[k]?KINDS[k].t:k).join(", "):"");
  if(e.n==="login"||e.n==="register")return p.method?({telegram:"код из Telegram",email:"код из письма",google:"Google",demo:"демо"}[p.method]||p.method):"";
  return Object.values(p).join(" · ")}
function admTop(list,label){return list&&list.length?list.map(x=>`<div class="kv"><span>${esc(label(x.k)||"—")}</span><b>${x.n}</b></div>`).join(""):`<p class="small muted">Пока пусто.</p>`}
async function admLoad(){const my=++ADM.load;
  try{const [ov,us]=await Promise.all([admApi.overview(ADM.days),admApi.users(ADM.q)]);if(my!==ADM.load)return;ADM.ov=ov;ADM.users=us}
  catch(e){if(my!==ADM.load)return;ADM.ov=ADM.ov||{};ADM.users=ADM.users||[];toast(errText(e))}
  if(state.tab==="admin"&&!ADM.user)renderAdmin()}
async function admOpenUser(u){ADM.user=u;ADM.ev=null;ADM.more=false;renderAdmin();
  try{ADM.ev=await admApi.events(u.id);ADM.more=ADM.ev.length>=200}catch(e){ADM.ev=[];toast(errText(e))}
  if(state.tab==="admin"&&ADM.user===u)renderAdmin()}
function renderAdmin(){
  if(!admOk()){state.tab="profile";save();return render()}
  if(ADM.user)return renderAdminUser();
  if(!ADM.ov&&!ADM.pending){ADM.pending=true;admLoad().finally(()=>{ADM.pending=false})}
  const o=ADM.ov,b=o&&o.by_name||{},n=v=>Number.isFinite(+v)?+v:0;
  view.innerHTML=`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button class="btn ghost sm" id="adback" type="button">← Профиль</button><h1 style="margin:0">Админка</h1></div>
    ${LIVE?"":`<div class="hint">Демо-режим: здесь видно только то, что делали на этом устройстве. На настоящем сервере тут будут все люди.</div>`}
    <div class="seg" id="addays">${[[1,"Сегодня"],[7,"7 дней"],[30,"30 дней"],[90,"90 дней"]].map(([d,t])=>`<button type="button" data-d="${d}" aria-pressed="${ADM.days===d}">${t}</button>`).join("")}</div>
    ${!o?`<div class="card"><p class="muted" role="status">Загружаем…</p></div>`:`
    <div class="admtiles">
      <div class="card"><span class="small muted">Людей всего</span><b>${n(o.users_total)}</b><span class="small muted">новых: ${n(o.users_new)}</span></div>
      <div class="card"><span class="small muted">Активны сегодня</span><b>${n(o.active_today)}</b><span class="small muted">за период: ${n(o.active)}</span></div>
      <div class="card"><span class="small muted">Гости без входа</span><b>${n(o.guests)}</b><span class="small muted">за период</span></div>
      <div class="card"><span class="small muted">Действий</span><b>${n(o.events)}</b><span class="small muted">за период</span></div>
    </div>
    <div class="card"><h2>Главное за период</h2>
      <div class="kv"><span>Входы</span><b>${n(b.login)}</b></div><div class="kv"><span>Регистрации</span><b>${n(b.register)}</b></div>
      <div class="kv"><span>Выбор города в поиске</span><b>${n(b.search)}</b></div><div class="kv"><span>Просмотры маршрутов</span><b>${n(b.route_open)}</b></div>
      <div class="kv"><span>Новые объявления (маршруты)</span><b>${n(o.routes)}</b></div><div class="kv"><span>Точки ожидания</span><b>${n(o.requests)}</b></div>
      <div class="kv"><span>Брони</span><b>${n(o.bookings)}</b></div><div class="kv"><span>Отправлено сообщений</span><b>${n(b.message_sent)}</b></div>
      <p class="small muted" style="margin:0">Объявления, точки и брони считаются по базе, остальное только у тех, кто разрешил запись истории.</p></div>
    <div class="admcols">
      <div class="card"><h2>Какие экраны открывают</h2>${admTop(o.screens,scrName)}</div>
      <div class="card"><h2>Куда чаще нажимают</h2>${admTop(o.clicks,x=>x)}</div>
    </div>
    <div class="card"><h2>По дням</h2>${(o.days||[]).length?`<div class="kv small muted"><span>День</span><span>действий · людей</span></div>`+(o.days||[]).map(x=>`<div class="kv"><span>${esc(new Date(x.d).toLocaleDateString("ru-RU",{weekday:"short",day:"2-digit",month:"2-digit"}))}</span><b>${n(x.n)} · ${n(x.u)}</b></div>`).join(""):`<p class="small muted">Пока пусто.</p>`}</div>`}
    <div class="card"><h2>Люди</h2>
      <form class="searchrow" id="adq"><input id="adqi" type="search" autocomplete="off" placeholder="Имя, компания или почта" value="${esc(ADM.q)}" aria-label="Найти человека"><button class="btn sm" type="submit">Найти</button></form>
      <div class="list">${ADM.users==null?`<p class="small muted" role="status">Загружаем…</p>`:ADM.users.length?ADM.users.map((u,i)=>`<button class="card admuser" type="button" data-u="${i}"><span class="ava">${esc((u.name||"?")[0]||"?")}</span><span class="t"><b>${esc(u.name||"Без имени")}</b> <span class="small muted">${esc(u.email||"")}</span><p class="small muted">Последний раз: ${fmtDT(u.last_at)} · действий за 30 дней: ${n(u.n30)}</p></span></button>`).join(""):`<p class="small muted">Никого не нашли.</p>`}</div>
    </div>
    <div class="card"><h2>Сколько хранить историю</h2>
      <p class="small muted" style="margin:0">Записи старше этого срока сервер удаляет сам. Больше 12 месяцев нельзя: так мы обещаем людям в уведомлении.</p>
      <div class="searchrow"><select id="adret" aria-label="Срок хранения">${[1,3,6,12].map(m=>`<option value="${m}" ${n(o&&o.retention_months||12)===m?"selected":""}>${m} ${m===1?"месяц":m<5?"месяца":"месяцев"}</option>`).join("")}</select><button class="btn sm" id="adrets" type="button">Сохранить</button></div>
    </div>`;
  $("#adback").onclick=()=>goTab("profile");
  $$("#addays button").forEach(x=>x.onclick=()=>{ADM.days=+x.dataset.d;ADM.ov=null;renderAdmin();admLoad()});
  $("#adq").onsubmit=e=>{e.preventDefault();ADM.q=clip($("#adqi").value,100);ADM.users=null;renderAdmin();admLoad()};
  $$("[data-u]").forEach(x=>x.onclick=()=>admOpenUser(ADM.users[+x.dataset.u]));
  $("#adrets").onclick=()=>{const m=+$("#adret").value;admApi.retention(m).then(()=>{if(ADM.ov)ADM.ov.retention_months=m;toast("Срок хранения: "+m+" мес.")},liveFail)};
  trkScreen();
}
function renderAdminUser(){
  const u=ADM.user,ev=ADM.ev||[];let day="",sid="",rows="";
  for(const e of ev){const d=new Date(e.at),dk=d.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    if(dk!==day){day=dk;sid="";rows+=`<h3 class="admday">${esc(dk[0].toUpperCase()+dk.slice(1))}</h3>`}
    if(e.sid&&e.sid!==sid){sid=e.sid;rows+=`<p class="small muted admsess">Заход с устройства: ${esc(DEVN[e.dev]||e.dev||"—")}</p>`}
    rows+=`<div class="admev"><time class="mono small">${d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</time><span><b>${esc(EVN[e.n]||e.n)}</b> ${esc(evText(e))}${e.n!=="screen"&&e.s?`<br><span class="small muted">на экране «${esc(scrName(e.s))}»</span>`:""}</span></div>`}
  view.innerHTML=`<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button class="btn ghost sm" id="adub" type="button">← Все люди</button><h1 style="margin:0">${esc(u.name||"Без имени")}</h1></div>
    <div class="card"><div class="kv"><span>Почта</span><b>${esc(u.email||"—")}</b></div><div class="kv"><span>Регистрация</span><b>${fmtDT(u.created_at)}</b></div>
      <div class="kv"><span>Последнее действие</span><b>${fmtDT(u.last_at)}</b></div><div class="kv"><span>Действий за 30 дней</span><b>${Number(u.n30)||0}</b></div></div>
    <div class="card"><h2>История действий</h2><p class="small muted" style="margin:0">Сначала новые. Текст сообщений, коды и то, что человек печатает, не записываются.</p>
      ${ev.length?rows:`<p class="small muted" role="status">${ADM.ev===null?"Загружаем…":"Нет записей. Возможно, человек не разрешил запись истории."}</p>`}
      ${ADM.more?`<button class="btn ghost" id="admore" type="button">Показать ещё</button>`:""}</div>`;
  $("#adub").onclick=()=>{ADM.user=null;renderAdmin()};
  if($("#admore"))$("#admore").onclick=async()=>{const b=$("#admore");b.disabled=true;
    try{const more=await admApi.events(u.id,ev[ev.length-1].at);ADM.ev=ev.concat(more);ADM.more=more.length>=200}catch(e){toast(errText(e))}
    if(ADM.user===u)renderAdminUser()};
}

/* ---------- Каркас ---------- */
/* Безопасность: любое текстовое поле получает предел длины, чтобы не забить память огромным текстом */
new MutationObserver(()=>$$("input:not([maxlength]):not([type=file]):not([type=number]):not([type=date]):not([type=time]),textarea:not([maxlength])").forEach(el=>el.maxLength=el.tagName==="TEXTAREA"?1000:200)).observe(document.body,{childList:true,subtree:true});
function render(keep){
  const y=window.scrollY;
  closeSheet();
  $(".app").dataset.tab=state.user?state.tab:"auth";
  if(curGL&&state.tab!=="map"&&state.tab!=="publish"){curGL.remove();curGL=null}
  $("#fab").hidden=$("#helpintro").hidden=!state.user;
  trkAsk();
  if(!state.user){renderAuth();trkScreen();return}
  if(!window.d3||!window.EU_MAP){view.innerHTML=`<div class="card empty">Не удалось загрузить карту. Проверьте интернет и обновите страницу.</div>`;return}
  $("#tabs").hidden=false;
  $("#who").innerHTML=`${esc(state.user.name)}<br><span class="mono">${esc(state.user.phone||state.user.loginEmail||"")}</span>`;
  $$("#tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===state.tab?"page":"false"));
  updateBadge();
  ({map:renderMap,publish:renderPublish,chats:renderChats,profile:renderProfile,admin:renderAdmin}[state.tab]||renderMap)();
  if(keep===true)window.scrollTo(0,y);else if(state.tab!=="chats")window.scrollTo(0,0);
  if(state.tab!=="chats"&&state.tab!=="admin")trkScreen();
  if(!state.seenIntro)showIntro(0);
}
$("#fab").onclick=openSupport;$("#helpintro").onclick=()=>showIntro(0);
function goTab(t){state.tab=t;if(t==="chats")state.openChat=null;save();render();
  if(LIVE&&(t==="map"||t==="profile"))loadAll().then(()=>{if(state.user&&state.tab===t&&!$(".scrim"))render()},()=>{})}
$$("#tabs button[data-tab]").forEach(b=>b.onclick=()=>goTab(b.dataset.tab));

/* ---------- Горячие клавиши для компьютера ---------- */
const TAB_KEYS=["map","publish","chats","profile"];
$$("#tabs button[data-tab]").forEach((b,i)=>b.title=b.textContent.trim()+" (клавиша "+(i+1)+")");
function keysSheet(){const k=(...a)=>`<span>${a.map(x=>`<kbd class="kbd">${x}</kbd>`).join("")}</span>`;
  sheet(`<h2>Горячие клавиши</h2><p class="small muted">Работают, когда курсор не стоит в поле ввода.</p>
    <div class="keys">${k("1")}<span>Карта</span>${k("2")}<span>Я еду, могу взять</span>${k("3")}<span>Чаты</span>${k("4")}<span>Профиль</span>
    ${k("/")}<span>Найти город «Откуда»</span>${k("Ctrl","K")}<span>То же самое из любого места</span>${k("+","−")}<span>Приблизить или отдалить карту</span>${k("Esc")}<span>Закрыть окно</span>${k("?")}<span>Этот список</span></div>
    <button class="btn" id="kok" type="button">Понятно</button>`,s=>{s.querySelector("#kok").onclick=closeSheet})}
$("#keyhelp").onclick=keysSheet;
function focusSearch(){if(!state.user)return;
  if(state.tab!=="map"&&state.tab!=="publish"){state.tab="map";save();render()}
  const o=state.tab==="publish"?state.pub:state;if(!o.pick){o.pick="A";render()}
  const q=$("#q");if(q){q.focus();q.select()}}
addEventListener("keydown",e=>{
  if(e.key==="Escape"){const open=$$(".scrim");if(open.length){open.forEach(x=>x.parentNode.removeChild(x));e.preventDefault()}return}
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==="k"){e.preventDefault();closeSheet();focusSearch();return}
  const t=e.target;if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing||t.closest&&t.closest("input,textarea,select,[contenteditable]"))return;
  if(!state.user||$(".scrim"))return;
  const n=TAB_KEYS[+e.key-1];
  if(n){e.preventDefault();goTab(n);return}
  if(e.key==="/"){e.preventDefault();focusSearch();return}
  if(e.key==="?"){e.preventDefault();keysSheet();return}
  if((e.key==="+"||e.key==="="||e.key==="-"||e.key==="_")){const z=$(e.key==="+"||e.key==="="?"#zin":"#zout");if(z){e.preventDefault();z.click()}}
});

probeRealMap();
/* На телефоне «resize» срабатывает при прокрутке (прячется адресная строка) и при открытии клавиатуры.
   Перерисовываем только когда реально поменялась ширина экрана, и не сбрасываем прокрутку. */
let rt,lastW=innerWidth;addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(innerWidth===lastW)return;lastW=innerWidth;
  const a=document.activeElement;if(state.user&&(state.tab==="map"||state.tab==="publish")&&!(a&&a.closest&&a.closest("input,textarea,select")))render(true)},300)});
render();
if(LIVE&&state.user)startLive();
else if(LIVE)googleReturn();
})();
