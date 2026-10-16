# Viết plugin cho docsLint

Plugin bổ sung rule TypeScript. Preset JSON chọn mức độ và options cho các rule đã cài. Prototype đóng gói plugin cùng app, chưa tải JavaScript bên ngoài khi chạy.

## 1. Tạo plugin

Tạo `src/plugins/my-school.ts`:

```ts
import type { LintPlugin } from "../core/types";

export const mySchoolPlugin: LintPlugin = {
  id: "my-school",
  name: "My School",
  version: "0.1.0",
  apiVersion: 1,
  author: "Tên của bạn",
  description: "Quy tắc riêng cho mẫu báo cáo của trường.",
  rules: [
    {
      id: "heading/max-depth",
      title: "Giới hạn cấp tiêu đề",
      description: "Cảnh báo tiêu đề có cấp sâu hơn giới hạn cấu hình.",
      category: "Cấu trúc",
      defaultSeverity: "warning",
      options: {
        max: {
          label: "Cấp tối đa",
          type: "number",
          default: 3,
          min: 1,
          max: 9,
        },
      },
      check({ document, options, report }) {
        for (const node of document.paragraphs) {
          if (node.headingLevel && node.headingLevel > Number(options.max)) {
            report({
              nodeId: node.id,
              message: "Tiêu đề có quá nhiều cấp",
              expected: `Tối đa Heading ${options.max}`,
              actual: `Heading ${node.headingLevel}`,
              suggestion: "Rà soát phân cấp và chọn style heading phù hợp.",
            });
          }
        }
      },
    },
  ],
};
```

## 2. Đăng ký

Trong `src/plugins/index.ts`, import plugin và thêm vào mảng `plugins`. Giao diện tự hiển thị plugin, rule và controls dựa trên metadata. Khởi tạo lại app nếu cần; preset lưu cũ được bổ sung các rule mới bằng giá trị mặc định.

ID đầy đủ của rule là `my-school/heading/max-depth`. ID plugin và rule phải duy nhất; `apiVersion` hiện là `1`.

## 3. Tạo preset

Xuất từ màn hình Bộ quy tắc hoặc viết JSON:

```json
{
  "version": 1,
  "plugins": { "standard": true, "academic": false, "my-school": true },
  "rules": {
    "standard/typography/font-size": {
      "severity": "error",
      "options": { "pt": 13 }
    },
    "my-school/heading/max-depth": {
      "severity": "warning",
      "options": { "max": 3 }
    }
  }
}
```

Các rule/options bị bỏ trống dùng mặc định. `severity` nhận `error`, `warning`, `off`. Plugin và rule chưa cài bị từ chối khi import. Options được kiểm tra theo metadata (type, min/max hoặc choices).

## Hợp đồng rule

- Nhận `document`, `options`, `report`; chạy đồng bộ và tạo cùng kết quả cho cùng đầu vào.
- Đọc Document Model, không tự mở ZIP/XML hoặc sửa tài liệu. Không gọi mạng.
- Mỗi lỗi cần `nodeId` có trong tài liệu, `message`, `actual`, `expected`, `suggestion`.
- Engine thêm `ruleId`, `severity` và ID diagnostic.
- Tạo trạng thái riêng cho từng lần `check`, không dùng biến module lưu trạng thái giữa các tài liệu.
- Bỏ qua thuộc tính `undefined` khi không đủ dữ liệu kết luận.
- `node.index` bắt đầu từ 0; UI hiển thị “Đoạn index + 1”. Không suy ra số trang Word.

Tham khảo `tests/core.test.ts` để tạo fixture DOCX và test rule qua `lint()`. Luôn có mẫu hợp lệ, mẫu sai và trường hợp thiếu dữ liệu.
