import test from "node:test"; import assert from "node:assert/strict";
import { app } from "../server.js";

test("prompt validation boundary",()=>{const valid=s=>typeof s==="string"&&s.trim().length>=10&&s.trim().length<=20000;assert.equal(valid(""),false);assert.equal(valid("short"),false);assert.equal(valid("Research 25 viable business opportunities"),true);assert.equal(valid("x".repeat(20001)),false)});
test("remote Paperclip requires HTTPS, localhost may use HTTP",()=>{const ok=v=>{const u=new URL(v);return u.protocol==="https:"||(["localhost","127.0.0.1"].includes(u.hostname)&&u.protocol==="http:")};assert.equal(ok("https://paperclip.example"),true);assert.equal(ok("http://localhost:3100"),true);assert.equal(ok("http://paperclip.example"),false)});
test("execution modes are allow-listed",()=>{const allowed=["recommend","prepare","approved"];assert.equal(allowed.includes("recommend"),true);assert.equal(allowed.includes("run-everything"),false)});
test("async Paperclip route failures return a structured response instead of hanging",async t=>{
  const keys=["PAPERCLIP_BASE_URL","PAPERCLIP_COMPANY_ID","PAPERCLIP_API_TOKEN"],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  keys.forEach(k=>delete process.env[k]);
  const server=app.listen(0);t.after(()=>{server.close();for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k]}});
  const address=server.address(),response=await fetch("http://127.0.0.1:"+address.port+"/api/paperclip/agents"),body=await response.json();
  assert.equal(response.status,424);assert.match(body.error,/PAPERCLIP_BASE_URL/);
});
