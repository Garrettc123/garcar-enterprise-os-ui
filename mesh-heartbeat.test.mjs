import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sendHeartbeat } from "./mesh-heartbeat.mjs";

const allowed = {
  GARCAR_MESH_PUBLISH_ENABLED: "true",
  GARCAR_MESH_NODE_KEY: "test-only-not-a-real-credential-000000000001",
  GARCAR_SYNC_CORE_ORIGIN: "https://sync.example.com",
  GARCAR_RELEASE_SHA: "git-head-001",
};

test("disabled heartbeat does not access the network", async () => {
  const result = await sendHeartbeat({ env: {},
    fetchImpl: () => { throw Error("unexpected request"); } });
  assert.deepEqual(result, { state:"disabled", node:"garcar-enterprise-os-ui" });
});

test("signed request matches Sync Core expected HMAC and strict metadata", async () => {
  let calls = 0;
  const fetchImpl = async (url, init) => {
    calls += 1;
    assert.equal(url, "https://sync.example.com/mesh/ingest");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "manual");
    const payload = JSON.parse(init.body);
    assert.deepEqual(Object.keys(payload).sort(), ["event_id","payload","source","type"]);
    assert.equal(payload.source, "garcar-enterprise-os-ui");
    assert.equal(payload.type, "mesh.heartbeat.v1");
    assert.deepEqual(payload.payload, {status:"degraded",revision:"git-head-001"});
    const signature = createHmac("sha256", allowed.GARCAR_MESH_NODE_KEY)
       .update(init.headers["x-mesh-time"]+"."+init.body).digest("hex");
    assert.equal(init.headers["x-mesh-signature"], signature);
    assert.equal(init.headers["x-mesh-node"], "garcar-enterprise-os-ui");
    assert.match(payload.event_id, /^mesh-hb-[A-Za-z0-9_-]{12,80}$/);
    return {status:200,json:async()=>({
      status:"published", event_id:payload.event_id,
      signed_node:"garcar-enterprise-os-ui",action_authority:"none",
    })};
  };
  const result=await sendHeartbeat({env:allowed,fetchImpl,now:()=>1794430000});
  assert.equal(result.state,"acknowledged");
  assert.equal(result.sync_delivery_verified,false);
  assert.equal(calls,1);
});

test("rejects insecure, local, credentialed and path destinations", async () => {
  for(const url of ["http://sync.example.com","https://127.0.0.1",
       "https://[::1]","https://localhost","https://user:pass@sync.example.com",
       "https://sync.example.com/redirect","https://sync.example.com/?a=1"]) {
    await assert.rejects(sendHeartbeat({env:{...allowed,GARCAR_SYNC_CORE_ORIGIN:url},
      fetchImpl:()=>{throw Error("network should not be used")}}));
  }
});

test("requires an actual signing key and rejects incorrect response", async () => {
  await assert.rejects(sendHeartbeat({env:{...allowed,GARCAR_MESH_NODE_KEY:"short"}}));
  await assert.rejects(sendHeartbeat({env:allowed,fetchImpl:async(_,req)=>({
      status:200,json:async()=>({
        status:"published",event_id:JSON.parse(req.body).event_id,
        signed_node:"garcar-enterprise-os-ui", action_authority:"trade",
      })
  })}),/Unrecognized mesh acknowledgment/);
});

test("redirects cannot authorize a successful send", async () => {
  await assert.rejects(sendHeartbeat({env:allowed,fetchImpl:async()=>({
     status:302,headers:{location:"https://attacker.example"},
  })}),/not acknowledged/);
});
