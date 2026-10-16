import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { richDocx } from "./fixtures/rich-docx";
import { preparePreview } from "../src/parser/preview";
import { parseDocx } from "../src/parser/docx";
import { diagnosticKey, readIgnored, saveIgnored } from "../src/core/ignored";
import { createConfig, lint } from "../src/core/engine";
import { plugins } from "../src/plugins";

describe("formatted preview source locations", () => {
  it("preserves source bytes, styles, images and lint results while mapping duplicate paragraphs and table cells", () => {
    const source = richDocx();
    const original = source.slice();
    const before = parseDocx(source, "rich.docx");
    const preview = preparePreview(source);
    expect(source).toEqual(original);
    expect(parseDocx(preview.data, "rich.docx")).toEqual(before);
    expect([...preview.bookmarks.values()]).toEqual(
      before.paragraphs.map((p) => p.id),
    );
    expect(before.paragraphs[4]).toMatchObject({
      text: "Đoạn trùng nhau.",
      inTable: true,
    });
    const parts = unzipSync(source);
    const prepared = unzipSync(preview.data);
    for (const name of Object.keys(parts).filter(
      (n) => n !== "word/document.xml",
    )) {
      expect(prepared[name]).toEqual(parts[name]);
    }
  });

  it("avoids existing bookmarks and excludes deleted paragraphs from source numbering", () => {
    const parts = unzipSync(richDocx());
    parts["word/document.xml"] = strToU8(
      strFromU8(parts["word/document.xml"]).replace(
        "<w:body>",
        '<w:body><w:del><w:p><w:r><w:delText>Deleted</w:delText></w:r></w:p></w:del><w:bookmarkStart w:id="1" w:name="_docsLintSource_0"/><w:bookmarkEnd w:id="1"/>',
      ),
    );
    const source = zipSync(parts);
    const preview = preparePreview(source);
    expect(preview.bookmarks.size).toBe(9);
    expect(preview.bookmarks.has("_docsLintSource_0")).toBe(false);
    const prepared = strFromU8(unzipSync(preview.data)["word/document.xml"]);
    const xml = new DOMParser().parseFromString(prepared, "application/xml");
    const starts = [...xml.getElementsByTagName("w:bookmarkStart")];
    expect(new Set(starts.map((el) => el.getAttribute("w:id"))).size).toBe(
      starts.length,
    );
    expect(parseDocx(preview.data, "rich.docx")).toEqual(
      parseDocx(source, "rich.docx"),
    );
  });
});

describe("per-document ignored diagnostics", () => {
  it("keeps choices across engine ID changes but rechecks changed requirements", () => {
    const issue = lint(
      parseDocx(richDocx(), "rich.docx"),
      plugins,
      createConfig(plugins),
    )[0];
    expect(diagnosticKey({ ...issue, id: "different" })).toBe(
      diagnosticKey(issue),
    );
    for (const field of ["nodeId", "actual", "expected", "severity"] as const) {
      expect(diagnosticKey({ ...issue, [field]: "changed" })).not.toBe(
        diagnosticKey(issue),
      );
    }
  });
  it("stores choices separately for each file and handles corrupt storage", () => {
    localStorage.clear();
    expect(saveIgnored("one", new Set(["choice"]))).toBe(true);
    expect([...readIgnored("one")]).toEqual(["choice"]);
    expect([...readIgnored("two")]).toEqual([]);
    localStorage.setItem("docslint-ignored:two", "broken json");
    expect([...readIgnored("two")]).toEqual([]);
    saveIgnored("one", new Set());
    expect(localStorage.getItem("docslint-ignored:one")).toBeNull();
  });
});
