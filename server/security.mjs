import { createHmac, timingSafeEqual } from "node:crypto";

export function sign(payload, secret) {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${head}.${body}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}
export function verify(token, secret) {
  if (typeof token !== "string") throw new Error("Missing token");
  const [head, body, signature, extra] = token.split(".");
  if (!head || !body || !signature || extra) throw new Error("Invalid token");
  const header = JSON.parse(Buffer.from(head, "base64url").toString());
  if (header.alg !== "HS256") throw new Error("Invalid algorithm");
  const actual = Buffer.from(signature, "base64url");
  const expected = createHmac("sha256", secret)
    .update(`${head}.${body}`)
    .digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp && payload.exp * 1000 < Date.now())
    throw new Error("Expired token");
  return payload;
}

// Download only this session's generated DOCX from our configured Office server.
// Never fetch the caller's hostname, even if a URL points at a private service.
export function officeDownloadUrl(value, key, officeUrl) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid download protocol");
  const path = url.pathname.replace(/^\/office(?=\/)/, "");
  const decoded = decodeURIComponent(path);
  if (
    !decoded.startsWith("/cache/files/") ||
    !decoded
      .split("/")
      .some((part) => part === key || part.startsWith(`${key}_`)) ||
    decoded.includes("..")
  ) {
    throw new Error("Download does not belong to this document");
  }
  return new URL(path + url.search, officeUrl).href;
}
