Đặt các file font `.ttf` / `.otf` mà bạn có quyền sử dụng vào thư mục này để ONLYOFFICE dùng cùng font với tài liệu Word. Không commit font có bản quyền.

Sau khi thêm font, chạy `docker compose --env-file .local/office.env restart office` và mở lại tài liệu. Font thiếu, field, công thức hoặc bố cục phức tạp vẫn có thể khác Microsoft Word; ONLYOFFICE không phải engine của Microsoft Word.
