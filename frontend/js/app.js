const API=(window.VYRA_CONFIG?.API_BASE||"/api").replace(/\/$/,"");
const SOCKET_URL=window.VYRA_CONFIG?.SOCKET_URL||"";
const app=document.getElementById("app");
const state={token:localStorage.getItem("vyra_token"),user:null,route:"home",socket:null,activeConversation:null};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const initials=s=>esc(String(s||"V").trim().charAt(0)||"V");

async function api(path,opts={}){
 const headers={...(opts.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(state.token?{Authorization:"Bearer "+state.token}:{}),...(opts.headers||{})};
 const r=await fetch(API+path,{...opts,headers});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||"حدث خطأ");
 return d;
}
function saveAuth(d){state.token=d.token;state.user=d.user;localStorage.setItem("vyra_token",d.token)}
function logout(){state.token=null;state.user=null;localStorage.removeItem("vyra_token");if(state.socket)state.socket.disconnect();location.hash="login";render()}
function navigate(route){location.hash=route}
function active(route){return state.route===route?"active":""}

function shell(title,body){
 return `<div class="app-shell">
 <header class="topbar"><a class="logo" href="#home">VYRA<span>.</span></a>
 <div class="row"><button class="icon-btn" onclick="navigate('search')" aria-label="بحث">⌕</button>
 <button class="icon-btn" onclick="navigate('notifications')" aria-label="الإشعارات">♡</button></div></header>
 <main class="page">${title?`<div class="row" style="margin:4px 2px 14px"><h2 style="margin:0">${esc(title)}</h2></div>`:""}${body}</main>
 ${nav()}
 </div>`;
}
function nav(){
 return `<nav class="bottom-nav"><div class="nav-inner">
 <button class="nav-item ${active("home")}" onclick="navigate('home')"><span class="ico">⌂</span>الرئيسية</button>
 <button class="nav-item ${active("explore")}" onclick="navigate('explore')"><span class="ico">◈</span>استكشاف</button>
 <button class="nav-item ${active("create")}" onclick="navigate('create')"><span class="ico">＋</span>نشر</button>
 <button class="nav-item ${active("messages")}" onclick="navigate('messages')"><span class="ico">✉</span>الرسائل</button>
 <button class="nav-item ${active("profile")}" onclick="navigate('profile')"><span class="ico">◉</span>حسابي</button>
 </div></nav>`;
}

function renderAuth(){
 app.innerHTML=`<div class="auth"><div class="card auth-card">
 <div class="logo">VYRA<span>.</span></div><h1 style="margin:0 0 5px">مرحبًا بك في فيرا</h1>
 <div class="muted">شبكة اجتماعية عربية حديثة.</div>
 <div class="auth-switch"><button id="loginTab" class="active">دخول</button><button id="registerTab">حساب جديد</button></div>
 <form id="authForm" class="auth-form"></form></div></div>`;
 const form=document.getElementById("authForm"),lt=document.getElementById("loginTab"),rt=document.getElementById("registerTab");
 function fields(reg=false){form.innerHTML=(reg?`<input name="name" placeholder="الاسم" required>`:"")+`<input name="username" placeholder="اسم المستخدم" required><input name="password" type="password" placeholder="كلمة المرور" required><button class="primary">${reg?"إنشاء الحساب":"تسجيل الدخول"}</button><div id="err" class="error"></div>`}
 fields();
 lt.onclick=()=>{lt.classList.add("active");rt.classList.remove("active");fields(false)};
 rt.onclick=()=>{rt.classList.add("active");lt.classList.remove("active");fields(true)};
 form.onsubmit=async e=>{e.preventDefault();try{const d=await api(lt.classList.contains("active")?"/auth/login":"/auth/register",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(form)))});saveAuth(d);navigate("home");render()}catch(x){document.getElementById("err").textContent=x.message}}
}

function stories(){
 const names=["أنت","ليان","سارة","علي","نور","زيد","رؤى"];
 return `<section class="stories">${names.map((n,i)=>`<div class="story ${i===0?"story-add":""}" onclick="${i===0?"navigate('create')":""}"><div class="story-ring"><div>${i===0?"＋":initials(n)}</div></div>${esc(n)}</div>`).join("")}</section>`;
}

async function renderHome(){
 app.innerHTML=shell("",`<div class="hero card"><div class="row"><div><h1>أهلاً ${esc(state.user?.name||"بك")} 👋</h1><div class="muted">شارك لحظتك مع مجتمع فيرا.</div></div><div class="avatar lg">${initials(state.user?.name)}</div></div></div>
 ${stories()}<div id="feed"><div class="card empty muted">جاري تحميل المنشورات...</div></div>`);
 loadFeed();
}
async function loadFeed(){
 const feed=document.getElementById("feed"); if(!feed)return;
 try{
  const posts=await api("/posts");
  feed.innerHTML=posts.length?posts.map(postCard).join(""):`<div class="card empty muted">لا توجد منشورات بعد. كن أول من ينشر.</div>`;
 }catch(e){feed.innerHTML=`<div class="card empty error">${esc(e.message)}</div>`}
}
function postCard(p){
 const media=p.image_url?((/\.(mp4|webm|mov)$/i.test(p.image_url))?`<video class="post-media" controls src="${esc(p.image_url)}"></video>`:`<img class="post-media" src="${esc(p.image_url)}" alt="">`):"";
 return `<article class="card post"><div class="post-head"><div class="user"><div class="avatar">${initials(p.name)}</div><div><strong>${esc(p.name)}</strong> <span class="verified">✦</span><div class="muted">@${esc(p.username)}</div></div></div><small class="muted">${esc(p.created_at)}</small></div>
 <div class="post-text">${esc(p.text)}</div>${media}<div class="actions"><button class="action" data-like="${p.id}">♡ ${p.likes||0}</button><button class="action" data-comments="${p.id}">💬 تعليقات</button><button class="action" onclick="sharePost(${p.id})">↗ مشاركة</button></div><div id="comments-${p.id}" class="comments hidden"></div></article>`;
}
async function sharePost(id){try{await navigator.clipboard?.writeText(location.href+"#post-"+id);alert("تم نسخ رابط المنشور")}catch{alert("يمكنك مشاركة رابط الصفحة")}}

async function renderCreate(){
 app.innerHTML=shell("إنشاء منشور",`<form id="composer" class="card composer"><textarea name="text" placeholder="بماذا تفكر؟ شارك منشورًا..." required></textarea><div class="form-row"><input name="file" type="file" accept="image/*,video/*"><button class="primary">نشر الآن</button></div><div id="createErr" class="error"></div></form>`);
 document.getElementById("composer").onsubmit=async e=>{
  e.preventDefault();const fd=new FormData(e.target),text=fd.get("text"),file=fd.get("file");
  try{let image_url="";if(file&&file.size){const up=new FormData();up.append("file",file);const r=await fetch(API+"/upload",{method:"POST",headers:{Authorization:"Bearer "+state.token},body:up});const d=await r.json();if(!r.ok)throw Error(d.error||"فشل رفع الملف");image_url=d.url}await api("/posts",{method:"POST",body:JSON.stringify({text,image_url})});navigate("home");render()}catch(x){document.getElementById("createErr").textContent=x.message}
 };
}

async function renderExplore(){
 app.innerHTML=shell("استكشاف",`<div class="search-box"><input id="exploreSearch" placeholder="ابحث عن أشخاص..."><button class="primary" id="doSearch">بحث</button></div><div id="exploreResults" class="list"></div><div class="card hero" style="margin-top:12px"><strong>اكتشف المزيد</strong><p class="muted">ابحث عن المستخدمين وابدأ محادثة جديدة.</p></div>`);
 const run=async()=>{const q=document.getElementById("exploreSearch").value.trim();const box=document.getElementById("exploreResults");if(!q){box.innerHTML="";return}try{const users=await api("/users");const found=users.filter(u=>(u.name+" "+u.username).toLowerCase().includes(q.toLowerCase()));box.innerHTML=found.length?found.map(u=>`<div class="list-row"><div class="user"><div class="avatar">${initials(u.name)}</div><div><strong>${esc(u.name)}</strong><div class="muted">@${esc(u.username)}</div></div></div><button class="secondary" onclick="startChat(${u.id})">مراسلة</button></div>`).join(""):`<div class="muted">لا توجد نتائج.</div>`}catch(e){box.innerHTML=`<div class="error">${esc(e.message)}</div>`}};
 document.getElementById("doSearch").onclick=run;document.getElementById("exploreSearch").onkeydown=e=>{if(e.key==="Enter")run()};
}

async function renderSearch(){await renderExplore()}

async function renderProfile(){
 const u=state.user||{}; 
 app.innerHTML=shell("حسابي",`<section class="card profile"><div class="profile-top"><div class="avatar lg">${initials(u.name)}</div><div><h2 style="margin:0">${esc(u.name||"مستخدم فيرا")} <span class="verified">✦</span></h2><div class="muted">@${esc(u.username||"")}</div><p class="muted">مرحبًا بك في ملفي على VYRA.</p></div></div>
 <div class="profile-actions"><button class="secondary" onclick="navigate('settings')">الإعدادات</button><button class="primary" onclick="navigate('create')">＋ منشور</button></div>
 <div class="statbar"><div class="stat"><b>0</b><span class="muted">منشورات</span></div><div class="stat"><b>0</b><span class="muted">متابعون</span></div><div class="stat"><b>0</b><span class="muted">يتابع</span></div></div></section>
 <div class="tabs"><button class="tab active">منشوراتي</button><button class="tab">الوسائط</button></div><div class="card empty muted">ستظهر منشوراتك هنا.</div>`);
}

function renderNotifications(){
 app.innerHTML=shell("الإشعارات",`<div class="list"><div class="list-row"><div class="user"><div class="avatar">♡</div><div><strong>أهلاً بك في VYRA</strong><div class="muted">ابدأ بمتابعة الأشخاص ومشاركة أول منشور.</div></div></div></div><div class="list-row"><div class="user"><div class="avatar">✦</div><div><strong>ميزات جديدة</strong><div class="muted">تم تجهيز واجهة VYRA v1.5 للموبايل.</div></div></div></div></div>`);
}

function renderSettings(){
 app.innerHTML=shell("الإعدادات",`<div class="card hero"><div class="settings-row"><strong>الحساب</strong><div class="muted">إدارة بيانات حسابك</div></div><div class="settings-row"><strong>الخصوصية</strong><div class="muted">إعدادات الخصوصية ستضاف في المرحلة القادمة.</div></div><div class="settings-row"><strong>اللغة</strong><div class="muted">العربية — RTL</div></div><div class="settings-row"><button class="secondary" onclick="logout()">تسجيل الخروج</button></div></div>`);
}

async function renderMessages(){
 app.innerHTML=shell("الرسائل",`<div id="chatUsers" class="card" style="padding:10px"><div class="empty muted">جاري التحميل...</div></div><div id="chatBox" class="card hidden" style="margin-top:10px"></div>`);
 try{const users=await api("/users");document.getElementById("chatUsers").innerHTML=users.length?`<div class="list">${users.map(u=>`<div class="list-row"><div class="user"><div class="avatar">${initials(u.name)}</div><div><strong>${esc(u.name)}</strong><div class="muted">@${esc(u.username)}</div></div></div><button class="secondary" onclick="startChat(${u.id})">مراسلة</button></div>`).join("")}</div>`:`<div class="empty muted">لا يوجد مستخدمون آخرون بعد.</div>`}catch(e){document.getElementById("chatUsers").innerHTML=`<div class="error">${esc(e.message)}</div>`}
 connectSocket();
}
function connectSocket(){
 if(state.socket||!state.token||!window.io)return;
 state.socket=io(SOCKET_URL,{transports:["polling","websocket"],auth:{token:state.token},reconnection:true});
 state.socket.on("message:new",msg=>{if(state.activeConversation&&Number(msg.conversation_id)===Number(state.activeConversation))loadMessages(state.activeConversation,true)});
}
async function startChat(userId){
 try{const c=await api("/conversations",{method:"POST",body:JSON.stringify({user_id:userId})});state.activeConversation=c.id;connectSocket();state.socket?.emit("conversation:join",c.id);await loadMessages(c.id,true)}catch(e){alert(e.message)}
}
async function loadMessages(cid,scroll=false){
 const box=document.getElementById("chatBox");if(!box)return;box.classList.remove("hidden");
 try{const msgs=await api("/conversations/"+cid+"/messages");box.innerHTML=`<div class="chat-window"><div class="row" style="padding:12px;border-bottom:1px solid var(--line)"><strong>المحادثة</strong><button class="ghost" onclick="closeChat()">إغلاق</button></div><div id="messageList" class="message-list">${msgs.map(m=>`<div class="bubble ${Number(m.sender_id)===Number(state.user.id)?"mine":""}"><div>${esc(m.text)}</div><small class="muted">${esc(m.name)}</small></div>`).join("")}</div><form id="messageForm" class="message-form"><input name="text" placeholder="اكتب رسالة..." required autocomplete="off"><button class="primary">إرسال</button></form></div>`;
 document.getElementById("messageForm").onsubmit=async e=>{e.preventDefault();const text=new FormData(e.target).get("text");await api("/conversations/"+cid+"/messages",{method:"POST",body:JSON.stringify({text})});e.target.reset();loadMessages(cid,true)};if(scroll)document.getElementById("messageList").scrollTop=999999}catch(e){box.innerHTML=`<div class="empty error">${esc(e.message)}</div>`}
}
function closeChat(){if(state.socket&&state.activeConversation)state.socket.emit("conversation:leave",state.activeConversation);state.activeConversation=null;document.getElementById("chatBox")?.classList.add("hidden")}

async function render(){
 state.route=(location.hash||"#home").slice(1)||"home";
 if(!state.token){if(state.route!=="login")state.route="login";renderAuth();return}
 try{if(!state.user)state.user=await api("/me")}catch{logout();return}
 switch(state.route){
  case"home":await renderHome();break;case"create":await renderCreate();break;case"explore":await renderExplore();break;case"search":await renderSearch();break;case"messages":await renderMessages();break;case"profile":await renderProfile();break;case"notifications":renderNotifications();break;case"settings":renderSettings();break;default:navigate("home");break;
 }
}
document.addEventListener("click",async e=>{
 const like=e.target.closest("[data-like]");if(like){try{await api("/posts/"+like.dataset.like+"/like",{method:"POST"});loadFeed()}catch(x){alert(x.message)}}
 const cb=e.target.closest("[data-comments]");if(cb){const box=document.getElementById("comments-"+cb.dataset.comments);if(!box)return;if(!box.classList.contains("hidden")){box.classList.add("hidden");return}box.classList.remove("hidden");box.innerHTML='<div class="muted">جاري التحميل...</div>';try{const cs=await api("/posts/"+cb.dataset.comments+"/comments");box.innerHTML=`${cs.map(c=>`<div class="comment"><strong>${esc(c.name)}</strong><div>${esc(c.text)}</div></div>`).join("")}<form class="comment-form"><input name="text" placeholder="اكتب تعليقًا..." required><button class="secondary">إرسال</button></form>`;box.querySelector("form").onsubmit=async ev=>{ev.preventDefault();const text=new FormData(ev.target).get("text");await api("/posts/"+cb.dataset.comments+"/comments",{method:"POST",body:JSON.stringify({text})});cb.click();cb.click()}}catch(x){box.innerHTML=`<div class="error">${esc(x.message)}</div>`}}
});
window.addEventListener("hashchange",render);
render();
