import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createApp } from "../server/app.mjs";
import { sign, verify, officeDownloadUrl } from "../server/security.mjs";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const secret = "test-only-secret-with-more-than-32-characters";
const source = await readFile("public/sample-report.docx");
const parts = unzipSync(source);
parts["word/document.xml"] = strToU8(
  strFromU8(parts["word/document.xml"]).replace(
    "4. Kết luận",
    "4. Đã sửa và lưu",
  ),
);
const edited = Buffer.from(zipSync(parts));

test("signed tokens reject altered, expired and incorrectly signed payloads", () => {
  const token = sign({ key: "one" }, secret);
  assert.deepEqual(verify(token, secret), { key: "one" });
  assert.throws(() => verify(token, secret + "wrong"));
  assert.throws(() => verify(sign({ exp: 1 }, secret), secret));
  assert.throws(() => verify("unsigned", secret));
});

test("export URLs are restricted to the current document cache on our Office server", () => {
  assert.equal(
    officeDownloadUrl(
      "http://browser/office/cache/files/abc_1/output.docx?md5=signature",
      "abc",
      "http://office",
    ),
    "http://office/cache/files/abc_1/output.docx?md5=signature",
  );
  assert.throws(() =>
    officeDownloadUrl(
      "http://169.254.169.254/latest/meta-data",
      "abc",
      "http://office",
    ),
  );
  assert.throws(() =>
    officeDownloadUrl(
      "http://office/cache/files/other/output.docx",
      "abc",
      "http://office",
    ),
  );
  assert.throws(() =>
    officeDownloadUrl(
      "file:///cache/files/abc/output.docx",
      "abc",
      "http://office",
    ),
  );
});

test("upload, authenticated snapshot, callback, download and reopen survive a server restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "docslint-server-"));
  const requested = [];
  const options = {
    secret,
    dataDir: dir,
    officeUrl: "http://office",
    internalUrl: "http://app",
    fetcher: async (url) => {
      requested.push(url);
      return new Response(edited);
    },
  };
  let server = await createApp(options);
  const start = async () => {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return `http://127.0.0.1:${server.address().port}`;
  };
  let base = await start();
  const close = async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
  try {
    const upload = await fetch(base + "/api/documents", {
      method: "POST",
      headers: { "X-Document-Name": encodeURIComponent("Báo cáo.docx") },
      body: source,
    });
    assert.equal(upload.status, 201);
    const session = await upload.json();
    const auth = { Authorization: `Bearer ${session.access}` };
    const config = verify(session.config.token, secret);
    assert.equal(config.editorConfig.mode, "edit");
    const key = config.document.key;
    const prefix = `/api/documents/${session.id}`;
    assert.equal((await fetch(base + prefix + "/download")).status, 403);
    const original = await fetch(
      base +
        new URL(config.document.url).pathname +
        new URL(config.document.url).search,
    );
    assert.deepEqual(Buffer.from(await original.arrayBuffer()), source);
    const badCallback = await fetch(base + prefix + "/callback", {
      method: "POST",
      body: JSON.stringify({
        status: 2,
        key,
        url: "http://office/cache/files/" + key + "/output.docx",
      }),
    });
    assert.equal(badCallback.status, 403);
    assert.equal(requested.length, 0);
    const snapshot = await fetch(base + prefix + "/snapshot", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        url: `http://browser/office/cache/files/${key}_1/output.docx`,
      }),
    });
    assert.equal(snapshot.status, 200);
    assert.equal((await snapshot.json()).revision, 1);
    assert.match(requested[0], /^http:\/\/office\/cache\/files\//);
    const downloaded = await fetch(base + prefix + "/download", {
      headers: auth,
    });
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), edited);
    // An authenticated callback uses only the signed fields, ignoring a tampered outer URL/key.
    const callback = await fetch(base + prefix + "/callback", {
      method: "POST",
      body: JSON.stringify({
        url: "http://attacker/",
        key: "wrong",
        token: sign(
          {
            key,
            status: 2,
            url: `http://office/cache/files/${key}_2/output.docx`,
          },
          secret,
        ),
      }),
    });
    assert.equal(callback.status, 200);
    assert.deepEqual(await callback.json(), { error: 0 });
    await close();
    server = await createApp(options);
    base = await start();
    const reopened = await fetch(base + prefix + "/reopen", {
      method: "POST",
      headers: auth,
    });
    const next = await reopened.json();
    assert.equal(next.revision, 2);
    assert.notEqual(next.config.document.key, key);
    const stale = await fetch(base + prefix + "/callback", {
      method: "POST",
      body: JSON.stringify({
        token: sign(
          {
            key,
            status: 2,
            url: `http://office/cache/files/${key}_2/output.docx`,
          },
          secret,
        ),
      }),
    });
    assert.equal(stale.status, 403);
    const persisted = await fetch(base + prefix + "/download", {
      headers: auth,
    });
    assert.deepEqual(Buffer.from(await persisted.arrayBuffer()), edited);
    const csrf = await fetch(base + "/api/documents", {
      method: "POST",
      headers: { Origin: "https://untrusted.example" },
      body: source,
    });
    assert.equal(csrf.status, 403);
    const invalid = await fetch(base + "/api/documents", {
      method: "POST",
      body: "not a DOCX",
    });
    assert.equal(invalid.status, 400);
  } finally {
    await close();
    await rm(dir, { recursive: true, force: true });
  }
});
