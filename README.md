# docsLint

Prototype web kiểm tra định dạng và cấu trúc tài liệu **DOCX**, không dùng AI. File được đọc trong trình duyệt; không gửi tài liệu lên máy chủ. Cấu hình rule được lưu trong `localStorage`, nội dung tài liệu chỉ giữ trong bộ nhớ của tab.

## Chạy thử

Yêu cầu Node.js 22+ và npm. Môi trường hiện tại đã kiểm thử bằng Node.js 24.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Bấm **Dùng tài liệu mẫu** để kiểm tra một DOCX thực tế có 6 vấn đề cố ý tạo: 3 lỗi và 3 cảnh báo với cấu hình mặc định. Hoặc tải file `.docx` của bạn, tối đa 10 MB.

- Bấm lỗi để xem đoạn tương ứng và hướng dẫn sửa.
- Trong **Bộ quy tắc**, đổi font, cỡ chữ, căn lề, giãn dòng hoặc mức độ. Nhấn Enter/rời ô để áp dụng giá trị.
- Trong **Plugins**, bật/tắt Standard và Academic.
- Nhập/xuất JSON để chia sẻ preset; xuất kết quả kiểm tra dưới dạng JSON.
- Nút khôi phục mặc định trong Bộ quy tắc đưa cấu hình về ban đầu.

Giao diện ưu tiên PC: tài liệu bên trái và lỗi bên phải cuộn độc lập, thanh công cụ luôn hiển thị. Mở mục lục bằng nút ở góc trái bản đọc, thu phóng từ 90% đến 125%, hoặc kéo DOCX mới vào vùng làm việc để thay tài liệu. Đã kiểm tra bố cục ở 1280×720, 1440×900 và 1920×1080.

| Phím tắt      | Thao tác                                     |
| ------------- | -------------------------------------------- |
| `Ctrl/⌘ + O`  | Mở DOCX                                      |
| `/`           | Tìm lỗi                                      |
| `Alt + ↓ / ↑` | Lỗi tiếp theo / trước trong kết quả đang lọc |
| `?`           | Xem phím tắt                                 |
| `Esc`         | Đóng trợ giúp                                |

Font Be Vietnam Pro được đóng gói cùng app, không gọi dịch vụ font bên ngoài. Bộ `Leonxlnx/taste-skill` được cài cục bộ cho Codex tại `.agents/skills/`, có nguồn và checksum trong `skills-lock.json`. Giao diện áp dụng hướng dẫn `redesign-existing-projects`.

Skill thiết kế là công cụ phát triển tùy chọn, không cần để chạy ứng dụng. Thư mục `.agents/` được bỏ qua trong Git; cài lại bằng `npx skills add Leonxlnx/taste-skill --agent codex --yes` khi cần.

## Kiến trúc

```text
DOCX → parser/docx.ts → DocumentModel → core/engine.ts → Diagnostics → React UI
                                           ↑
                              plugins + preset JSON
```

- `src/parser/docx.ts`: đọc XML trong DOCX, giải quyết style mặc định, `basedOn`, theme font, character style và định dạng trực tiếp. Cung cấp đoạn văn, heading và danh sách với ID vị trí ổn định trong lần đọc.
- `src/core/types.ts`: hợp đồng Document Model, rule, plugin và cấu hình.
- `src/core/engine.ts`: chạy rule đang bật, kiểm tra preset và tổng hợp diagnostic.
- `src/plugins/standard.ts`: 5 rule cho heading, font, cỡ chữ, căn lề, giãn dòng.
- `src/plugins/academic.ts`: plugin độc lập mẫu, cảnh báo mục chưa có văn bản.
- `src/plugins/index.ts`: nơi đăng ký thêm plugin.

Xem [hướng dẫn viết plugin](public/plugin-guide.md). Plugin TypeScript được đóng gói cùng ứng dụng; JSON chỉ chứa cấu hình, không thực thi mã. Chưa có tải plugin động hoặc marketplace.

## Kiểm thử

```sh
npm test
npm run build

# Cloud environment này đã có Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e

# Máy chưa có trình duyệt cho Playwright:
npx playwright install chromium
npm run test:e2e
```

Test parser/engine kiểm tra DOCX thật, style kế thừa, font từ theme, numbering, bảng, tracked changes, dữ liệu lỗi, plugin và preset. E2E kiểm tra upload, sample, điều hướng tới lỗi, lọc, export, cấu hình, plugin và giao diện mobile. Playwright tự chạy dev server nếu cổng 5173 chưa có server.

`npm run sample` tái tạo tài liệu `public/sample-report.docx`; file mẫu đã được đưa vào repository.

## Phạm vi prototype

- Chỉ đọc OOXML `.docx` thông thường; không hỗ trợ `.doc`, PDF, tệp mã hóa hoặc Strict OOXML.
- Đọc văn bản chính và đoạn trong bảng; các rule định dạng nội dung bỏ qua heading, danh sách và ô bảng. Giới hạn 5.000 đoạn và 24 MB XML sau giải nén.
- Không suy đoán font/cỡ chữ/giãn dòng chưa đọc được. Không phát hiện được lỗi ở những thuộc tính thiếu dữ liệu; “không phát hiện vấn đề” chỉ áp dụng cho rule đang bật và dữ liệu đã đọc.
- Chưa hỗ trợ đầy đủ conditional table styles, biến thể style cho từng hệ chữ, toggle style phức tạp hoặc textbox. Tracked deletions được bỏ qua; insertions được đọc như văn bản hiện tại.
- Heading được nhận diện qua `outlineLvl` trong style hoặc định dạng trực tiếp. Chữ in đậm hay số mục gõ tay không tự trở thành heading.
- Bản đọc bên cạnh giúp tìm đoạn, không mô phỏng trang Word và không cung cấp số trang. Bullet được minh họa bằng dấu chấm.
- Chưa kiểm tra margin, header/footer, caption, tham chiếu, ngắt trang hoặc ngữ nghĩa; chưa tự sửa DOCX.
- Academic kiểm tra văn bản trong mục và mục con. Mục chỉ có hình có thể sinh cảnh báo cần người dùng xem xét.

Chưa cần tài khoản, database, API key hoặc dịch vụ bên ngoài.
