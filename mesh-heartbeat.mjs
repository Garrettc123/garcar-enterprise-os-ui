#!/usr/bin/env node
/**
 * Signed, opt-in health metadata for Garcar Enterprise Sync Core.
 * Does not send customers, commands, payment data, or execute any agent.
 */
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const NODE_ID = "garcar-enterprise-os-ui";
const ALLOWED_STATUS = new Set(["healthy", "degraded", "offline"]);

function safeOrigin(input) {
  const origin = new URL(input);
  if (origin.protocol !== "https:" || origin.username || origin.password ||
      origin.search || origin.hash || origin.pathname !== "/" ||
      (origin.port && origin.port !== "443")) {
    throw new Error("Sync Core requires a plain HTTPS origin");
  }
  const host = origin.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".local") ||
      host.endsWith(".internal") || !host) {
    throw new Error("Local destinations are disabled");
  }
  if (host.includes(":") || isIP(host)) {
    // IP literals are unsupported: require a named, operator-verified HTTPS service.
    throw new Error("IP literal destinations are disabled");
  }
  return "https://" + host + "/mesh/ingest";
}

export async function sendHeartbeat({
  env = process.env,
  fetchImpl = globalThis.fetch,
  status = "degraded",
  now = () => Math.floor(Date.now() / 1000),
} = {}) {
  if ((env.GARCAR_MESH_PUBLISH_ENABLED || "").toLowerCase() !== "true") {
    return { state: "disabled", node: NODE_ID };
  }
  if (!ALLOWED_STATUS.has(status)) throw new Error("Invalid reported status");
  const key = env.GARCAR_MESH_NODE_KEY || "";
  if (Buffer.byteLength(key, "utf8") < 32) throw new Error("Node signing key is missing");
  const endpoint = safeOrigin(env.GARCAR_SYNC_CORE_ORIGIN || "");
  let revision = String(env.GARCAR_RELEASE_SHA || "unverified").slice(0, 64);
  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(revision)) revision = "unverified";
  const event = {
    event_id: "mesh-hb-" + randomBytes(18).toString("base64url"),
    source: NODE_ID,
    type: "mesh.heartbeat.v1",
    payload: { status, revision },
  };
  const body = JSON.stringify(event);
  const timestamp = String(now());
  const signature = createHmac("sha256", key)
    .update(timestamp + "." + body).digest("hex");
  const response = await fetchImpl(endpoint, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(4000),
    headers: {
      "content-type": "application/json",
      "x-mesh-node": NODE_ID,
      "x-mesh-time": timestamp,
      "x-mesh-signature": signature,
    },
    body,
  });
  if (response.status !== 200) throw new Error("Mesh heartbeat not acknowledged");
  const receipt = await response.json();
  if (receipt.event_id !== event.event_id || receipt.signed_node !== NODE_ID ||
      receipt.action_authority !== "none" ||
      !["published", "duplicate"].includes(receipt.status)) {
    throw new Error("Unrecognized mesh acknowledgment");
  }
  return { state: "acknowledged", node: NODE_ID,
           event_id: event.event_id, sync_delivery_verified: false };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  sendHeartbeat().then(
    value => console.log(JSON.stringify(value)),
    error => { console.error("Mesh heartbeat failed: " + error.message); process.exitCode = 1; },
  );
}
