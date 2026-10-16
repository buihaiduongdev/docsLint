import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { mainParagraphs, WORD_NS } from "./source-locations";

/** Adds zero-width navigation bookmarks to an in-memory copy, never the user's file. */
export function preparePreview(data: Uint8Array) {
  let expanded = 0;
  const files = unzipSync(data, {
    filter: (file) => {
      expanded += file.originalSize;
      if (expanded > 64 * 1024 * 1024)
        throw new Error("Bản xem vượt giới hạn 64 MB sau giải nén.");
      return true;
    },
  });
  const source = files["word/document.xml"];
  if (!source) throw new Error("Không tìm thấy nội dung tài liệu.");
  const xml = new DOMParser().parseFromString(
    strFromU8(source),
    "application/xml",
  );
  const body = xml.getElementsByTagNameNS(WORD_NS, "body")[0];
  if (!body || xml.getElementsByTagName("parsererror").length)
    throw new Error("XML tài liệu không hợp lệ.");
  const existing = Array.from(
    xml.getElementsByTagNameNS(WORD_NS, "bookmarkStart"),
  );
  const names = new Set(
    existing.map((el) => el.getAttributeNS(WORD_NS, "name")),
  );
  const ids = new Set(existing.map((el) => el.getAttributeNS(WORD_NS, "id")));
  let prefix = "_docsLintSource_";
  while ([...names].some((name) => name?.startsWith(prefix))) prefix += "x";
  let nextId = 1;
  const bookmarks = new Map<string, string>();
  mainParagraphs(body).forEach((p, index) => {
    while (ids.has(String(nextId))) nextId++;
    const id = String(nextId++);
    const name = `${prefix}${index}`;
    const start = xml.createElementNS(WORD_NS, "w:bookmarkStart");
    start.setAttributeNS(WORD_NS, "w:id", id);
    start.setAttributeNS(WORD_NS, "w:name", name);
    const end = xml.createElementNS(WORD_NS, "w:bookmarkEnd");
    end.setAttributeNS(WORD_NS, "w:id", id);
    const first =
      Array.from(p.children).find((el) => el.localName !== "pPr") ?? null;
    p.insertBefore(start, first);
    p.insertBefore(end, first);
    bookmarks.set(name, `p-${index}`);
  });
  files["word/document.xml"] = strToU8(
    new XMLSerializer().serializeToString(xml),
  );
  return { data: zipSync(files, { level: 0 }), bookmarks };
}

export function getPreviewParagraph(nodeId: string) {
  return (
    document
      .querySelector(".docx-render-host")
      ?.shadowRoot?.getElementById(`doc-${nodeId}`) ?? null
  );
}
