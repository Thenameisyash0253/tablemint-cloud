import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbFile = path.join(dataDir, "tablemint.sqlite");
const legacyFile = path.join(dataDir, "hotel-data.json");
app.use(express.json({ limit: "2mb" }));
fs.mkdirSync(dataDir, { recursive: true });

const MENU = [
  {id:"m1",name:"Masala Dosa",category:"South Indian",price:100},
  {id:"m2",name:"Idli Sambar",category:"South Indian",price:70},
  {id:"m3",name:"Paneer Tikka",category:"Starters",price:220},
  {id:"m4",name:"Veg Manchurian",category:"Starters",price:180},
  {id:"m5",name:"Veg Thali",category:"Main Course",price:180},
  {id:"m6",name:"Paneer Butter Masala",category:"Main Course",price:240},
  {id:"m7",name:"Jeera Rice",category:"Main Course",price:130},
  {id:"m8",name:"Cold Coffee",category:"Beverages",price:120},
  {id:"m9",name:"Masala Chai",category:"Beverages",price:20},
  {id:"m10",name:"Gulab Jamun",category:"Desserts",price:60}
];
function emptyData() {
  return { tables: Array.from({length:16},(_,i)=>({id:i+1,guests:[],openedAt:null})), parcelOrders:[], nextParcel:1 };
}
let SQL, db, data;
function saveDb() {
  const json = JSON.stringify(data);
  db.run("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at", [json, new Date().toISOString()]);
  const bytes = db.export();
  fs.writeFileSync(dbFile, Buffer.from(bytes));
}
function saveBackupJson() { fs.writeFileSync(legacyFile, JSON.stringify(data, null, 2)); }
function validateData(body) {
  return body && Array.isArray(body.tables) && body.tables.length === 16 && Array.isArray(body.parcelOrders);
}
async function start() {
  SQL = await initSqlJs();
  if (fs.existsSync(dbFile)) db = new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)));
  else db = new SQL.Database();
  db.run("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id=1), payload TEXT NOT NULL, updated_at TEXT NOT NULL)");
  const existing = db.exec("SELECT payload FROM app_state WHERE id=1");
  if (existing.length && existing[0].values.length) {
    try { data = JSON.parse(existing[0].values[0][0]); } catch { data = emptyData(); }
  } else {
    try {
      const legacy = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
      data = validateData(legacy) ? legacy : emptyData();
    } catch { data = emptyData(); }
    saveDb();
  }
  app.get("/api/health", (_req,res) => res.json({ok:true,service:"TableMint API",storage:"SQLite",databaseFile:"server/data/tablemint.sqlite",time:new Date().toISOString()}));
  app.get("/api/menu", (_req,res) => res.json(MENU));
  app.get("/api/data", (_req,res) => res.json(data));
  app.put("/api/data", (req,res) => {
    if (!validateData(req.body)) return res.status(400).json({error:"Invalid hotel data. Expected 16 tables and parcelOrders array."});
    try { data = req.body; saveDb(); saveBackupJson(); return res.json({ok:true,savedAt:new Date().toISOString(),storage:"SQLite"}); }
    catch (e) { return res.status(500).json({error:"Could not save data",details:e.message}); }
  });
  app.get("/api/backup", (_req,res) => {
    res.setHeader("Content-Type","application/json");
    res.setHeader("Content-Disposition",`attachment; filename="tablemint-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.send(JSON.stringify({exportedAt:new Date().toISOString(),data},null,2));
  });
  app.post("/api/qr-orders", (req,res) => {
    const {table,customerName,items} = req.body || {};
    if (!Number.isInteger(table) || table<1 || table>16) return res.status(400).json({error:"Invalid table number."});
    if (typeof customerName!=="string" || !customerName.trim() || customerName.length>60) return res.status(400).json({error:"Enter a valid customer name."});
    if (!Array.isArray(items) || items.length<1 || items.length>30) return res.status(400).json({error:"Add at least one menu item."});
    const target = data.tables.find(t=>t.id===table);
    if (!target) return res.status(404).json({error:"Table not found."});
    if (target.guests.filter(g=>!g.paid).length>=6) return res.status(409).json({error:"This table already has 6 unpaid customer tabs. Please ask staff for help."});
    const normalized=[];
    for (const requested of items) {
      const menuItem=MENU.find(m=>m.id===requested.id); const qty=Number(requested.qty);
      if (!menuItem || !Number.isInteger(qty) || qty<1 || qty>99) return res.status(400).json({error:"One or more order items are invalid."});
      normalized.push({...menuItem,qty});
    }
    const guest={id:`qr-${Date.now()}-${Math.random().toString(16).slice(2,7)}`,name:customerName.trim(),items:normalized,status:"Open",createdAt:new Date().toISOString(),paid:false,paymentMethod:null,source:"QR mobile order"};
    target.guests.push(guest); target.openedAt=target.openedAt||new Date().toISOString();
    try { saveDb(); saveBackupJson(); return res.status(201).json({ok:true,table,customerName:guest.name,orderId:guest.id,guestNo:target.guests.length,message:"Order saved to SQLite database."}); }
    catch { return res.status(500).json({error:"Could not save order. Please contact staff."}); }
  });
  app.listen(PORT,"0.0.0.0",()=>console.log(`TableMint API running at http://localhost:${PORT} (SQLite storage)`));
}
start().catch(err=>{console.error("Could not start TableMint database:",err);process.exit(1);});
