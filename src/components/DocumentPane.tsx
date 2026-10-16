import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  ChevronDown,
  CircleAlert,
  FileText,
  Info,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { Diagnostic, DocumentModel } from "../core/types";
import { preparePreview } from "../parser/preview";

export function DocumentPane({
  doc,
  source,
  issue,
  focusedNode,
  onFocus,
  expanded,
  onToggleExpanded,
}: {
  doc: DocumentModel;
  source: ArrayBuffer;
  issue?: Diagnostic;
  focusedNode: string | null;
  onFocus: (nodeId: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [zoom, setZoom] = useState("fit");
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState("");
  const [version, setVersion] = useState(0);
  const [retry, setRetry] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const headings = doc.paragraphs.filter((p) => p.kind === "heading");
  const levels = [75, 90, 100, 110, 125, 150];
  const activeNode = issue?.nodeId ?? focusedNode;

  useEffect(() => {
    let cancelled = false;
    const root =
      host.current!.shadowRoot ?? host.current!.attachShadow({ mode: "open" });
    const styles = document.createElement("div");
    const content = document.createElement("div");
    const chrome = document.createElement("style");
    // Isolate document styles from the application, retaining the source fonts and layout.
    chrome.textContent = `
      :host { display: block; font-family: "Times New Roman", serif; font-size: 12pt; color: black; }
      .docx-wrapper { padding: 0; background: transparent; gap: 16px; }
      .docx-wrapper > section.docx { margin: 0; box-shadow: 0 1px 5px #25361b15; }
      [data-testid].highlighted { outline: 2px solid #c7a544; outline-offset: 3px; box-shadow: -6px 0 0 #c7a544; }
      [data-testid]:focus-visible { outline: 2px solid #71974d; outline-offset: 3px; }
    `;
    root.replaceChildren(styles, content, chrome);
    setLoading(true);
    setRenderError("");
    const render = async () => {
      try {
        const prepared = preparePreview(new Uint8Array(source));
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        await renderAsync(prepared.data, content, styles, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderChanges: false,
          renderAltChunks: false,
          useBase64URL: true,
        });
        if (cancelled) return;
        for (const [bookmark, nodeId] of prepared.bookmarks) {
          const element = root.getElementById(bookmark)?.closest("p");
          if (!element) continue;
          element.id = `doc-${nodeId}`;
          element.dataset.testid = `paragraph-${nodeId.slice(2)}`;
          element.tabIndex = -1;
        }
        for (const link of root.querySelectorAll<HTMLAnchorElement>(
          "a[href]",
        )) {
          const href = link.getAttribute("href") ?? "";
          if (!/^(https?:|mailto:|#)/i.test(href)) link.removeAttribute("href");
          else if (!href.startsWith("#")) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        }
        setVersion((v) => v + 1);
      } catch (error) {
        if (!cancelled)
          setRenderError(
            error instanceof Error
              ? error.message
              : "Không thể dựng bản xem DOCX.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [source, retry]);

  useEffect(() => {
    if (loading || renderError) return;
    const view = viewport.current!;
    const element = host.current!;
    const resize = () => {
      const pages =
        element.shadowRoot?.querySelectorAll<HTMLElement>("section.docx");
      const nativeWidth = Math.max(
        1,
        ...Array.from(
          pages ?? [],
          (page) => parseFloat(getComputedStyle(page).width) || 794,
        ),
      );
      const available = Math.max(100, view.clientWidth - 24);
      const scale =
        zoom === "fit" ? available / nativeWidth : Number(zoom) / 100;
      element.style.width = `${nativeWidth}px`;
      element.style.zoom = String(scale);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(view);
    return () => observer.disconnect();
  }, [zoom, loading, renderError, version]);

  useEffect(() => {
    const root = host.current?.shadowRoot;
    root
      ?.querySelectorAll(".highlighted")
      .forEach((el) => el.classList.remove("highlighted"));
    const element = activeNode
      ? root?.getElementById(`doc-${activeNode}`)
      : null;
    if (!element || !viewport.current) return;
    element.classList.add("highlighted");
    const view = viewport.current;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    view.scrollTo({
      top:
        view.scrollTop +
        element.getBoundingClientRect().top -
        view.getBoundingClientRect().top -
        view.clientHeight / 3,
      behavior,
    });
  }, [activeNode, issue?.id, version, loading]);

  const changeZoom = (direction: number) => {
    const current =
      zoom === "fit"
        ? Number(host.current?.style.zoom || 1) * 100
        : Number(zoom);
    const next =
      direction > 0
        ? (levels.find((level) => level > current + 1) ?? 150)
        : ([...levels].reverse().find((level) => level < current - 1) ?? 75);
    setZoom(String(next));
  };

  return (
    <section className="panel preview-panel" aria-label="Bản đọc tài liệu">
      <div className="panel-heading document-tools">
        <div className="document-tools-left">
          <button
            className="icon-button"
            aria-label="Mục lục tài liệu"
            title="Mục lục tài liệu"
            aria-expanded={outlineOpen}
            aria-controls="document-outline"
            onClick={() => setOutlineOpen((v) => !v)}
          >
            <AlignLeft size={18} />
          </button>
          <span className="toolbar-divider" />
          <h2>
            <FileText size={16} />
            Nội dung tài liệu
          </h2>
        </div>
        <div className="zoom-controls" aria-label="Điều khiển thu phóng">
          <button
            className="icon-button"
            aria-label="Thu nhỏ"
            title="Thu nhỏ"
            disabled={zoom === "75"}
            onClick={() => changeZoom(-1)}
          >
            <Minus size={15} />
          </button>
          <label className="zoom-select">
            <select
              aria-label="Thu phóng tài liệu"
              value={zoom}
              onChange={(e) => setZoom(e.target.value)}
            >
              <option value="fit">Vừa chiều rộng</option>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}%
                </option>
              ))}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>
          <button
            className="icon-button"
            aria-label="Phóng to"
            title="Phóng to"
            disabled={zoom === "150"}
            onClick={() => changeZoom(1)}
          >
            <Plus size={15} />
          </button>
          <span className="toolbar-divider" />
          <button
            className="icon-button"
            aria-label={expanded ? "Thu gọn vùng đọc" : "Mở rộng vùng đọc"}
            title={expanded ? "Thu gọn vùng đọc (Esc)" : "Mở rộng vùng đọc"}
            aria-pressed={expanded}
            onClick={onToggleExpanded}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      <div className={`document-body ${outlineOpen ? "with-outline" : ""}`}>
        {outlineOpen && (
          <aside
            className="document-outline"
            id="document-outline"
            aria-label="Danh sách tiêu đề"
          >
            <div className="outline-heading">
              Mục lục <span>{headings.length}</span>
            </div>
            {headings.length ? (
              headings.map((p) => (
                <button
                  key={p.id}
                  data-level={Math.min(p.headingLevel ?? 1, 3)}
                  className={activeNode === p.id ? "selected" : ""}
                  aria-current={activeNode === p.id ? "location" : undefined}
                  onClick={() => onFocus(p.id)}
                >
                  {p.text}
                </button>
              ))
            ) : (
              <p>Chưa tìm thấy heading trong tài liệu.</p>
            )}
          </aside>
        )}
        <div
          className="document-preview"
          ref={viewport}
          data-zoom={zoom}
          tabIndex={0}
          aria-label="Văn bản tài liệu"
          aria-busy={loading}
        >
          {loading && (
            <div className="preview-loading">
              <LoaderCircle size={24} className="spin" />
              <span>Đang dựng tài liệu có định dạng…</span>
            </div>
          )}
          {renderError && (
            <div className="preview-error" role="alert">
              <CircleAlert size={25} />
              <h3>Chưa hiển thị được tài liệu</h3>
              <p>{renderError}</p>
              <button
                className="button secondary"
                onClick={() => setRetry((v) => v + 1)}
              >
                <RotateCcw size={15} />
                Thử lại
              </button>
            </div>
          )}
          <div
            className="docx-render-host"
            ref={host}
            hidden={loading || !!renderError}
          />
        </div>
      </div>
      <div className="panel-footer">
        <Info size={14} />
        <span>
          Giữ định dạng DOCX · Bố cục có thể khác Word, nhất là khi máy thiếu
          font.
        </span>
      </div>
    </section>
  );
}
