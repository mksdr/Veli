import type Sodium from "libsodium-wrappers-sumo";
import type { StateAddress } from "libsodium-wrappers-sumo";
import { pullChunk } from "../src/utils/secretstream.ts";
import type { WorkerConfig } from "./config.ts";

export interface WorkerClient {
  id: string;
  postMessage(message: Record<string, unknown>): void;
}

export interface WorkerExtendableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

export interface WorkerFetchEvent {
  request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

export type WorkerCommand =
  | "getProtocolVersion"
  | "pingSW"
  | "prepareFileNameEnc"
  | "prepareFileNameDec"
  | "checkFile"
  | "requestTestDecryption"
  | "requestEncKeyPair"
  | "requestDecKeyPair"
  | "requestEncryption"
  | "requestDecryption"
  | "encryptFirstChunk"
  | "asymmetricEncryptFirstChunk"
  | "encryptRestOfChunks"
  | "decryptFirstChunk"
  | "decryptRestOfChunks"
  | "cancelOperation";

export interface WorkerMessageData {
  cmd: WorkerCommand;
  operationId?: string;
  requestId?: string;
  fileName?: unknown;
  mode?: "test" | "derive";
  password?: string;
  privateKey?: string;
  publicKey?: string;
  signature?: BufferSource;
  legacy?: BufferSource;
  salt?: ArrayBuffer | ArrayLike<number>;
  header?: ArrayBuffer | ArrayLike<number>;
  decFileBuff?: ArrayBuffer | ArrayLike<number>;
  chunk?: ArrayBuffer | Uint8Array;
  last?: boolean;
}

export interface WorkerMessageEvent extends WorkerExtendableEvent {
  source?: WorkerClient | null;
  data?: WorkerMessageData | null;
  ports?: readonly { postMessage(message: unknown): void }[];
}

export interface WorkerScope {
  location: { origin: string };
  clients: { claim(): Promise<unknown> };
  addEventListener(type: "activate", listener: (event: WorkerExtendableEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: WorkerFetchEvent) => void): void;
  addEventListener(type: "message", listener: (event: WorkerMessageEvent) => void): void;
}

interface WorkerJob {
  id: string;
  client: WorkerClient;
  kind: "encryption" | "decryption";
  fileName: string;
  started: boolean;
  failed?: boolean;
  controller?: ReadableStreamDefaultController<Uint8Array>;
  streamReady: Promise<void>;
  resolveStream: () => void;
  rejectStream: (reason?: unknown) => void;
  resume?: (() => void) | null;
  timer?: ReturnType<typeof setTimeout>;
  state?: StateAddress | null;
  salt?: Uint8Array | null;
  header?: Uint8Array | null;
  queue?: Promise<void>;
}

interface SessionKeys {
  sharedRx: Uint8Array;
  sharedTx: Uint8Array;
}

export function installWorker(
  scope: WorkerScope,
  sodium: typeof Sodium,
  config: WorkerConfig,
  streamTimeoutMs = 30000,
): void {
  const jobs = new Map<string, WorkerJob>();
  const reply = (client: WorkerClient, data: Record<string, unknown>, job?: WorkerJob) =>
    client.postMessage({
      ...data,
      ...(job ? { operationId: job.id, kind: job.kind } : {}),
    });
  const erase = (...buffers: Array<Uint8Array | null | undefined>) =>
    buffers.forEach(buffer => {
      if (buffer instanceof Uint8Array) sodium.memzero(buffer);
    });
  const release = (job: WorkerJob) => {
    clearTimeout(job.timer);
    jobs.delete(job.id);
    job.state = null;
    job.salt = null;
    job.header = null;
  };
  const fail = (job: WorkerJob) => {
    if (!jobs.has(job.id)) return;
    job.failed = true;
    if (job.controller) job.controller.error(new Error("File processing failed"));
    job.rejectStream(new Error("Download unavailable"));
    if (job.resume) job.resume();
    reply(job.client, { reply: "operationError" }, job);
    release(job);
  };

  // An update must not replace the worker during an active download.
  scope.addEventListener("activate", event => event.waitUntil(scope.clients.claim()));

  scope.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (url.origin !== scope.location.origin || url.pathname !== "/file") return;
    const jobId = url.searchParams.get("id");
    const job = jobId ? jobs.get(jobId) : undefined;
    if (event.request.method !== "GET" || !job || job.controller) {
      event.respondWith(new Response("Download unavailable", { status: 404 }));
      return;
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        job.controller = controller;
        clearTimeout(job.timer);
        job.resolveStream();
      },
      pull() {
        if (job.resume) {
          const resume = job.resume;
          job.resume = null;
          resume();
        }
      },
      cancel() { fail(job); },
    });
    const name = job.fileName.replace(/[\r\n"\\/]/g, "_");
    const asciiName = name.replace(/[^\x20-\x7e]/g, "_");
    event.respondWith(new Response(stream, { headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, "%27")}`,
      "Cache-Control": "no-store",
    } }));
  });

  async function write(job: WorkerJob, bytes: Uint8Array): Promise<void> {
    await job.streamReady;
    while (!job.failed && (job.controller?.desiredSize ?? 0) <= 0) {
      await new Promise<void>(resolve => { job.resume = resolve; });
    }
    if (job.failed || !job.controller) throw new Error("Download cancelled");
    job.controller.enqueue(bytes);
  }

  function derivePassword(password: string, salt: Uint8Array): Uint8Array {
    return sodium.crypto_pwhash(
      sodium.crypto_secretstream_xchacha20poly1305_KEYBYTES, password, salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );
  }

  function keyPair(privateKey: string, publicKey: string, encrypt: boolean): SessionKeys {
    let secret: Uint8Array | undefined;
    try {
      secret = sodium.from_base64(privateKey);
      const publicBytes = sodium.from_base64(publicKey);
      if (secret.length !== sodium.crypto_kx_SECRETKEYBYTES ||
          publicBytes.length !== sodium.crypto_kx_PUBLICKEYBYTES) throw new Error("Invalid keys");
      const ownPublic = sodium.crypto_scalarmult_base(secret);
      if (sodium.memcmp(ownPublic, publicBytes)) throw new Error("Same key pair");
      return encrypt
        ? sodium.crypto_kx_client_session_keys(ownPublic, secret, publicBytes)
        : sodium.crypto_kx_server_session_keys(ownPublic, secret, publicBytes);
    } finally { erase(secret); }
  }

  function prepare(client: WorkerClient, data: WorkerMessageData): void {
    const kind = data.cmd === "prepareFileNameEnc" ? "encryption" : "decryption";
    for (const job of jobs.values()) {
      if (job.client.id === client.id && job.kind === kind) fail(job);
    }
    const id = sodium.to_hex(sodium.randombytes_buf(24));
    let resolveStream!: () => void;
    let rejectStream!: (reason?: unknown) => void;
    const streamReady = new Promise<void>((resolve, reject) => {
      resolveStream = resolve;
      rejectStream = reject;
    });
    streamReady.catch(() => {});
    const job: WorkerJob = {
      id,
      client,
      kind,
      fileName: String(data.fileName),
      started: false,
      streamReady,
      resolveStream,
      rejectStream,
    };
    jobs.set(id, job);
    job.timer = setTimeout(() => fail(job), streamTimeoutMs);
    reply(client, {
      reply: kind === "encryption" ? "filePreparedEnc" : "filePreparedDec",
      downloadUrl: `/file?id=${id}`,
      requestId: data.requestId,
    }, job);
  }

  function validate(client: WorkerClient, data: WorkerMessageData): void {
    if (data.cmd === "checkFile") {
      const signature = config.decoder.decode(data.signature);
      reply(client, { reply: signature === config.sigCodes.v2_symmetric ? "secretKeyEncryption"
        : signature === config.sigCodes.v2_asymmetric ? "publicKeyEncryption"
        : config.decoder.decode(data.legacy) === config.sigCodes.v1 ? "oldVersion" : "badFile" });
      return;
    }
    let key: Uint8Array | undefined;
    let pair: SessionKeys | undefined;
    try {
      if (data.cmd === "requestEncKeyPair") {
        if (!data.privateKey || !data.publicKey) throw new Error("Missing keys");
        pair = keyPair(data.privateKey, data.publicKey, true);
        reply(client, { reply: "goodKeyPair" });
      } else {
        if (data.cmd === "requestTestDecryption") {
          if (config.decoder.decode(data.signature) !== config.sigCodes.v2_symmetric) throw new Error("Invalid signature");
          if (typeof data.password !== "string" || !data.salt) throw new Error("Missing credentials");
          key = derivePassword(data.password, new Uint8Array(data.salt));
        } else {
          if (!data.privateKey || !data.publicKey) throw new Error("Missing keys");
          pair = keyPair(data.privateKey, data.publicKey, false);
          key = pair.sharedRx;
        }
        if (!data.header || !data.decFileBuff) throw new Error("Missing encrypted payload");
        const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(new Uint8Array(data.header), key);
        const result = sodium.crypto_secretstream_xchacha20poly1305_pull(state, new Uint8Array(data.decFileBuff), null);
        reply(client, { reply: result ? "readyToDecrypt"
          : data.cmd === "requestTestDecryption" ? "wrongPassword" : "wrongDecKeys" });
        if (result) erase(result.message);
      }
    } catch {
      reply(client, { reply: data.cmd === "requestEncKeyPair" ? "wrongKeyInput"
        : data.cmd === "requestTestDecryption" ? "wrongPassword" : "wrongDecKeyInput" });
    } finally { erase(key, pair?.sharedRx, pair?.sharedTx); }
  }

  async function process(job: WorkerJob, data: WorkerMessageData): Promise<void> {
    const client = job.client;
    let key: Uint8Array | undefined;
    let pair: SessionKeys | undefined;
    try {
      if (data.cmd === "requestEncryption" || data.cmd === "requestEncKeyPair") {
        if (job.kind !== "encryption" || job.state) throw new Error("Invalid operation");
        if (data.cmd === "requestEncryption") {
          if (typeof data.password !== "string") throw new Error("Missing password");
          job.salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
          key = derivePassword(data.password, job.salt);
        } else {
          if (!data.privateKey || !data.publicKey) throw new Error("Missing keys");
          pair = keyPair(data.privateKey, data.publicKey, true);
          key = pair.sharedTx;
        }
        const result = sodium.crypto_secretstream_xchacha20poly1305_init_push(key);
        job.state = result.state;
        job.header = result.header;
        reply(client, { reply: pair ? "keyPairReady" : "keysGenerated" }, job);
        return;
      }
      if (data.cmd === "requestDecryption" || data.cmd === "requestDecKeyPair") {
        if (job.kind !== "decryption" || job.state) throw new Error("Invalid operation");
        if (data.cmd === "requestDecryption") {
          if (config.decoder.decode(data.signature) !== config.sigCodes.v2_symmetric) throw new Error("Invalid signature");
          if (typeof data.password !== "string" || !data.salt) throw new Error("Missing credentials");
          key = derivePassword(data.password, new Uint8Array(data.salt));
        } else {
          if (!data.privateKey || !data.publicKey) throw new Error("Missing keys");
          pair = keyPair(data.privateKey, data.publicKey, false);
          key = pair.sharedRx;
        }
        if (!data.header) throw new Error("Missing header");
        job.state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(new Uint8Array(data.header), key);
        reply(client, { reply: pair ? "decKeyPairGenerated" : "decKeysGenerated" }, job);
        return;
      }
      if (!job.state || typeof data.last !== "boolean" || !data.chunk) throw new Error("Invalid operation");
      const first = data.cmd.endsWith("FirstChunk");
      if (first === job.started) throw new Error("Invalid chunk order");
      job.started = true;
      if (job.kind === "encryption") {
        if (!["encryptFirstChunk", "asymmetricEncryptFirstChunk", "encryptRestOfChunks"].includes(data.cmd)) throw new Error("Invalid operation");
        if (first) {
          if (!job.header) throw new Error("Missing header");
          await write(job, config.encoder.encode(job.salt ? config.sigCodes.v2_symmetric : config.sigCodes.v2_asymmetric));
          if (job.salt) await write(job, job.salt);
          await write(job, job.header);
        }
        const tag = data.last ? sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL : sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE;
        await write(job, sodium.crypto_secretstream_xchacha20poly1305_push(job.state, new Uint8Array(data.chunk), null, tag));
      } else {
        if (!["decryptFirstChunk", "decryptRestOfChunks"].includes(data.cmd)) throw new Error("Invalid operation");
        await write(job, pullChunk(sodium, job.state, data.chunk, data.last));
      }
      if (data.last) {
        if (!job.controller) throw new Error("Download cancelled");
        job.controller.close();
        reply(client, { reply: `${job.kind}Finished` }, job);
        release(job);
      } else {
        reply(client, { reply: job.kind === "encryption" ? "continueEncryption" : "continueDecryption" }, job);
      }
    } finally { erase(key, pair?.sharedRx, pair?.sharedTx); }
  }

  scope.addEventListener("message", event => {
    const task = (async () => {
      await sodium.ready;
      const client = event.source;
      const data = event.data;
      if (!client?.id || !data || typeof data.cmd !== "string") return;
      if (data.cmd === "getProtocolVersion") {
        event.ports?.[0]?.postMessage({ version: 1 });
        return;
      }
      if (data.cmd === "pingSW") return;
      if (["prepareFileNameEnc", "prepareFileNameDec"].includes(data.cmd)) {
        prepare(client, data);
        return;
      }
      if (data.cmd === "checkFile" || data.cmd === "requestTestDecryption" ||
          (["requestEncKeyPair", "requestDecKeyPair"].includes(data.cmd) && data.mode === "test")) {
        validate(client, data);
        return;
      }
      const job = data.operationId ? jobs.get(data.operationId) : undefined;
      if (!job || job.client.id !== client.id) return;
      if (data.cmd === "cancelOperation") { fail(job); return; }
      job.queue = (job.queue || Promise.resolve())
        .then(() => { if (!job.failed) return process(job, data); })
        .catch(() => fail(job));
      await job.queue;
    })().catch(() => {
      if (event.source?.id) reply(event.source, { reply: "operationError" });
    });
    event.waitUntil(task);
  });
}
