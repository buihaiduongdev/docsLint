import { useEffect, useRef } from "react";
export function UnsavedDialog({
  onCancel,
  onContinue,
}: {
  onCancel(): void;
  onContinue(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="unsaved-dialog"
      aria-labelledby="unsaved-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="unsaved-title">Tài liệu có thay đổi chưa lưu</h2>
      <p>Chọn Quay lại để lưu và kiểm tra trước khi mở tệp khác.</p>
      <div>
        <button className="button primary" autoFocus onClick={onCancel}>
          Quay lại lưu
        </button>
        <button className="button secondary" onClick={onContinue}>
          Mở tệp khác
        </button>
      </div>
    </dialog>
  );
}
