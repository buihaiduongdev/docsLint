import type { LintPlugin, Paragraph, Rule } from "../core/types";

const body = (p: Paragraph) =>
  p.kind === "paragraph" && p.text.trim() && !p.inTable;
const labels: Record<string, string> = {
  left: "Căn trái",
  center: "Căn giữa",
  right: "Căn phải",
  justify: "Căn đều",
};

const heading: Rule = {
  id: "heading/no-skip-level",
  title: "Thứ bậc tiêu đề",
  category: "Cấu trúc",
  defaultSeverity: "error",
  description: "Tiêu đề bắt đầu từ cấp 1 và không bỏ qua cấp khi đi sâu hơn.",
  check({ document, report }) {
    let previous = 0;
    for (const p of document.paragraphs) {
      if (!p.headingLevel) continue;
      if (p.headingLevel > previous + 1)
        report({
          nodeId: p.id,
          message: "Tiêu đề nhảy cấp",
          expected: `Heading ${previous + 1} hoặc cấp cao hơn`,
          actual: `Heading ${p.headingLevel}`,
          suggestion: `Trong Word, chọn tiêu đề và áp dụng style Heading ${previous + 1} nếu đây là mục con trực tiếp.`,
        });
      previous = p.headingLevel;
    }
  },
};

const font: Rule = {
  id: "typography/font-family",
  title: "Font chữ nội dung",
  category: "Định dạng",
  defaultSeverity: "error",
  description:
    "Kiểm tra font hiệu lực của từng phần văn bản trong đoạn nội dung.",
  options: {
    font: { label: "Font chữ", type: "text", default: "Times New Roman" },
  },
  check({ document, options, report }) {
    for (const p of document.paragraphs.filter(body)) {
      const actual = [
        ...new Set(
          p.runs
            .filter(
              (r) =>
                r.text.trim() &&
                r.style.fontFamily &&
                r.style.fontFamily.toLowerCase() !==
                  String(options.font).toLowerCase(),
            )
            .map((r) => r.style.fontFamily!),
        ),
      ];
      if (actual.length)
        report({
          nodeId: p.id,
          message: "Font chữ chưa đúng quy chuẩn",
          expected: String(options.font),
          actual: actual.join(", "),
          suggestion: `Chọn phần văn bản trong đoạn và đổi font thành ${options.font}.`,
        });
    }
  },
};

const size: Rule = {
  id: "typography/font-size",
  title: "Cỡ chữ nội dung",
  category: "Định dạng",
  defaultSeverity: "error",
  description: "Kiểm tra cỡ chữ của đoạn nội dung; bỏ qua tiêu đề và ô bảng.",
  options: {
    pt: { label: "Cỡ chữ (pt)", type: "number", default: 13, min: 6, max: 72 },
  },
  check({ document, options, report }) {
    for (const p of document.paragraphs.filter(body)) {
      const actual = [
        ...new Set(
          p.runs
            .filter(
              (r) =>
                r.text.trim() &&
                r.style.fontSize !== undefined &&
                r.style.fontSize !== options.pt,
            )
            .map((r) => `${r.style.fontSize} pt`),
        ),
      ];
      if (actual.length)
        report({
          nodeId: p.id,
          message: "Cỡ chữ chưa đồng nhất",
          expected: `${options.pt} pt`,
          actual: actual.join(", "),
          suggestion: `Đặt cỡ chữ đoạn nội dung thành ${options.pt} pt.`,
        });
    }
  },
};

const alignment: Rule = {
  id: "paragraph/alignment",
  title: "Căn lề đoạn văn",
  category: "Đoạn văn",
  defaultSeverity: "warning",
  description:
    "Kiểm tra căn lề đoạn nội dung; bỏ qua danh sách, tiêu đề và bảng.",
  options: {
    value: {
      label: "Kiểu căn lề",
      type: "select",
      default: "justify",
      choices: Object.entries(labels).map(([value, label]) => ({
        value,
        label,
      })),
    },
  },
  check({ document, options, report }) {
    for (const p of document.paragraphs.filter(body)) {
      if (p.style.alignment && p.style.alignment !== options.value)
        report({
          nodeId: p.id,
          message: "Đoạn văn chưa đúng kiểu căn lề",
          expected: labels[options.value] ?? String(options.value),
          actual: labels[p.style.alignment] ?? p.style.alignment,
          suggestion: `Trong Paragraph, chọn ${labels[options.value] ?? options.value}.`,
        });
    }
  },
};

const spacing: Rule = {
  id: "paragraph/line-spacing",
  title: "Giãn dòng",
  category: "Đoạn văn",
  defaultSeverity: "warning",
  description: "So sánh giãn dòng theo hệ số. Bỏ qua giá trị không xác định.",
  options: {
    multiple: {
      label: "Hệ số giãn dòng",
      type: "number",
      default: 1.5,
      min: 0.5,
      max: 4,
    },
  },
  check({ document, options, report }) {
    for (const p of document.paragraphs.filter(body)) {
      if (p.style.lineSpacing === undefined) continue;
      const fixed = p.style.lineMode && p.style.lineMode !== "auto";
      if (
        fixed ||
        Math.abs(p.style.lineSpacing - Number(options.multiple)) > 0.01
      )
        report({
          nodeId: p.id,
          message: "Giãn dòng chưa đúng quy chuẩn",
          expected: `${options.multiple} dòng`,
          actual: fixed
            ? `${p.style.lineSpacing / 20} pt (${p.style.lineMode})`
            : `${p.style.lineSpacing} dòng`,
          suggestion: `Trong Paragraph → Line spacing, chọn Multiple và nhập ${options.multiple}.`,
        });
    }
  },
};

export const standardPlugin: LintPlugin = {
  id: "standard",
  name: "Standard",
  version: "0.1.0",
  apiVersion: 1,
  author: "docsLint",
  description: "Những kiểm tra cơ bản cho cấu trúc và định dạng tài liệu DOCX.",
  rules: [heading, font, size, alignment, spacing],
};
