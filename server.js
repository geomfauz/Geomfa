import "dotenv/config";
import express from "express";
import helmet from "helmet";
import {rateLimit} from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const app=express();
app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:","blob:"],connectSrc:["'self'"],workerSrc:["'self'","blob:"],objectSrc:["'none'"]}}}));
app.use(express.json({limit:"64kb"}));
app.get("/api/health",(req,res)=>res.json({ok:true,aiConfigured:Boolean(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL)}));
app.use("/api/ai",rateLimit({windowMs:60000,limit:10,standardHeaders:"draft-8",legacyHeaders:false,message:{error:"So‘rovlar ko‘paydi. Bir daqiqadan keyin urinib ko‘ring."}}));
app.post("/api/ai",async(req,res)=>{
 const {messages}=req.body??{};
 if(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)return res.status(503).json({error:"Erkin AI suhbat uchun serverda OPENAI_API_KEY va OPENAI_MODEL ni sozlang. Loyiha hisoblari uchun mahalliy yordamchi ishlashda davom etadi."});
 const valid=Array.isArray(messages)&&messages.length>0&&messages.length<=12&&messages.every(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string"&&m.content.trim().length>0&&m.content.length<=4000);
 if(!valid)return res.status(400).json({error:"Xabar formati noto‘g‘ri."});
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
 try{
  const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL,store:false,max_output_tokens:1400,instructions:["Siz GEOMFA qurilish yordamchisisiz.","O‘zbek tilida tushunarli javob bering.","Qurilish, smeta, materiallar va uy boshqaruvi haqida yordam bering.","Sizda jonli bozor narxlari yoki bank API si yo‘q.","Manbasiz aniq narx va kredit shartini uydirmang.","Hisob uchun yetishmayotgan o‘lchamlarni so‘rang.","Konstruktiv va zilzila xavfsizligi qarorini malakali muhandisga qoldiring.","Sizda to‘lov, buyurtma yuborish yoki hujjat imzolash vositasi yo‘q.","Bajarilmagan amalni bajarildi demang."].join(" "),input:messages})});
  if(!upstream.ok){console.error("AI upstream:",upstream.status);return res.status(502).json({error:"AI xizmatidan javob olinmadi. Model, API kaliti va hisob limitini tekshiring."});}
  const result=await upstream.json();
  const answer=(result.output??[]).filter(x=>x.type==="message").flatMap(x=>x.content??[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");
  if(!answer)return res.status(502).json({error:"Matnli javob qaytmadi. Savolni qayta yozing."});
  return res.json({answer});
 }catch(error){return res.status(error.name==="AbortError"?504:502).json({error:error.name==="AbortError"?"Javob kutish vaqti tugadi.":"AI xizmati bilan aloqa uzildi."});}
 finally{clearTimeout(timeout);}
});
app.use("/api",(req,res)=>res.status(404).json({error:"API topilmadi."}));
const directory=path.dirname(fileURLToPath(import.meta.url)),dist=path.join(directory,"dist");
if(fs.existsSync(dist)){app.use(express.static(dist));app.get("/{*splat}",(req,res)=>res.sendFile(path.join(dist,"index.html")));}
app.use((error,req,res,next)=>res.status(error.status===413?413:400).json({error:"So‘rov mazmuni yoki hajmini tekshiring."}));
const port=Number(process.env.PORT)||3001;
app.listen(port,()=>console.log(`GEOMFA server: http://localhost:${port}`));
