import { strFromU8, unzipSync } from "fflate";
import type {
  DocumentModel,
  Paragraph,
  ParagraphStyle,
  TextStyle,
} from "../core/types";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const MAX_FILE = 10 * 1024 * 1024;
const MAX_XML = 24 * 1024 * 1024;
const child = (node: Element | undefined | null, name: string) =>
  Array.from(node?.children ?? []).find(
    (el) => el.namespaceURI === W && el.localName === name,
  );
const attr = (node: Element | undefined | null, name = "val") =>
  node?.getAttributeNS(W, name) ?? undefined;
const num = (value?: string | null) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value))
    ? Number(value)
    : undefined;

function xml(bytes: Uint8Array | undefined): XMLDocument | undefined {
  if (!bytes) return;
  const source = strFromU8(bytes);
  if (/<!DOCTYPE/i.test(source))
    throw new Error("DOCX chứa XML không được hỗ trợ (DOCTYPE).");
  const doc = new DOMParser().parseFromString(source, "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    throw new Error("Nội dung XML trong DOCX bị lỗi.");
  return doc;
}

/** Resolve OOXML styles before rules run. Unknown values remain undefined. */
export function parseDocx(data: Uint8Array, name: string): DocumentModel {
  if (data.byteLength > MAX_FILE)
    throw new Error("Tệp quá lớn. Prototype hỗ trợ DOCX tối đa 10 MB.");
  const wanted = new Set([
    "word/document.xml",
    "word/styles.xml",
    "word/numbering.xml",
    "word/theme/theme1.xml",
  ]);
  let expanded = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (file) => {
        if (!wanted.has(file.name)) return false;
        expanded += file.originalSize;
        if (expanded > MAX_XML) throw new Error("oversized");
        return true;
      },
    });
  } catch {
    throw new Error(
      "Không đọc được DOCX. Tệp có thể bị hỏng, được mã hóa hoặc vượt giới hạn giải nén.",
    );
  }
  const document = xml(files["word/document.xml"]);
  if (!document)
    throw new Error(
      "Không tìm thấy nội dung Word. Hãy chọn tệp .docx hợp lệ, không phải .doc hoặc PDF.",
    );
  const body = document.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("DOCX không có phần nội dung chính.");
  const stylesXml = xml(files["word/styles.xml"]);
  const numberingXml = xml(files["word/numbering.xml"]);
  const theme = xml(files["word/theme/theme1.xml"]);
  const themeFont = (key: string) => {
    const group = theme?.getElementsByTagNameNS(
      A,
      key.startsWith("major") ? "majorFont" : "minorFont",
    )[0];
    return (
      group?.getElementsByTagNameNS(A, "latin")[0]?.getAttribute("typeface") ||
      undefined
    );
  };
  const textStyle = (rPr?: Element): TextStyle => {
    const style: TextStyle = {};
    if (!rPr) return style;
    const fonts = child(rPr, "rFonts");
    const fontKey = attr(fonts, "asciiTheme") ?? attr(fonts, "hAnsiTheme");
    const font = fontKey
      ? themeFont(fontKey)
      : (attr(fonts, "ascii") ?? attr(fonts, "hAnsi"));
    if (font) style.fontFamily = font;
    const size = num(attr(child(rPr, "sz")));
    if (size !== undefined) style.fontSize = size / 2;
    for (const [tag, key] of [
      ["b", "bold"],
      ["i", "italic"],
    ] as const) {
      const el = child(rPr, tag);
      if (el) style[key] = !["false", "0", "off"].includes(attr(el) ?? "true");
    }
    return style;
  };
  const paragraphStyle = (pPr?: Element): ParagraphStyle => {
    const style: ParagraphStyle = {};
    if (!pPr) return style;
    const align = attr(child(pPr, "jc"));
    if (align) style.alignment = align === "both" ? "justify" : align;
    const spacing = child(pPr, "spacing");
    const line = num(attr(spacing, "line"));
    if (line !== undefined) style.lineSpacing = line;
    const mode = attr(spacing, "lineRule");
    if (mode) style.lineMode = mode;
    const outline = num(attr(child(pPr, "outlineLvl")));
    if (outline !== undefined) style.outlineLevel = outline;
    const indent = num(
      attr(child(pPr, "ind"), "left") ?? attr(child(pPr, "ind"), "start"),
    );
    if (indent !== undefined) style.indent = indent / 20;
    const list = child(pPr, "numPr");
    const listId = attr(child(list, "numId"));
    if (listId !== undefined) style.listId = listId;
    const level = num(attr(child(list, "ilvl")));
    if (level !== undefined) style.listLevel = level;
    return style;
  };
  const allStyles = new Map(
    Array.from(stylesXml?.getElementsByTagNameNS(W, "style") ?? []).map(
      (el) => [attr(el, "styleId"), el],
    ),
  );
  const defaults = stylesXml?.getElementsByTagNameNS(W, "docDefaults")[0];
  const defaultStyle: ParagraphStyle = {
    ...textStyle(child(child(defaults, "rPrDefault"), "rPr")),
    ...paragraphStyle(child(child(defaults, "pPrDefault"), "pPr")),
  };
  const cache = new Map<string, ParagraphStyle>();
  const resolveStyle = (
    id?: string,
    seen = new Set<string>(),
  ): ParagraphStyle => {
    if (!id || seen.has(id)) return {};
    if (cache.has(id)) return cache.get(id)!;
    const el = allStyles.get(id);
    if (!el) return {};
    seen.add(id);
    const resolved = {
      ...resolveStyle(attr(child(el, "basedOn")), seen),
      ...textStyle(child(el, "rPr")),
      ...paragraphStyle(child(el, "pPr")),
    };
    cache.set(id, resolved);
    return resolved;
  };
  const defaultParagraphId = [...allStyles].find(
    ([, el]) =>
      attr(el, "type") === "paragraph" &&
      ["1", "true", "on"].includes(attr(el, "default") ?? ""),
  )?.[0];
  const numbering = new Map(
    Array.from(numberingXml?.getElementsByTagNameNS(W, "num") ?? []).map(
      (el) => [attr(el, "numId"), el],
    ),
  );
  const abstracts = new Map(
    Array.from(
      numberingXml?.getElementsByTagNameNS(W, "abstractNum") ?? [],
    ).map((el) => [attr(el, "abstractNumId"), el]),
  );
  const listStyle = (id?: string, level = 0): ParagraphStyle => {
    const n = numbering.get(id);
    const abstract = abstracts.get(attr(child(n, "abstractNumId")));
    const override = Array.from(n?.children ?? []).find(
      (el) => el.localName === "lvlOverride" && num(attr(el, "ilvl")) === level,
    );
    const lvl =
      child(override, "lvl") ??
      Array.from(abstract?.children ?? []).find(
        (el) => el.localName === "lvl" && num(attr(el, "ilvl")) === level,
      );
    return paragraphStyle(child(lvl, "pPr"));
  };
  const hidden = (el: Element) => {
    let parent: Element | null = el;
    while (parent && parent !== body) {
      if (
        parent.namespaceURI === W &&
        ["del", "moveFrom", "txbxContent"].includes(parent.localName)
      )
        return true;
      parent = parent.parentElement;
    }
    return false;
  };
  const elements = Array.from(body.getElementsByTagNameNS(W, "p")).filter(
    (el) => !hidden(el),
  );
  if (elements.length > 5000)
    throw new Error("Tài liệu vượt giới hạn 5.000 đoạn của prototype.");
  const paragraphs: Paragraph[] = elements.map((p, index) => {
    const pPr = child(p, "pPr");
    const styleId = attr(child(pPr, "pStyle")) ?? defaultParagraphId;
    const named = resolveStyle(styleId);
    const direct = paragraphStyle(pPr);
    const base = { ...defaultStyle, ...named, ...direct };
    const isList = base.listId !== undefined && base.listId !== "0";
    const style = {
      ...defaultStyle,
      ...(isList ? listStyle(base.listId, base.listLevel) : {}),
      ...named,
      ...direct,
    };
    // OOXML's default paragraph alignment is left, and auto spacing uses 240ths of a line.
    style.alignment ??= "left";
    if (
      style.lineSpacing !== undefined &&
      (!style.lineMode || style.lineMode === "auto")
    )
      style.lineSpacing /= 240;
    const runs = Array.from(p.getElementsByTagNameNS(W, "r"))
      .filter((r) => !hidden(r))
      .map((r) => {
        const rPr = child(r, "rPr");
        const text = Array.from(r.children)
          .map((el) => {
            if (el.namespaceURI !== W) return "";
            if (el.localName === "t") return el.textContent ?? "";
            if (el.localName === "tab") return "\t";
            if (el.localName === "br" || el.localName === "cr") return "\n";
            return "";
          })
          .join("");
        return {
          text,
          style: {
            ...style,
            ...resolveStyle(attr(child(rPr, "rStyle"))),
            ...textStyle(rPr),
          },
        };
      })
      .filter((r) => r.text.length > 0);
    const level =
      style.outlineLevel !== undefined &&
      style.outlineLevel >= 0 &&
      style.outlineLevel < 9
        ? style.outlineLevel + 1
        : undefined;
    let ancestor = p.parentElement;
    let inTable = false;
    while (ancestor && ancestor !== body) {
      if (ancestor.localName === "tc" && ancestor.namespaceURI === W)
        inTable = true;
      ancestor = ancestor.parentElement;
    }
    return {
      id: `p-${index}`,
      index,
      text: runs.map((r) => r.text).join(""),
      runs,
      style,
      headingLevel: level,
      kind: level ? "heading" : isList ? "list" : "paragraph",
      inTable,
    };
  });
  if (!paragraphs.some((p) => p.text.trim()))
    throw new Error("Tài liệu chưa có văn bản để kiểm tra.");
  return {
    name,
    paragraphs,
    wordCount: paragraphs.reduce(
      (sum, p) =>
        sum + (p.text.trim() ? p.text.trim().split(/\s+/u).length : 0),
      0,
    ),
  };
}
