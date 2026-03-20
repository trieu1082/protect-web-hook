const express=require("express")
const axios=require("axios")
const crypto=require("crypto")

const app=express()
app.use(express.json())
app.use(express.urlencoded({extended:1}))
app.use(express.static("public"))

const DB={}
const RATE={}
const ADMIN_KEY=process.env.ADMIN_KEY
const SECRET=process.env.SECRET

const enc=(t)=>crypto.createCipheriv("aes-256-ctr",SECRET.padEnd(32),Buffer.alloc(16,0)).update(t,"utf8","hex")
const dec=(t)=>crypto.createDecipheriv("aes-256-ctr",SECRET.padEnd(32),Buffer.alloc(16,0)).update(t,"hex","utf8")

const badWords=["mày","cặc","địt"]

const clean=(s)=>{
    if(!s) return ""
    s=s.replace(/@everyone|@here/gi,"[blocked]")
    badWords.forEach(w=>{s=s.replace(new RegExp(w,"gi"),"*")})
    return s.slice(0,500)
}

app.post("/api/create",(req,res)=>{
    const {webhook}=req.body
    if(!webhook||!webhook.includes("discord.com/api/webhooks")) return res.json({err:1})

    const id=crypto.randomBytes(6).toString("hex")
    DB[id]={w:enc(webhook),logs:[]}

    res.json({url:`${req.protocol}://${req.get("host")}/wh/${id}`})
})

app.post("/wh/:id",async(req,res)=>{
    const id=req.params.id
    const data=DB[id]
    if(!data) return res.sendStatus(404)

    const ip=req.ip
    const now=Date.now()

    if(RATE[ip] && now-RATE[ip]<3000) return res.json({err:"slow"})
    RATE[ip]=now

    let msg=clean(req.body.msg)

    if(!msg) return res.json({err:"empty"})
    if(data.last===msg) return res.json({ok:1})
    data.last=msg

    try{
        await axios.post(dec(data.w),{content:msg})
        data.logs.push({msg,ip,time:now})
        res.json({ok:1})
    }catch{
        res.json({err:"fail"})
    }
})

app.get("/admin",(req,res)=>{
    if(req.query.key!==ADMIN_KEY) return res.send("no")

    let out="<h2>WEBHOOK LIST</h2>"
    for(let id in DB){
        out+=`<div><b>${id}</b> | logs:${DB[id].logs.length}</div>`
    }
    res.send(out)
})

app.listen(process.env.PORT||3000)
