import { useEffect, useRef } from "react";
import { Keyboard, X } from "lucide-react";

export function ShortcutHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="shortcut-dialog"
      aria-labelledby="shortcut-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="shortcut-heading">
        <Keyboard size={22} />
        <h2 id="shortcut-title">Phím tắt</h2>
        <button
          className="icon-button"
          aria-label="Đóng phím tắt"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <p>Rà soát tài liệu mà không rời bàn phím.</p>
      <dl>
        <div>
          <dt>Mở tài liệu DOCX</dt>
          <dd>
            <kbd>Ctrl / ⌘</kbd>
            <kbd>O</kbd>
          </dd>
        </div>
        <div>
          <dt>Tìm lỗi</dt>
          <dd>
            <kbd>/</kbd>
          </dd>
        </div>
        <div>
          <dt>Lỗi tiếp theo</dt>
          <dd>
            <kbd>Alt</kbd>
            <kbd>↓</kbd>
          </dd>
        </div>
        <div>
          <dt>Lỗi trước</dt>
          <dd>
            <kbd>Alt</kbd>
            <kbd>↑</kbd>
          </dd>
        </div>
        <div>
          <dt>Xem phím tắt</dt>
          <dd>
            <kbd>?</kbd>
          </dd>
        </div>
        <div>
          <dt>Đóng trợ giúp / thu gọn vùng đọc</dt>
          <dd>
            <kbd>Esc</kbd>
          </dd>
        </div>
      </dl>
    </dialog>
  );
}
