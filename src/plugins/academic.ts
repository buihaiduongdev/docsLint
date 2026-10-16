import type { LintPlugin } from "../core/types";

/** A small example of a separately registered community plugin. */
export const academicPlugin: LintPlugin = {
  id: "academic",
  name: "Academic",
  version: "0.1.0",
  apiVersion: 1,
  author: "Plugin mẫu",
  description: "Plugin mở rộng mẫu: phát hiện mục không có nội dung văn bản.",
  rules: [
    {
      id: "heading/no-empty-section",
      title: "Mục không có văn bản",
      category: "Cấu trúc",
      defaultSeverity: "warning",
      description:
        "Cảnh báo mục không có văn bản, kể cả trong mục con. Mục chỉ chứa hình có thể được bỏ qua thủ công.",
      check({ document, report }) {
        const nodes = document.paragraphs;
        nodes.forEach((p, i) => {
          if (!p.headingLevel) return;
          let hasContent = false;
          for (let j = i + 1; j < nodes.length; j++) {
            const next = nodes[j];
            if (next.headingLevel && next.headingLevel <= p.headingLevel) break;
            if (!next.headingLevel && next.text.trim()) {
              hasContent = true;
              break;
            }
          }
          if (!hasContent)
            report({
              nodeId: p.id,
              message: "Mục chưa có nội dung văn bản",
              expected: "Ít nhất một đoạn nội dung",
              actual: "Chỉ có tiêu đề",
              suggestion:
                "Bổ sung nội dung cho mục, hoặc kiểm tra xem đây có phải mục chỉ chứa hình ảnh hay không.",
            });
        });
      },
    },
  ],
};
