import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const db = new Database(path.join(__dirname, "vyra.db"));
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const uploadsDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDir, {recursive:true});
const upload = multer({dest: uploadsDir, limits:{fileSize:25*1024*1024}});

app.use(cors());
app.use(express.json({limit:"2mb"}));

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 bio TEXT DEFAULT '',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 text TEXT NOT NULL,
 image_url TEXT DEFAULT '',
 likes INTEGER DEFAULT 0,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS follows(
 follower_id INTEGER NOT NULL,
 following_id INTEGER NOT NULL,
 UNIQUE(follower_id, following_id)
);
CREATE TABLE IF NOT EXISTS comments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 text TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(post_id) REFERENCES posts(id),
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS conversations(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conversation_members(
 conversation_id INTEGER NOT NULL,
 user_id INTEGER NOT NULL,
 UNIQUE(conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS messages(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 conversation_id INTEGER NOT NULL,
 sender_id INTEGER NOT NULL,
 text TEXT NOT NULL,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function tokenFor(user){ return jwt.sign({id:user.id,username:user.username}, JWT_SECRET,{expiresIn:"30d"}); }
function auth(req,res,next){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return res.status(401).json({error:"تسجيل الدخول مطلوب"});
  try{ req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch{ return res.status(401).json({error:"الجلسة غير صالحة"}); }
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"VYRA API",version:"1.1"}));

app.post("/api/auth/register",(req,res)=>{
  const {name,username,password}=req.body||{};
  if(!name||!username||!password||password.length<6) return res.status(400).json({error:"أدخل الاسم واسم المستخدم وكلمة مرور من 6 أحرف على الأقل"});
  try{
    const hash=bcrypt.hashSync(password,12);
    const info=db.prepare("INSERT INTO users(name,username,password_hash) VALUES(?,?,?)").run(name,username.toLowerCase(),hash);
    const user={id:info.lastInsertRowid,name,username:username.toLowerCase()};
    res.status(201).json({user,token:tokenFor(user)});
  }catch{ res.status(409).json({error:"اسم المستخدم مستخدم مسبقًا"}); }
});

app.post("/api/auth/login",(req,res)=>{
  const {username,password}=req.body||{};
  const user=db.prepare("SELECT * FROM users WHERE username=?").get((username||"").toLowerCase());
  if(!user||!bcrypt.compareSync(password||"",user.password_hash)) return res.status(401).json({error:"بيانات الدخول غير صحيحة"});
  res.json({user:{id:user.id,name:user.name,username:user.username,bio:user.bio},token:tokenFor(user)});
});

app.get("/api/me",auth,(req,res)=>{
  const u=db.prepare("SELECT id,name,username,bio,created_at FROM users WHERE id=?").get(req.user.id);
  res.json(u);
});


app.post("/api/posts/:id/comments",auth,(req,res)=>{
  const text=(req.body?.text||"").trim();
  const post=db.prepare("SELECT id FROM posts WHERE id=?").get(req.params.id);
  if(!post) return res.status(404).json({error:"المنشور غير موجود"});
  if(!text) return res.status(400).json({error:"التعليق فارغ"});
  const info=db.prepare("INSERT INTO comments(post_id,user_id,text) VALUES(?,?,?)").run(post.id,req.user.id,text);
  res.status(201).json(db.prepare(`SELECT comments.*,users.name,users.username FROM comments JOIN users ON users.id=comments.user_id WHERE comments.id=?`).get(info.lastInsertRowid));
});

app.get("/api/posts/:id/comments",(req,res)=>{
  res.json(db.prepare(`SELECT comments.id,comments.text,comments.created_at,users.name,users.username
    FROM comments JOIN users ON users.id=comments.user_id
    WHERE comments.post_id=? ORDER BY comments.id ASC`).all(req.params.id));
});

app.post("/api/users/:id/follow",auth,(req,res)=>{
  const target=Number(req.params.id);
  if(target===req.user.id) return res.status(400).json({error:"لا يمكنك متابعة نفسك"});
  const exists=db.prepare("SELECT 1 FROM follows WHERE follower_id=? AND following_id=?").get(req.user.id,target);
  if(exists){
    db.prepare("DELETE FROM follows WHERE follower_id=? AND following_id=?").run(req.user.id,target);
    return res.json({following:false});
  }
  db.prepare("INSERT OR IGNORE INTO follows(follower_id,following_id) VALUES(?,?)").run(req.user.id,target);
  res.json({following:true});
});

app.post("/api/upload",auth,upload.single("file"),(req,res)=>{
  if(!req.file) return res.status(400).json({error:"لم يتم اختيار ملف"});
  const ext=path.extname(req.file.originalname).toLowerCase() || ".bin";
  const safe=Date.now()+"-"+Math.random().toString(36).slice(2)+ext;
  const finalPath=path.join(uploadsDir,safe);
  fs.renameSync(req.file.path,finalPath);
  res.status(201).json({url:"/uploads/"+safe,type:req.file.mimetype,size:req.file.size});
});


function getUserFromToken(token){
  try { return jwt.verify(token,JWT_SECRET); } catch { return null; }
}
function isMember(conversationId,userId){
  return !!db.prepare("SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?").get(conversationId,userId);
}

app.get("/api/users",auth,(req,res)=>{
  res.json(db.prepare("SELECT id,name,username,bio FROM users WHERE id<>? ORDER BY id DESC LIMIT 50").all(req.user.id));
});

app.get("/api/conversations",auth,(req,res)=>{
  const rows=db.prepare(`
    SELECT c.id,c.created_at,
      (SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_message
    FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id
    WHERE cm.user_id=? ORDER BY c.id DESC`).all(req.user.id);
  res.json(rows);
});

app.post("/api/conversations",auth,(req,res)=>{
  const other=Number(req.body?.user_id);
  if(!other || other===req.user.id) return res.status(400).json({error:"مستخدم غير صالح"});
  const existing=db.prepare(`
    SELECT c.id FROM conversations c
    JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=?
    JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=?
    WHERE (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2 LIMIT 1
  `).get(req.user.id,other);
  if(existing) return res.json(existing);
  const tx=db.transaction(()=>{
    const c=db.prepare("INSERT INTO conversations DEFAULT VALUES").run();
    db.prepare("INSERT INTO conversation_members(conversation_id,user_id) VALUES(?,?),(?,?)").run(c.lastInsertRowid,req.user.id,c.lastInsertRowid,other);
    return {id:c.lastInsertRowid};
  });
  res.status(201).json(tx());
});

app.get("/api/conversations/:id/messages",auth,(req,res)=>{
  const cid=Number(req.params.id);
  if(!isMember(cid,req.user.id)) return res.status(403).json({error:"لا تملك صلاحية هذه المحادثة"});
  res.json(db.prepare(`
    SELECT m.id,m.text,m.created_at,m.sender_id,u.name,u.username
    FROM messages m JOIN users u ON u.id=m.sender_id
    WHERE m.conversation_id=? ORDER BY m.id ASC LIMIT 200`).all(cid));
});

app.post("/api/conversations/:id/messages",auth,(req,res)=>{
  const cid=Number(req.params.id), text=(req.body?.text||"").trim();
  if(!isMember(cid,req.user.id)) return res.status(403).json({error:"لا تملك صلاحية هذه المحادثة"});
  if(!text) return res.status(400).json({error:"الرسالة فارغة"});
  const info=db.prepare("INSERT INTO messages(conversation_id,sender_id,text) VALUES(?,?,?)").run(cid,req.user.id,text);
  const msg=db.prepare(`SELECT m.id,m.text,m.created_at,m.sender_id,u.name,u.username FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`).get(info.lastInsertRowid);
  io.to("conversation:"+cid).emit("message:new",msg);
  res.status(201).json(msg);
});

io.use((socket,next)=>{
  const user=getUserFromToken(socket.handshake.auth?.token||"");
  if(!user) return next(new Error("unauthorized"));
  socket.user=user; next();
});
io.on("connection",socket=>{
  socket.on("conversation:join",cid=>{
    if(isMember(Number(cid),socket.user.id)) socket.join("conversation:"+Number(cid));
  });
  socket.on("conversation:leave",cid=>socket.leave("conversation:"+Number(cid)));
});

app.get("/api/posts",(req,res)=>{
  const rows=db.prepare(`
    SELECT posts.id,posts.text,posts.image_url,posts.likes,posts.created_at,
           users.id user_id,users.name,users.username
    FROM posts JOIN users ON users.id=posts.user_id
    ORDER BY posts.id DESC LIMIT 100`).all();
  res.json(rows);
});

app.post("/api/posts",auth,(req,res)=>{
  const {text,image_url=""}=req.body||{};
  if(!text?.trim()) return res.status(400).json({error:"المنشور فارغ"});
  const info=db.prepare("INSERT INTO posts(user_id,text,image_url) VALUES(?,?,?)").run(req.user.id,text.trim(),image_url);
  const row=db.prepare(`SELECT posts.*,users.name,users.username FROM posts JOIN users ON users.id=posts.user_id WHERE posts.id=?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.post("/api/posts/:id/like",auth,(req,res)=>{
  const p=db.prepare("SELECT id,likes FROM posts WHERE id=?").get(req.params.id);
  if(!p) return res.status(404).json({error:"المنشور غير موجود"});
  db.prepare("UPDATE posts SET likes=likes+1 WHERE id=?").run(p.id);
  res.json({likes:p.likes+1});
});

app.get("/api/users/search",auth,(req,res)=>{
  const q=(req.query.q||"").trim();
  if(!q) return res.json([]);
  res.json(db.prepare("SELECT id,name,username,bio FROM users WHERE name LIKE ? OR username LIKE ? LIMIT 20").all(`%${q}%`,`%${q}%`));
});

app.use("/uploads", express.static(uploadsDir));
app.use(express.static(path.join(__dirname,"../frontend")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"../frontend/index.html")));

httpServer.listen(PORT,()=>console.log(`VYRA API running on http://localhost:${PORT}`));
