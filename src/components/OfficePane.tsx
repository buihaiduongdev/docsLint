import { useEffect, useRef, useState } from "react";
import {
  Download,
  FilePenLine,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Save,
  RotateCcw,
} from "lucide-react";
import {
  api,
  authorization,
  officeBytes,
  type OfficeSession,
} from "../office/client";

type Editor = {
  destroyEditor(): void;
  downloadAs(options: { fileType: string }): void;
};
declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: Record<string, unknown>) => Editor;
    };
  }
}
let scriptPromise: Promise<void> | undefined;
function loadScript() {
  if (window.DocsAPI) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/office/web-apps/apps/api/documents/api.js";
      script.onload = () =>
        window.DocsAPI
          ? resolve()
          : reject(new Error("Chưa tải được trình soạn thảo."));
      script.onerror = () => {
        script.remove();
        reject(
          new Error(
            "Không tải được ONLYOFFICE. Kiểm tra dịch vụ Office rồi thử lại.",
          ),
        );
      };
      document.head.appendChild(script);
    }).catch((error) => {
      scriptPromise = undefined;
      throw error;
    });
  return scriptPromise;
}
export function OfficePane({
  session,
  expanded,
  onToggleExpanded,
  onSaved,
  onDirty,
  onBusy,
}: {
  session: OfficeSession;
  expanded: boolean;
  onToggleExpanded(): void;
  onSaved(bytes: ArrayBuffer, name: string): Promise<void>;
  onDirty(dirty: boolean): void;
  onBusy(busy: boolean): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [savedAt, setSavedAt] = useState("");
  const callbacks = useRef({ onSaved, onDirty, onBusy });
  callbacks.current = { onSaved, onDirty, onBusy };
  const epoch = useRef(0);
  const pending = useRef<{
    download: boolean;
    epoch: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    let stopped = false;
    setReady(false);
    setError("");
    setDirty(false);
    setSavedAt("");
    epoch.current = 0;
    const mount = document.createElement("div");
    mount.id = `office-${session.id}`;
    container.current!.replaceChildren(mount);
    const initialize = async () => {
      try {
        await loadScript();
        if (stopped) return;
        editor.current = new window.DocsAPI!.DocEditor(mount.id, {
          ...session.config,
          events: {
            onDocumentReady: () => {
              if (!stopped) setReady(true);
            },
            onDocumentStateChange: (event: { data: boolean }) => {
              if (!stopped && event.data) {
                epoch.current++;
                setDirty(true);
                callbacks.current.onDirty(true);
              }
            },
            onError: (event: { data: { errorDescription?: string } }) => {
              if (!stopped)
                setError(
                  event.data?.errorDescription ||
                    "Trình soạn thảo gặp lỗi. Hãy thử lại.",
                );
            },
            onDownloadAs: async (event: { data: { url: string } }) => {
              const operation = pending.current;
              if (!operation || stopped) return;
              clearTimeout(operation.timer);
              pending.current = null;
              try {
                await api(`/api/documents/${session.id}/snapshot`, {
                  method: "POST",
                  headers: {
                    ...authorization(session),
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ url: event.data.url }),
                });
                const bytes = await officeBytes(session);
                if (stopped) return;
                await callbacks.current.onSaved(bytes, session.name);
                const changed = epoch.current !== operation.epoch;
                setDirty(changed);
                callbacks.current.onDirty(changed);
                setSavedAt(
                  new Date().toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                );
                if (operation.download) {
                  const url = URL.createObjectURL(
                    new Blob([bytes], {
                      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = session.name;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
              } catch (e) {
                if (!stopped)
                  setError(
                    e instanceof Error ? e.message : "Chưa lưu được tài liệu.",
                  );
              } finally {
                if (!stopped) {
                  setSaving(false);
                  callbacks.current.onBusy(false);
                }
              }
            },
          },
        });
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "Chưa mở được trình soạn thảo.",
          );
      }
    };
    void initialize();
    return () => {
      stopped = true;
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = null;
      editor.current?.destroyEditor();
      editor.current = null;
    };
  }, [session.id, retry]);

  const save = (download: boolean) => {
    if (!editor.current || !ready || saving) return;
    setSaving(true);
    callbacks.current.onBusy(true);
    setError("");
    pending.current = {
      download,
      epoch: epoch.current,
      timer: setTimeout(() => {
        pending.current = null;
        setSaving(false);
        callbacks.current.onBusy(false);
        setError(
          "Lưu tài liệu quá lâu. Nội dung vẫn ở trình soạn thảo; hãy thử lưu lại.",
        );
      }, 60000),
    };
    editor.current.downloadAs({ fileType: "docx" });
  };
  return (
    <section
      className="panel preview-panel office-panel"
      aria-label="Trình soạn thảo tài liệu"
    >
      <div className="panel-heading office-tools">
        <h2>
          <FilePenLine size={17} /> Soạn thảo DOCX
        </h2>
        <div className="office-actions">
          <button
            className="button secondary"
            disabled={!ready || saving}
            onClick={() => save(false)}
          >
            {saving ? (
              <LoaderCircle size={14} className="spin" />
            ) : (
              <Save size={14} />
            )}{" "}
            Lưu & kiểm tra lại
          </button>
          <button
            className="button secondary"
            disabled={!ready || saving}
            onClick={() => save(true)}
          >
            <Download size={14} /> Tải DOCX
          </button>
          <button
            className="icon-button"
            aria-label={expanded ? "Thu gọn vùng đọc" : "Mở rộng vùng đọc"}
            onClick={onToggleExpanded}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      {error && (
        <div className="office-error" role="alert">
          <span>{error}</span>
          {!ready && (
            <button
              className="button secondary"
              onClick={() => setRetry((v) => v + 1)}
            >
              <RotateCcw size={14} /> Thử lại
            </button>
          )}
        </div>
      )}
      <div className="office-stage">
        {!ready && !error && (
          <div className="office-loading">
            <LoaderCircle className="spin" size={24} />
            <span>Đang mở trang tài liệu…</span>
          </div>
        )}
        <div
          ref={container}
          className="office-mount"
          data-testid="office-editor"
        />
      </div>
      <div className="panel-footer">
        <span>
          {saving
            ? "Đang lưu DOCX và cập nhật kết quả…"
            : dirty
              ? "Có thay đổi · Lưu & kiểm tra lại để cập nhật lỗi."
              : savedAt
                ? `Đã lưu và kiểm tra lúc ${savedAt}`
                : "Sửa trực tiếp trên trang · Lưu & kiểm tra lại khi hoàn tất."}
        </span>
      </div>
    </section>
  );
}
