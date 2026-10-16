# docsLint

Prototype web kiểm tra định dạng và cấu trúc tài liệu **DOCX**, không dùng AI. File được đọc trong trình duyệt; không gửi tài liệu lên máy chủ. Cấu hình rule và lựa chọn bỏ qua được lưu trong `localStorage`, nội dung tài liệu chỉ giữ trong bộ nhớ của tab.

## Chạy thử

Yêu cầu Node.js 22+ và npm. Môi trường hiện tại đã kiểm thử bằng Node.js 24.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Bấm **Dùng tài liệu mẫu** để kiểm tra một DOCX thực tế có 6 vấn đề cố ý tạo: 3 lỗi và 3 cảnh báo với cấu hình mặc định. Hoặc tải file `.docx` của bạn, tối đa 10 MB.

- Bấm lỗi để xem đoạn tương ứng và hướng dẫn sửa.
- Chọn **Bỏ qua vấn đề này** nếu đó là chủ ý; khôi phục trong tab **Đã bỏ qua**. Lựa chọn áp dụng cho từng vấn đề, được nhớ khi mở lại cùng nội dung file trên trình duyệt này. File thay đổi hoặc yêu cầu rule thay đổi sẽ được kiểm tra lại.
- Kết quả JSON tách `issues` cần xử lý và `ignoredIssues` đã bỏ qua. Bỏ qua không sửa tài liệu hoặc tắt rule cho file khác.
- Trong **Bộ quy tắc**, đổi font, cỡ chữ, căn lề, giãn dòng hoặc mức độ. Nhấn Enter/rời ô để áp dụng giá trị.
- Trong **Plugins**, bật/tắt Standard và Academic.
- Nhập/xuất JSON để chia sẻ preset; xuất kết quả kiểm tra dưới dạng JSON.
- Nút khôi phục mặc định trong Bộ quy tắc đưa cấu hình về ban đầu.

Giao diện ưu tiên PC: tài liệu bên trái và lỗi bên phải cuộn độc lập, thanh công cụ luôn hiển thị. Mở mục lục bằng nút ở góc trái bản đọc, chọn **Vừa chiều rộng** hoặc thu phóng từ 75% đến 150%, hoặc kéo DOCX mới vào vùng làm việc để thay tài liệu. Nút **Mở rộng vùng đọc** ẩn thanh điều hướng và thanh file để dành toàn bộ chiều cao màn hình cho tài liệu và sidebar; nhấn Esc để thu gọn. Đã kiểm tra bố cục ở 1280×720, 1440×900 và 1920×1080.

| Phím tắt      | Thao tác                                     |
| ------------- | -------------------------------------------- |
| `Ctrl/⌘ + O`  | Mở DOCX                                      |
| `/`           | Tìm lỗi                                      |
| `Alt + ↓ / ↑` | Lỗi tiếp theo / trước trong kết quả đang lọc |
| `?`           | Xem phím tắt                                 |
| `Esc`         | Đóng trợ giúp / thu gọn vùng đọc             |

Font Be Vietnam Pro được đóng gói cùng app, không gọi dịch vụ font bên ngoài. Bộ `Leonxlnx/taste-skill` được cài cục bộ cho Codex tại `.agents/skills/`, có nguồn và checksum trong `skills-lock.json`. Giao diện áp dụng hướng dẫn `redesign-existing-projects`.

Skill thiết kế là công cụ phát triển tùy chọn, không cần để chạy ứng dụng. Thư mục `.agents/` được bỏ qua trong Git; cài lại bằng `npx skills add Leonxlnx/taste-skill --agent codex --yes` khi cần.

## Kiến trúc

```text
DOCX → parser/docx.ts → DocumentModel → core/engine.ts → Diagnostics → React UI
                                           ↑
                              plugins + preset JSON
```

- `src/parser/docx.ts`: đọc XML trong DOCX, giải quyết style mặc định, `basedOn`, theme font, character style và định dạng trực tiếp. Cung cấp đoạn văn, heading và danh sách với ID vị trí ổn định trong lần đọc.
- `src/components/DocumentPane.tsx` và `src/parser/preview.ts`: dựng DOCX bằng `docx-preview` trong vùng CSS riêng, giữ định dạng chữ, bảng, ảnh, danh sách và header/footer. Bookmark trên bản sao trong bộ nhớ liên kết lỗi với đúng đoạn, kể cả nội dung trùng nhau; không thay đổi file gốc.
- `src/core/ignored.ts`: định danh file bằng SHA-256 và lưu lựa chọn bỏ qua theo từng vấn đề.
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

Test parser/engine kiểm tra DOCX thật, style kế thừa, font từ theme, numbering, bảng, tracked changes, dữ liệu lỗi, plugin và preset. E2E kiểm tra upload, sample, định dạng DOCX (font, màu, bảng, hình, numbering, header), điều hướng đúng đoạn trùng nội dung, bỏ qua/khôi phục và lưu lựa chọn, lọc, export, cấu hình, plugin, mở rộng vùng đọc và bố cục PC/mobile. Playwright tự chạy dev server nếu cổng 5173 chưa có server.

`npm run sample` tái tạo tài liệu `public/sample-report.docx`; file mẫu đã được đưa vào repository.

## Phạm vi prototype

- Chỉ đọc OOXML `.docx` thông thường; không hỗ trợ `.doc`, PDF, tệp mã hóa hoặc Strict OOXML.
- Đọc văn bản chính và đoạn trong bảng; các rule định dạng nội dung bỏ qua heading, danh sách và ô bảng. Giới hạn 5.000 đoạn và 24 MB XML sau giải nén.
- Không suy đoán font/cỡ chữ/giãn dòng chưa đọc được. Không phát hiện được lỗi ở những thuộc tính thiếu dữ liệu; “không phát hiện vấn đề” chỉ áp dụng cho rule đang bật và dữ liệu đã đọc.
- Chưa hỗ trợ đầy đủ conditional table styles, biến thể style cho từng hệ chữ, toggle style phức tạp hoặc textbox. Tracked deletions được bỏ qua; insertions được đọc như văn bản hiện tại.
- Heading được nhận diện qua `outlineLvl` trong style hoặc định dạng trực tiếp. Chữ in đậm hay số mục gõ tay không tự trở thành heading.
- Bản xem giữ định dạng DOCX nhưng không bảo đảm khớp Word từng pixel; font cần có trên máy và ngắt trang/bố cục phức tạp có thể khác Word. Không cung cấp số trang lint. Giới hạn bản xem 64 MB sau giải nén; nếu không dựng được, app báo lỗi và cho thử lại.
- Chưa kiểm tra margin, header/footer, caption, tham chiếu, ngắt trang hoặc ngữ nghĩa; chưa tự sửa DOCX.
- Academic kiểm tra văn bản trong mục và mục con. Mục chỉ có hình có thể sinh cảnh báo cần người dùng xem xét.

Chạy qua localhost hoặc HTTPS để trình duyệt hỗ trợ SHA-256 cho nhận diện file. Chưa cần tài khoản, database, API key hoặc dịch vụ bên ngoài.
