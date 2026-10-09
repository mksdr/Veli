const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const sodium = require("libsodium-wrappers");
const { pullChunk } = require("../src/utils/secretstream");
const { decryptFile } = require("../src/utils/decryptFile");
const { installWorker } = require("../service-worker/worker");
const { registerWorker, hasWorkerProtocol } = require("../src/utils/workerSupport");
const { getStoredValue, setStoredValue } = require("../src/utils/storage");

const config = {
  encoder: new TextEncoder(), decoder: new TextDecoder(),
  sigCodes: { v1: "Encrypted Using Hat.sh", v2_symmetric: "zDKO6XYXioc", v2_asymmetric: "hTWKbfoikeg" },
};
before(async () => { await sodium.ready; });

function fixture(messages, tags) {
  const key = sodium.crypto_secretstream_xchacha20poly1305_keygen();
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  const chunks = messages.map((message, i) => sodium.crypto_secretstream_xchacha20poly1305_push(
    state, message, null, tags ? tags[i] : i === messages.length - 1 ? 3 : 0
  ));
  return { key, header, chunks, state: () => sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, key) };
}

test("authenticates complete files including empty files and exact chunk boundaries", async () => {
  for (const messages of [[new Uint8Array()], [new Uint8Array(1024)], [new Uint8Array(1024), new Uint8Array([7])]]) {
    const f = fixture(messages);
    const file = new Blob([f.header, ...f.chunks]);
    const result = await decryptFile(sodium, file, f.state(), f.header.length, 1024);
    assert.deepEqual(result, messages);
  }
});

test("rejects an authenticated prefix with its final chunk removed", async () => {
  const f = fixture([new Uint8Array(1024), new Uint8Array([8])]);
  assert.equal(sodium.crypto_secretstream_xchacha20poly1305_pull(f.state(), f.chunks[0]).tag, 0);
  assert.throws(() => pullChunk(sodium, f.state(), f.chunks[0], true));
  await assert.rejects(decryptFile(sodium, new Blob([f.header, f.chunks[0]]), f.state(), f.header.length, 1024));
});

test("preserves the existing 64 MiB chunk format across a real boundary", async () => {
  const first = new Uint8Array(64 * 1024 * 1024);
  first[0] = 7;
  first[first.length - 1] = 9;
  const f = fixture([first, new Uint8Array([11])]);
  const result = await decryptFile(sodium, new Blob([f.header, ...f.chunks]), f.state(), f.header.length);
  assert.equal(result.length, 2);
  assert.equal(result[0].length, first.length);
  assert.equal(result[0][0], 7);
  assert.equal(result[0][first.length - 1], 9);
  assert.deepEqual([...result[1]], [11]);
});

test("rejects early FINAL, trailing data, corrupted ciphertext and partial headers", async () => {
  const f = fixture([new Uint8Array(1024)], [3]);
  assert.throws(() => pullChunk(sodium, f.state(), f.chunks[0], false));
  await assert.rejects(decryptFile(sodium, new Blob([f.header, f.chunks[0], new Uint8Array([0])]), f.state(), f.header.length, 1024));
  const corrupted = f.chunks[0].slice();
  corrupted[10] ^= 1;
  await assert.rejects(decryptFile(sodium, new Blob([f.header, corrupted]), f.state(), f.header.length, 1024));
  await assert.rejects(decryptFile(sodium, new Blob([f.header]), f.state(), f.header.length));
});

function harness(timeout = 30000) {
  const handlers = {};
  const scope = {
    location: { origin: "https://test.invalid" },
    clients: { claim: async () => {} },
    addEventListener: (name, fn) => { handlers[name] = fn; },
  };
  installWorker(scope, sodium, config, timeout);
  const client = id => ({ id, messages: [], postMessage(message) { this.messages.push(message); } });
  const send = (client, data) => {
    let task;
    handlers.message({ source: client, data, waitUntil: promise => { task = promise; } });
    return task;
  };
  const fetch = (url, method = "GET") => {
    let response;
    handlers.fetch({ request: new Request(new URL(url, scope.location.origin), { method }), respondWith: value => { response = value; } });
    return response;
  };
  const prepare = async (client, kind = "Enc", name = "file.enc") => {
    await send(client, { cmd: "prepareFileName" + kind, fileName: name });
    return client.messages.at(-1);
  };
  return { client, send, fetch, prepare };
}

async function initialize(h, client, prepared, password = "test-password-123") {
  await h.send(client, { cmd: "requestEncryption", password, operationId: prepared.operationId });
  const response = h.fetch(prepared.downloadUrl);
  const body = response.arrayBuffer();
  return { response, body };
}

test("isolates concurrent tabs and ignores commands from a foreign client", async () => {
  const h = harness(), a = h.client("a"), b = h.client("b");
  const pa = await h.prepare(a, "Enc", "한글.txt.enc"), pb = await h.prepare(b, "Enc", "B.txt.enc");
  assert.notEqual(pa.operationId, pb.operationId);
  assert.equal(new URL(pa.downloadUrl, "https://test.invalid/headless/").pathname, "/file");
  const ra = await initialize(h, a, pa), rb = await initialize(h, b, pb, "other-password-123");
  await h.send(b, { cmd: "cancelOperation", operationId: pa.operationId });
  await Promise.all([
    h.send(a, { cmd: "encryptFirstChunk", operationId: pa.operationId, chunk: new Uint8Array([1, 2]), last: true }),
    h.send(b, { cmd: "encryptFirstChunk", operationId: pb.operationId, chunk: new Uint8Array([3, 4]), last: true }),
  ]);
  assert.match(ra.response.headers.get("Content-Disposition"), /filename\*=UTF-8/);
  assert.match(rb.response.headers.get("Content-Disposition"), /B.txt.enc/);
  for (const [r, password, plaintext] of [[ra, "test-password-123", [1, 2]], [rb, "other-password-123", [3, 4]]]) {
    const bytes = new Uint8Array(await r.body);
    const key = sodium.crypto_pwhash(32, password, bytes.slice(11, 27),
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE, sodium.crypto_pwhash_ALG_ARGON2ID13);
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(bytes.slice(27, 51), key);
    assert.deepEqual([...pullChunk(sodium, state, bytes.slice(51), true)], plaintext);
  }
  assert.equal(a.messages.at(-1).reply, "encryptionFinished");
  assert.equal(b.messages.at(-1).reply, "encryptionFinished");
  assert.equal(h.fetch(pa.downloadUrl).status, 404);
  assert.equal(h.fetch("/file").status, 404);
  assert.equal(h.fetch("/file-other"), undefined);
});

test("waits for the download instead of relying on a fixed startup delay", async () => {
  const h = harness(), client = h.client("a"), p = await h.prepare(client);
  await h.send(client, { cmd: "requestEncryption", password: "test-password-123", operationId: p.operationId });
  const pending = h.send(client, { cmd: "encryptFirstChunk", chunk: new Uint8Array([1]), last: true, operationId: p.operationId });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(client.messages.at(-1).reply, "keysGenerated");
  const body = h.fetch(p.downloadUrl).arrayBuffer();
  await pending;
  assert.equal((await body).byteLength, 69);
});

test("errors the download stream and UI on truncated ciphertext", async () => {
  const h = harness(), client = h.client("a"), p = await h.prepare(client, "Dec", "file.txt");
  const sender = sodium.crypto_kx_keypair(), receiver = sodium.crypto_kx_keypair();
  const key = sodium.crypto_kx_client_session_keys(sender.publicKey, sender.privateKey, receiver.publicKey).sharedTx;
  const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
  const prefix = sodium.crypto_secretstream_xchacha20poly1305_push(state, new Uint8Array([7]), null, 0);
  await h.send(client, { cmd: "requestDecKeyPair", mode: "derive",
    privateKey: sodium.to_base64(receiver.privateKey), publicKey: sodium.to_base64(sender.publicKey),
    header, operationId: p.operationId });
  const body = h.fetch(p.downloadUrl).arrayBuffer();
  const rejected = assert.rejects(body);
  await h.send(client, { cmd: "decryptFirstChunk", chunk: prefix, last: true, operationId: p.operationId });
  await rejected;
  assert.equal(client.messages.at(-1).reply, "operationError");
  assert.equal(client.messages.some(message => message.reply === "decryptionFinished"), false);
});

test("cancellation wakes a job waiting for its download", async () => {
  const h = harness(), client = h.client("a"), p = await h.prepare(client);
  await h.send(client, { cmd: "requestEncryption", password: "test-password-123", operationId: p.operationId });
  const pending = h.send(client, { cmd: "encryptFirstChunk", chunk: new Uint8Array([1]), last: true, operationId: p.operationId });
  await h.send(client, { cmd: "cancelOperation", operationId: p.operationId });
  await pending;
  assert.equal(client.messages.at(-1).reply, "operationError");
  assert.equal(h.fetch(p.downloadUrl).status, 404);
});

test("preferences survive blocked localStorage without throwing", () => {
  global.window = { get localStorage() { throw new Error("SecurityError"); } };
  try {
    assert.equal(getStoredValue("missing"), null);
    setStoredValue("language", "en_US");
    assert.equal(getStoredValue("language"), "en_US");
  } finally { delete global.window; }
});

test("worker registration waits for control and times out without leaking listeners", async () => {
  let onChange, removed = 0;
  const sw = {
    controller: null, register: async () => ({}),
    addEventListener: (name, fn) => { onChange = fn; },
    removeEventListener: (name, fn) => { if (fn === onChange) removed++; },
  };
  const pending = registerWorker({ serviceWorker: sw }, 100);
  await new Promise(resolve => setImmediate(resolve));
  sw.controller = {};
  onChange();
  assert.equal(await pending, true);
  assert.equal(removed, 1);
  sw.controller = null;
  assert.equal(await registerWorker({ serviceWorker: sw }, 5), false);
  assert.equal(removed, 2);
  assert.equal(await registerWorker({ serviceWorker: { register: async () => { throw new Error("denied"); } } }, 5), false);
});

test("falls back from an older worker that does not implement the protocol", async () => {
  assert.equal(await hasWorkerProtocol({ serviceWorker: { controller: { postMessage() {} } } }, 5), false);
  assert.equal(await hasWorkerProtocol({ serviceWorker: { controller: {
    postMessage(data, ports) { ports[0].postMessage({ version: 1 }); },
  } } }, 100), true);
});
