import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { parseDocx } from "../src/parser/docx";
import { createConfig, lint, parseConfig } from "../src/core/engine";
import { plugins } from "../src/plugins";
import type { LintPlugin } from "../src/core/types";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const fixture = (
  body: string,
  styles = "",
  extras: Record<string, string> = {},
) =>
  zipSync(
    Object.fromEntries(
      Object.entries({
        "word/document.xml": `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`,
        "word/styles.xml": `<w:styles xmlns:w="${W}">${styles}</w:styles>`,
        ...extras,
      }).map(([name, source]) => [name, strToU8(source)]),
    ),
  );
const p = (text: string, props = "", runProps = "") =>
  `<w:p><w:pPr>${props}</w:pPr><w:r><w:rPr>${runProps}</w:rPr><w:t>${text}</w:t></w:r></w:p>`;
const sample = () =>
  parseDocx(
    new Uint8Array(readFileSync("public/sample-report.docx")),
    "sample.docx",
  );

describe("DOCX parsing and real lint diagnostics", () => {
  it("parses the downloadable DOCX sample and finds the six intended problems", () => {
    const doc = sample();
    const issues = lint(doc, plugins, createConfig(plugins));
    expect(doc.paragraphs).toHaveLength(12);
    expect(doc.paragraphs.filter((p) => p.kind === "list")).toHaveLength(2);
    expect(issues).toHaveLength(6);
    expect(issues.map((i) => [i.ruleId, i.nodeId])).toEqual([
      ["standard/typography/font-family", "p-2"],
      ["standard/typography/font-size", "p-2"],
      ["standard/heading/no-skip-level", "p-3"],
      ["standard/paragraph/alignment", "p-4"],
      ["standard/paragraph/line-spacing", "p-4"],
      ["academic/heading/no-empty-section", "p-11"],
    ]);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(3);
  });

  it("resolves defaults, basedOn, character style and direct run overrides", () => {
    const doc = parseDocx(
      fixture(
        p(
          "Hello",
          '<w:pStyle w:val="Derived"/>',
          '<w:rStyle w:val="Char"/><w:sz w:val="28"/>',
        ),
        `
      <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
      <w:style w:styleId="Base"><w:rPr><w:sz w:val="26"/></w:rPr><w:pPr><w:jc w:val="both"/></w:pPr></w:style>
      <w:style w:styleId="Derived"><w:basedOn w:val="Base"/><w:pPr><w:spacing w:line="360"/></w:pPr></w:style>
      <w:style w:styleId="Char"><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="20"/></w:rPr></w:style>`,
      ),
      "styles.docx",
    );
    expect(doc.paragraphs[0].style).toMatchObject({
      fontFamily: "Times New Roman",
      fontSize: 13,
      alignment: "justify",
      lineSpacing: 1.5,
    });
    expect(doc.paragraphs[0].runs[0].style).toMatchObject({
      fontFamily: "Arial",
      fontSize: 14,
    });
  });

  it("resolves theme fonts and default paragraph style without guessing unknown font data", () => {
    const styles = `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr></w:style>`;
    const doc = parseDocx(
      fixture(p("Hello"), styles, {
        "word/theme/theme1.xml":
          '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>',
      }),
      "theme.docx",
    );
    expect(doc.paragraphs[0].runs[0].style.fontFamily).toBe("Aptos");
    const unknown = parseDocx(fixture(p("Unknown")), "unknown.docx");
    expect(unknown.paragraphs[0].runs[0].style.fontSize).toBeUndefined();
    expect(
      lint(unknown, plugins, createConfig(plugins)).some((i) =>
        i.ruleId.includes("typography"),
      ),
    ).toBe(false);
  });

  it("handles linked text, table paragraphs and accepted tracked insertions without deleted text", () => {
    const doc = parseDocx(
      fixture(
        `<w:p><w:hyperlink><w:r><w:t>Link</w:t></w:r></w:hyperlink><w:del><w:r><w:t>Removed</w:t></w:r></w:del><w:ins><w:r><w:t> added</w:t></w:r></w:ins></w:p><w:tbl><w:tr><w:tc>${p("Cell")}</w:tc></w:tr></w:tbl>`,
      ),
      "table.docx",
    );
    expect(doc.paragraphs.map((p) => p.text)).toEqual(["Link added", "Cell"]);
    expect(doc.paragraphs[1].inTable).toBe(true);
  });

  it("reads list indentation from numbering definitions and direct override", () => {
    const doc = parseDocx(
      fixture(
        p(
          "List",
          '<w:numPr><w:numId w:val="7"/></w:numPr><w:ind w:left="1440"/>',
        ),
        "",
        {
          "word/numbering.xml": `<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:pPr><w:ind w:left="720"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>`,
        },
      ),
      "list.docx",
    );
    expect(doc.paragraphs[0]).toMatchObject({
      kind: "list",
      style: { indent: 72 },
    });
  });

  it("rejects invalid, empty, malformed and oversized documents", () => {
    expect(() => parseDocx(strToU8("not zip"), "bad.docx")).toThrow(
      "Không đọc được",
    );
    expect(() => parseDocx(zipSync({}), "empty.docx")).toThrow(
      "Không tìm thấy",
    );
    expect(() => parseDocx(fixture(""), "blank.docx")).toThrow(
      "chưa có văn bản",
    );
    expect(() => parseDocx(fixture("<w:p>"), "malformed.docx")).toThrow("XML");
    expect(() =>
      parseDocx(new Uint8Array(10 * 1024 * 1024 + 1), "large.docx"),
    ).toThrow("quá lớn");
    const bomb = zipSync({
      "word/document.xml": new Uint8Array(24 * 1024 * 1024 + 1),
    });
    expect(() => parseDocx(bomb, "expanded.docx")).toThrow("giới hạn giải nén");
  });

  it("handles cyclic style inheritance without hanging", () => {
    const doc = parseDocx(
      fixture(
        p("Loop", '<w:pStyle w:val="A"/>'),
        `<w:style w:styleId="A"><w:basedOn w:val="B"/></w:style><w:style w:styleId="B"><w:basedOn w:val="A"/></w:style>`,
      ),
      "cycle.docx",
    );
    expect(doc.paragraphs[0].text).toBe("Loop");
  });
});

describe("plugin contract and presets", () => {
  it("respects plugin enablement, rule severity and options", () => {
    const config = createConfig(plugins);
    config.plugins.academic = false;
    config.rules["standard/typography/font-family"].severity = "off";
    config.rules["standard/typography/font-size"].severity = "warning";
    const issues = lint(sample(), plugins, config);
    expect(issues).toHaveLength(4);
    expect(issues.find((i) => i.ruleId.endsWith("font-size"))?.severity).toBe(
      "warning",
    );
    const doc = parseDocx(
      fixture(
        p(
          "Correct",
          '<w:jc w:val="both"/>',
          '<w:rFonts w:ascii="Arial"/><w:sz w:val="24"/>',
        ),
      ),
      "valid.docx",
    );
    config.rules["standard/typography/font-size"].options.pt = 12;
    expect(lint(doc, plugins, config)).toHaveLength(0);
  });

  it("lets a new plugin report source locations without modifying parser or engine", () => {
    const plugin: LintPlugin = {
      id: "custom",
      name: "Custom",
      author: "Test",
      version: "1",
      apiVersion: 1,
      description: "Test",
      rules: [
        {
          id: "sample",
          title: "Sample",
          description: "",
          category: "Cấu trúc",
          defaultSeverity: "warning",
          check: ({ document, report }) =>
            report({
              nodeId: document.paragraphs[0].id,
              message: "Example",
              actual: "a",
              expected: "b",
              suggestion: "Fix",
            }),
        },
      ],
    };
    const result = lint(sample(), [plugin], createConfig([plugin]));
    expect(result[0]).toMatchObject({
      ruleId: "custom/sample",
      nodeId: "p-0",
      severity: "warning",
    });
  });

  it("roundtrips a preset and rejects unknown rules, plugins and invalid options", () => {
    const config = createConfig(plugins);
    expect(parseConfig(JSON.parse(JSON.stringify(config)), plugins)).toEqual(
      config,
    );
    expect(() =>
      parseConfig({ ...config, plugins: { remote: true } }, plugins),
    ).toThrow("chưa được cài");
    expect(() =>
      parseConfig({ ...config, rules: { unknown: {} } }, plugins),
    ).toThrow("không tồn tại");
    expect(() =>
      parseConfig(
        {
          ...config,
          rules: {
            "standard/typography/font-size": {
              severity: "error",
              options: { pt: -1 },
            },
          },
        },
        plugins,
      ),
    ).toThrow("không hợp lệ");
    expect(() =>
      parseConfig(
        {
          ...config,
          rules: {
            "standard/paragraph/alignment": {
              severity: "error",
              options: { value: "invalid" },
            },
          },
        },
        plugins,
      ),
    ).toThrow("không hợp lệ");
    expect(() =>
      parseConfig(
        {
          ...config,
          rules: {
            "standard/typography/font-size": { severity: "fatal", options: {} },
          },
        },
        plugins,
      ),
    ).toThrow("Mức độ");
  });
});
