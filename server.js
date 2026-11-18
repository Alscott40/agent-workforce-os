import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
const app=express(),port=Number(process.env.PORT||3100),root=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:"1mb"}));
function cfg(){return {url:(process.env.PAPERCLIP_BASE_URL||"").replace(/\/+$/,""),company:process.env.PAPERCLIP_COMPANY_ID||"",token:process.env.PAPERCLIP_API_TOKEN||""}}
function required(){const c=cfg();if(!c.url||!c.company||!c.token)throw Object.assign(new Error("Paperclip is not configured. Set PAPERCLIP_BASE_URL, PAPERCLIP_COMPANY_ID and PAPERCLIP_API_TOKEN in the server environment."),{status:424});let u;try{u=new URL(c.url)}catch{throw Object.assign(new Error("Paperclip base URL is invalid."),{status:400})}if(!["http:","https:"].includes(u.protocol)||(u.protocol!=="https:"&&!["localhost","127.0.0.1"].includes(u.hostname)))throw Object.assign(new Error("Remote Paperclip connections must use HTTPS."),{status:400});return c}
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
async function pc(route,opts={}){const c=required(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(c.url+"/api"+route,{...opts,signal:controller.signal,headers:{Authorization:"Bearer "+c.token,"Content-Type":"application/json",...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(data.error||data.message||"Paperclip HTTP "+r.status),{status:r.status});return data}finally{clearTimeout(timer)}}

const OSIRIS_MCP_URL="https://osirisai.live/api/mcp";
async function osirisMcpPost(message,sessionId,protocolVersion){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const headers={"Content-Type":"application/json","Accept":"application/json, text/event-stream"};
    if(sessionId)headers["MCP-Session-Id"]=sessionId;if(protocolVersion)headers["MCP-Protocol-Version"]=protocolVersion;
    const response=await fetch(OSIRIS_MCP_URL,{method:"POST",headers,body:JSON.stringify(message),signal:controller.signal});
    const raw=await response.text();
    if(!response.ok)throw Object.assign(new Error("OSIRIS MCP HTTP "+response.status+(raw?": "+raw.slice(0,300):"")),{status:response.status});
    let payload=null;
    if(raw.trim()){
      if((response.headers.get("content-type")||"").includes("text/event-stream")){
        for(const event of raw.split(/\r?\n\r?\n/)){const data=event.split(/\r?\n/).filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trim()).join("\n");if(data){try{const parsed=JSON.parse(data);if(!message.id||parsed.id===message.id)payload=parsed}catch{}}}
      }else{try{payload=JSON.parse(raw)}catch{throw new Error("OSIRIS MCP returned an unreadable response.")}}
    }
    if(payload?.error)throw new Error(payload.error.message||"OSIRIS MCP returned a JSON-RPC error.");
    return {payload,sessionId:response.headers.get("mcp-session-id")||sessionId};
  }finally{clearTimeout(timer)}
}
async function checkOsirisMcp(){
  const init=await osirisMcpPost({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"CommandOS",version:"1.0.0"}}});
  if(!init.payload?.result?.protocolVersion)throw new Error("OSIRIS MCP did not complete the initialization handshake.");
  const protocolVersion=init.payload.result.protocolVersion;\n  const ready=await osirisMcpPost({jsonrpc:"2.0",method:"notifications/initialized"},init.sessionId,protocolVersion);
  const listed=await osirisMcpPost({jsonrpc:"2.0",id:2,method:"tools/list",params:{}},ready.sessionId||init.sessionId,protocolVersion);
  const tools=listed.payload?.result?.tools;
  if(!Array.isArray(tools))throw new Error("OSIRIS MCP connected but did not return a tools list.");
  return {ok:true,connected:true,server:OSIRIS_MCP_URL,transport:"Streamable HTTP",toolCount:tools.length,tools:tools.map(tool=>tool.name).filter(Boolean),checkedAt:new Date().toISOString()};
}
app.get("/api/osiris/test",asyncRoute(async(_q,s)=>s.json(await checkOsirisMcp())));

app.get("/api/health",(_q,s)=>s.json({ok:true}));
app.get("/api/config/status",(_q,s)=>{const c=cfg();s.json({paperclipConfigured:!!(c.url&&c.company&&c.token),baseUrl:c.url||null,companyConfigured:!!c.company,tokenConfigured:!!c.token,osirisMcpUrl:"https://osirisai.live/api/mcp"})});
app.get("/api/paperclip/test",asyncRoute(async(_q,s)=>{const c=required(),company=await pc("/companies/"+encodeURIComponent(c.company));s.json({ok:true,company:{id:company.id,name:company.name}})}));
app.get("/api/paperclip/agents",asyncRoute(async(_q,s)=>{const c=required();s.json(await pc("/companies/"+encodeURIComponent(c.company)+"/agents"))}));
app.get("/api/paperclip/issues",asyncRoute(async(_q,s)=>{const c=required();s.json(await pc("/companies/"+encodeURIComponent(c.company)+"/issues?limit=50"))}));
app.get("/api/paperclip/approvals",asyncRoute(async(_q,s)=>{const c=required();s.json(await pc("/companies/"+encodeURIComponent(c.company)+"/approvals"))}));
app.post("/api/paperclip/issues",asyncRoute(async(q,s)=>{const b=q.body||{},prompt=typeof b.prompt==="string"?b.prompt.trim():"";if(prompt.length<10||prompt.length>20000)return s.status(400).json({error:"Prompt must contain 10 to 20,000 characters."});if(!["recommend","prepare","approved"].includes(b.mode||"recommend"))return s.status(400).json({error:"Invalid execution permission."});const c=required(),title=prompt.split(/\n/).find(Boolean).slice(0,120)||"Business command",guard=b.mode==="prepare"?"Prepare actions for explicit human approval. Do not execute external side effects.":b.mode==="approved"?"Only steps receiving explicit per-action human approval may be executed through authorized systems.":"Recommend-only. Research and prepare recommendations; do not execute external side effects.",description="## Detailed business instruction\n\n"+prompt+"\n\nEXECUTION POLICY: "+guard+"\n\nINTELLIGENCE SOURCE: If this agent has OSIRIS MCP configured, use available passive/public intelligence tools. Cite source links and timestamps. If unavailable, state that OSIRIS is not connected; do not invent findings.\n\nCommandOS metadata: category="+String(b.category||"General")+"; mode="+(b.mode||"recommend")+"; submittedAt="+new Date().toISOString(),payload={title,description,status:"todo",priority:["low","medium","high","urgent"].includes(b.priority)?b.priority:"medium"};if(typeof b.assigneeAgentId==="string"&&b.assigneeAgentId)payload.assigneeAgentId=b.assigneeAgentId;const created=await pc("/companies/"+encodeURIComponent(c.company)+"/issues",{method:"POST",body:JSON.stringify(payload)});s.status(201).json(created)}));
app.use((err,_q,s,_n)=>{const status=Number(err.status)||(err.name==="AbortError"?504:502);s.status(status).json({error:status===502?"Could not reach Paperclip. Check the server URL and network.":err.message,status})});
if(process.env.NODE_ENV==="production"){app.use(express.static(path.resolve(root,"dist")));app.get("*",(_q,s)=>s.sendFile(path.resolve(root,"dist/index.html")))}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))app.listen(port,"0.0.0.0",()=>console.log("CommandOS API listening on "+port));\nexport {app};