# docsLint

Mở và **chỉnh sửa DOCX ngay trên web bằng ONLYOFFICE**, với sidebar kiểm tra quy tắc định dạng và cấu trúc. Chọn **Lưu & kiểm tra lại** để lưu DOCX đã sửa và cập nhật kết quả lint. Chọn **Tải DOCX** để lưu và tải bản đang chỉnh sửa.

ONLYOFFICE dựng trang tài liệu bằng trình soạn thảo Office, giữ bảng, ảnh, danh sách, header/footer và bố cục trang thay vì chuyển thành bản đọc HTML. Không bảo đảm khớp Microsoft Word từng pixel: font cần được cài trên máy chủ Office, các field hoặc bố cục phức tạp có thể khác Word. Đặt font có quyền sử dụng trong [fonts/](fonts/README.md) rồi khởi động lại Office.

## Chạy ứng dụng

Yêu cầu **Node.js 22+**, npm và **Docker Compose**; khuyến nghị dành ít nhất 4 GB RAM cho ONLYOFFICE. Lần đầu tải image Office khá lớn và khởi động mất vài phút.

```sh
npm ci
npm run office:up
npm run dev -- --port 5173 --strictPort
```

Lệnh `office:up` tạo khóa JWT ngẫu nhiên trong `.local/office.env` và chạy ONLYOFFICE trên Docker. Không commit hoặc chia sẻ khóa này. `npm run dev` chạy API lưu tài liệu ở cổng 3001 cùng Vite ở cổng 5173. Nếu Office chưa sẵn sàng, ứng dụng hiển thị lỗi rõ ràng; không tự chuyển tài liệu về HTML.

Chạy cả ứng dụng và Office bằng Docker, không cần giữ dev server:

```sh
npm run stack:up
```

Ứng dụng dùng cổng **3000**, chỉ bind loopback theo mặc định. Dừng stack bằng `docker compose --env-file .local/office.env stop`; dữ liệu vẫn còn trong volumes. Không dùng `down -v` nếu cần giữ tài liệu đã lưu.

Kiểm tra dịch vụ:

```sh
docker compose --env-file .local/office.env ps
curl --fail http://127.0.0.1:5173/api/health
# Với bản Docker: dùng cổng 3000 thay cho 5173.
```

Kết quả `officeReady: true` nghĩa là dịch vụ Office đã sẵn sàng. Cần Docker Desktop chạy Linux containers trên Windows/macOS. Với Linux, Compose đã cấu hình `host.docker.internal:host-gateway` để Office truy cập API của dev server.

## Cách dùng

1. Giữ lựa chọn mặc định **Soạn thảo Office** rồi chọn DOCX, tối đa 10 MB, hoặc dùng tài liệu mẫu.
2. Chỉnh chữ, font, bảng, ảnh và bố cục ngay trong trình soạn thảo.
3. Bấm **Lưu & kiểm tra lại**. Sidebar đọc lại chính DOCX vừa lưu; kết quả cũ được đánh dấu **Cần kiểm tra lại** trong lúc sửa. Các lựa chọn bỏ qua của bản cũ không tự áp dụng cho file đã thay đổi.
4. Bấm **Tải DOCX** để lấy bản hiện tại. Sau khi tải lại trang, chọn **Mở lại tài liệu đã lưu gần nhất** để tiếp tục.

Có thể đổi sang Bộ quy tắc hoặc Plugins rồi quay lại mà không đóng phiên soạn thảo. Khi đổi tài liệu có thay đổi chưa lưu, ứng dụng nhắc quay lại lưu trước. Mở lại tạo phiên mới từ bản DOCX đã lưu; prototype chỉ hỗ trợ một phiên chỉnh sửa cho mỗi tài liệu, không dùng đồng thời nhiều tab để sửa cùng file. Nút Save/Ctrl+S của Office đồng bộ với dịch vụ Office; nút **Lưu & kiểm tra lại** của docsLint mới cập nhật kết quả lint. Luôn dùng nút này trước khi rời phiên nếu cần bản lưu và kết quả mới nhất.

- Chọn **Bỏ qua vấn đề này** nếu đó là chủ ý; khôi phục trong **Đã bỏ qua**. Quyết định gắn với nội dung file, rule và yêu cầu đang áp dụng.
- Kết quả JSON tách `issues` và `ignoredIssues`; `snapshot: "last-checked"` cho biết kết quả thuộc bản đã kiểm tra trước khi sửa tiếp.
- Trong **Bộ quy tắc**, đổi font, cỡ chữ, căn lề, giãn dòng hoặc mức độ; nhập/xuất preset JSON để chia sẻ.
- Trong **Plugins**, bật/tắt Standard và Academic. Xem [hướng dẫn viết plugin](public/plugin-guide.md).
- Nút **Mở rộng vùng đọc** dành toàn bộ chiều cao màn hình cho soạn thảo và sidebar.
- Trong chế độ Office, chọn lỗi để đọc đoạn trích/hướng dẫn; dùng Tìm kiếm của Office để đến đoạn đó. Chưa có liên kết chọn đoạn tự động giữa sidebar và editor.

**Chỉ đọc nhanh trên máy** là chế độ phụ, chọn rõ ràng trước khi nhập file. Chế độ này xử lý trong trình duyệt bằng `docx-preview`, không chỉnh sửa, có thể khác bố cục Word; hỗ trợ bấm lỗi để đến đoạn, mục lục và thu phóng.

## Tài liệu được lưu ở đâu?

Chế độ Office gửi tài liệu đến **dịch vụ docsLint và ONLYOFFICE do bạn tự chạy**; không dùng máy chủ Office công cộng. Dev lưu DOCX và metadata trong `.local/documents/`. Bản Docker lưu trong volume `documents`; ONLYOFFICE có các volumes dữ liệu/cache riêng. Đóng tab không xóa file. Máy chủ giới hạn 100 tài liệu, mỗi file 10 MB; quản trị viên cần dọn các thư mục tài liệu không dùng khi đầy.

Trình duyệt lưu cấu hình, lựa chọn bỏ qua và khóa mở lại tài liệu gần nhất trong `localStorage`. API dùng khóa truy cập riêng cho mỗi tài liệu, config/callback Office có chữ ký JWT. Khóa mở lại và file metadata là dữ liệu riêng tư. Prototype phục vụ môi trường riêng; chưa có tài khoản, phân quyền người dùng hoặc lịch sử phiên bản. Khi đưa lên Internet cần đặt sau lớp đăng nhập và HTTPS. Backend và Office phải truy cập được nhau; không mở trực tiếp cổng Office ra ngoài nếu không cần.

Các cấu hình backend tùy chọn:

| Biến               | Mặc định dev                       | Ý nghĩa                            |
| ------------------ | ---------------------------------- | ---------------------------------- |
| `PORT`             | `3001`                             | Cổng API/static server             |
| `DATA_DIR`         | `.local/documents`                 | Nơi lưu DOCX và metadata           |
| `ONLYOFFICE_URL`   | `http://127.0.0.1:8082`            | Địa chỉ Office mà backend truy cập |
| `APP_INTERNAL_URL` | `http://host.docker.internal:3001` | Địa chỉ API mà Office truy cập     |
| `JWT_SECRET`       | Đọc `.local/office.env`            | Khóa chung giữa backend và Office  |

Trình duyệt truy cập Office qua `/office/` trên cùng origin với ứng dụng, hỗ trợ WebSocket qua proxy. Reverse proxy HTTPS bên ngoài phải truyền `Host`, `X-Forwarded-Proto` và hỗ trợ WebSocket. Các cổng và network của Compose được cấu hình sẵn cho chạy local. Nếu môi trường dùng CA riêng và đã đặt `NODE_EXTRA_CA_CERTS`, script `stack:up` truyền CA đó vào bước build qua BuildKit secret; vẫn kiểm tra TLS và không đóng gói CA vào image.

## Kiến trúc

```text
DOCX → ONLYOFFICE (xem / sửa) → DOCX đã lưu → parser → rule plugins → sidebar
               ↕                    ↕
       Office tự lưu trữ       docsLint API + kho file
```

- `server/app.mjs`: upload DOCX, tạo config editor, xác thực callback, lưu/tải snapshot, proxy Office và phục vụ bản build.
- `server/security.mjs`: JWT và giới hạn tải snapshot về đúng cache tài liệu trên Office của mình; không fetch hostname tùy ý từ client.
- `src/components/OfficePane.tsx`: phiên soạn thảo, trạng thái chỉnh sửa, lưu/kiểm tra/tải DOCX.
- `src/parser/docx.ts`: đọc OOXML thành DocumentModel; xử lý style kế thừa, theme font, character style và định dạng trực tiếp.
- `src/core/engine.ts`, `src/plugins/`: plugin lint và preset JSON. Plugin TypeScript được đóng gói cùng ứng dụng; JSON không thực thi mã. Chưa có marketplace/tải plugin động.
- `src/components/DocumentPane.tsx`, `src/parser/preview.ts`: chế độ đọc nhanh cục bộ.

## Kiểm thử

```sh
npm test
npm run test:server
npm run build
npm run office:up

# Cloud environment này có Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e

# Máy chưa có browser của Playwright:
npx playwright install chromium
npm run test:e2e
```

E2E Office dùng **Document Server thật**: gõ nội dung, lưu, đọc DOCX tải về, kiểm tra kết quả lint và mở lại tài liệu. Test bảng/ảnh/header/numbering kiểm tra các thành phần còn trong DOCX sau khi sửa và xuất. Các bài đọc nhanh vẫn kiểm tra định dạng HTML và điều hướng của chế độ phụ. API tests kiểm tra chữ ký, quyền tải file, callback, snapshot và tính bền vững qua lần khởi động lại.

`npm run sample` tái tạo tài liệu `public/sample-report.docx` có 6 vấn đề cố ý tạo. Chạy localhost hoặc HTTPS để dùng SHA-256 nhận diện nội dung file.

## Phạm vi lint

- Lint đọc OOXML `.docx` thông thường, tối đa 5.000 đoạn và 24 MB XML; giới hạn giải nén bản xem/upload là 64 MB.
- Kiểm tra văn bản chính và đoạn trong bảng. Rule định dạng nội dung bỏ qua heading, danh sách và ô bảng.
- Chưa lint margin, header/footer, caption, tham chiếu, ngắt trang hoặc ngữ nghĩa, dù editor hiển thị/chỉnh sửa được các thành phần này.
- Không suy đoán thuộc tính chưa đọc được; “không phát hiện vấn đề” chỉ áp dụng cho rule đang bật và dữ liệu đã đọc.
- Chưa hỗ trợ đầy đủ conditional table styles, biến thể style cho từng hệ chữ, toggle style phức tạp hoặc textbox. Tracked deletions bỏ qua; insertions đọc như văn bản hiện tại.
- Academic kiểm tra văn bản trong mục và mục con; mục chỉ có hình có thể sinh cảnh báo để tác giả cân nhắc bỏ qua.

Font giao diện Be Vietnam Pro được đóng gói cùng app. Bộ `Leonxlnx/taste-skill` là công cụ thiết kế tùy chọn cho Codex trong `.agents/skills/`, có nguồn/checksum ở `skills-lock.json`; cài lại bằng `npx skills add Leonxlnx/taste-skill --agent codex --yes`. Không cần skill để chạy app.
