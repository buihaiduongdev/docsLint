import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  stat,
} from "node:fs/promises";
import { resolve, extname } from "node:path";
import { unzipSync } from "fflate";
import httpProxy from "http-proxy";
import { sign, verify, officeDownloadUrl } from "./security.mjs";

const MAX_FILE = 10 * 1024 * 1024;
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const random = () => randomBytes(24).toString("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
async function bytes(stream, max) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > max) throw fail(413, "Tệp vượt giới hạn 10 MB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function validateDocx(buffer) {
  try {
    let expanded = 0;
    const files = unzipSync(buffer, {
      filter: (f) => {
        expanded += f.originalSize;
        if (expanded > 64 * 1024 * 1024) throw new Error("Too large");
        return f.name === "word/document.xml";
      },
    });
    if (!files["word/document.xml"]) throw new Error("Missing document");
  } catch {
    throw fail(400, "DOCX không hợp lệ hoặc quá lớn sau giải nén.");
  }
}

export async function createApp({
  secret,
  dataDir,
  officeUrl = "http://127.0.0.1:8082",
  internalUrl = "http://host.docker.internal:3001",
  staticDir = "dist",
  fetcher = fetch,
}) {
  if (!secret || secret.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const sessions = new Map();
  const pending = new Map();
  // Restore documents after app restarts. Capabilities are not exposed in directory listings.
  for (const name of await readdir(dataDir)) {
    if (!/^[a-f0-9]{48}$/.test(name)) continue;
    try {
      const item = JSON.parse(
        await readFile(resolve(dataDir, name, "meta.json"), "utf8"),
      );
      sessions.set(item.id, item);
    } catch {
      /* Incomplete upload. */
    }
  }
  const persist = async (item) => {
    const path = resolve(dataDir, item.id, "meta.json");
    await writeFile(path + ".tmp", JSON.stringify(item), { mode: 0o600 });
    await rename(path + ".tmp", path);
  };
  // Serialize snapshots and callbacks so a slow earlier write cannot overwrite a later one.
  const serial = async (id, action) => {
    const before = pending.get(id) ?? Promise.resolve();
    const next = before.catch(() => {}).then(action);
    pending.set(id, next);
    try {
      return await next;
    } finally {
      if (pending.get(id) === next) pending.delete(id);
    }
  };
  const store = async (item, body) => {
    validateDocx(body);
    const path = resolve(dataDir, item.id, "current.docx");
    await writeFile(path + ".tmp", body, { mode: 0o600 });
    await rename(path + ".tmp", path);
    item.revision++;
    item.savedAt = new Date().toISOString();
    await persist(item);
  };
  const download = async (value, item) => {
    const url = officeDownloadUrl(value, item.key, officeUrl);
    const response = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok || !response.body)
      throw fail(502, "Không tải được DOCX từ trình soạn thảo.");
    return bytes(response.body, MAX_FILE);
  };
  const configure = (item) => {
    const config = {
      documentType: "word",
      type: "desktop",
      width: "100%",
      height: "100%",
      document: {
        fileType: "docx",
        key: item.key,
        title: item.name,
        url: `${internalUrl}/api/documents/${item.id}/source?token=${item.readToken}`,
        permissions: { edit: true, download: true, print: true, review: true },
      },
      editorConfig: {
        mode: "edit",
        lang: "vi",
        callbackUrl: `${internalUrl}/api/documents/${item.id}/callback`,
        user: { id: item.id, name: "Tác giả" },
        customization: {
          autosave: true,
          forcesave: true,
          compactHeader: true,
          hideRightMenu: true,
          help: true,
          feedback: false,
        },
      },
    };
    return { ...config, token: sign(config, secret) };
  };
  const proxy = httpProxy.createProxyServer({
    target: officeUrl,
    ws: true,
    changeOrigin: true,
  });
  proxy.on("error", (_err, _req, res) => {
    if (res.writeHead && !res.headersSent)
      json(res, 503, {
        message: "ONLYOFFICE chưa sẵn sàng. Chạy npm run office:up.",
      });
    else res.destroy();
  });
  const prepareProxy = (req) => {
    req.headers["x-forwarded-host"] = `${req.headers.host}/office`;
    req.headers["x-forwarded-proto"] = req.socket.encrypted
      ? "https"
      : req.headers["x-forwarded-proto"] === "https"
        ? "https"
        : "http";
    req.url = req.url.slice("/office".length) || "/";
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://app");
      if (url.pathname.startsWith("/office/")) {
        prepareProxy(req);
        proxy.web(req, res);
        return;
      }
      if (url.pathname === "/api/health") {
        let officeReady = false;
        try {
          const result = await fetcher(`${officeUrl}/healthcheck`, {
            signal: AbortSignal.timeout(3000),
          });
          officeReady = result.ok && (await result.text()).trim() === "true";
        } catch {
          /* Report readiness without hiding the failure. */
        }
        return json(res, 200, { officeReady });
      }
      // API writes from a browser must originate from this host, including the Vite proxy.
      if (
        req.method !== "GET" &&
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      )
        throw fail(403, "Nguồn yêu cầu không hợp lệ.");
      if (url.pathname === "/api/documents" && req.method === "POST") {
        if (sessions.size >= 100)
          throw fail(
            507,
            "Kho tài liệu đã đầy. Xóa bớt tài liệu trên máy chủ.",
          );
        const name = decodeURIComponent(
          String(req.headers["x-document-name"] ?? "Document.docx"),
        );
        if (!name.toLowerCase().endsWith(".docx") || name.length > 240)
          throw fail(400, "Hãy chọn tệp .docx.");
        const body = await bytes(req, MAX_FILE);
        validateDocx(body);
        const item = {
          id: random(),
          access: random(),
          readToken: random(),
          key: random(),
          name,
          revision: 0,
          savedAt: new Date().toISOString(),
        };
        await mkdir(resolve(dataDir, item.id), { mode: 0o700 });
        await writeFile(resolve(dataDir, item.id, "current.docx"), body, {
          mode: 0o600,
        });
        await persist(item);
        sessions.set(item.id, item);
        return json(res, 201, {
          id: item.id,
          access: item.access,
          name,
          revision: item.revision,
          config: configure(item),
        });
      }
      const match = url.pathname.match(
        /^\/api\/documents\/([a-f0-9]{48})\/(reopen|source|snapshot|callback|download)$/,
      );
      if (match) {
        const [, id, action] = match;
        const item = sessions.get(id);
        if (!item) throw fail(404, "Tài liệu không còn trên máy chủ.");
        if (action === "callback" && req.method === "POST") {
          const body = JSON.parse((await bytes(req, 1024 * 1024)).toString());
          let payload;
          try {
            const verified = verify(
              body.token ?? req.headers.authorization?.replace(/^Bearer /, ""),
              secret,
            );
            payload = verified.payload ?? verified;
          } catch {
            throw fail(403, "Callback không hợp lệ.");
          }
          if (payload.key !== item.key) throw fail(403, "Sai phiên tài liệu.");
          if ([2, 6].includes(payload.status)) {
            await serial(id, async () => {
              const content = await download(payload.url, item);
              await store(item, content);
              if (payload.status === 2) {
                item.closed = true;
                await persist(item);
              }
            });
          }
          if ([3, 7].includes(payload.status)) {
            item.saveError = true;
            await persist(item);
          }
          return json(res, 200, { error: 0 });
        }
        if (
          action === "source" &&
          req.method === "GET" &&
          url.searchParams.get("token") === item.readToken
        ) {
          res.writeHead(200, {
            "Content-Type": DOCX,
            "Cache-Control": "no-store",
          });
          return res.end(await readFile(resolve(dataDir, id, "current.docx")));
        }
        if (req.headers.authorization !== `Bearer ${item.access}`)
          throw fail(403, "Không có quyền mở tài liệu.");
        if (action === "reopen" && req.method === "POST") {
          // Reopening starts from our saved DOCX, never from an older Office cache.
          await serial(id, async () => {
            item.key = random();
            item.closed = false;
            await persist(item);
          });
          return json(res, 200, {
            id,
            access: item.access,
            name: item.name,
            revision: item.revision,
            config: configure(item),
          });
        }
        if (action === "snapshot" && req.method === "POST") {
          const body = JSON.parse((await bytes(req, 16384)).toString());
          await serial(id, async () => {
            await store(item, await download(body.url, item));
            item.saveError = false;
            await persist(item);
          });
          return json(res, 200, {
            revision: item.revision,
            savedAt: item.savedAt,
          });
        }
        if (action === "download" && req.method === "GET") {
          res.writeHead(200, {
            "Content-Type": DOCX,
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(item.name)}`,
          });
          return res.end(await readFile(resolve(dataDir, id, "current.docx")));
        }
        throw fail(405, "Phương thức không được hỗ trợ.");
      }
      if (url.pathname.startsWith("/api/"))
        throw fail(404, "Không tìm thấy API.");
      if (req.method !== "GET")
        throw fail(405, "Phương thức không được hỗ trợ.");
      const root = resolve(staticDir);
      let path = resolve(root, "." + decodeURIComponent(url.pathname));
      if (path !== root && !path.startsWith(root + "/"))
        throw fail(403, "Đường dẫn không hợp lệ.");
      try {
        if (!(await stat(path)).isFile()) path = resolve(root, "index.html");
      } catch {
        path = resolve(root, "index.html");
      }
      const content = await readFile(path);
      const type =
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".svg": "image/svg+xml",
          ".woff2": "font/woff2",
          ".woff": "font/woff",
          ".docx": DOCX,
        }[extname(path)] ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": type,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(content);
    } catch (error) {
      if (!res.headersSent)
        json(res, error.status ?? 500, {
          message: error.status
            ? error.message
            : "Không hoàn tất được thao tác. Hãy thử lại.",
          error: 1,
        });
      else res.end();
      if (!error.status) console.error("Request failed:", error.message);
    }
  });
  server.on("upgrade", (req, socket, head) => {
    if (req.url.startsWith("/office/")) {
      prepareProxy(req);
      proxy.ws(req, socket, head);
    } else socket.destroy();
  });
  server.on("close", () => proxy.close());
  return server;
}
