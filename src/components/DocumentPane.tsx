import { useState } from "react";
import {
  AlignLeft,
  ChevronDown,
  CircleAlert,
  FileText,
  Info,
  Minus,
  Plus,
} from "lucide-react";
import type { Diagnostic, DocumentModel } from "../core/types";

export function DocumentPane({
  doc,
  issue,
  focusedNode,
  onFocus,
}: {
  doc: DocumentModel;
  issue?: Diagnostic;
  focusedNode: string | null;
  onFocus: (nodeId: string) => void;
}) {
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const headings = doc.paragraphs.filter((p) => p.kind === "heading");
  const levels = [90, 100, 110, 125];
  const activeNode = issue?.nodeId ?? focusedNode;

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
            disabled={zoom === 90}
            onClick={() => setZoom(levels[levels.indexOf(zoom) - 1])}
          >
            <Minus size={15} />
          </button>
          <label className="zoom-select">
            <select
              aria-label="Thu phóng tài liệu"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
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
            disabled={zoom === 125}
            onClick={() => setZoom(levels[levels.indexOf(zoom) + 1])}
          >
            <Plus size={15} />
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
          data-zoom={zoom}
          tabIndex={0}
          aria-label="Văn bản tài liệu"
        >
          <div className="paper">
            <div className="paper-overline">
              {doc.name.replace(/\.docx$/i, "")}
            </div>
            {doc.paragraphs
              .filter((p) => p.text.trim())
              .map((p) => (
                <div
                  key={p.id}
                  id={`doc-${p.id}`}
                  tabIndex={-1}
                  data-testid={`paragraph-${p.index}`}
                  className={`doc-paragraph ${p.kind === "heading" ? "doc-heading" : ""} ${p.kind === "list" ? "doc-list" : ""} ${activeNode === p.id ? "highlighted" : ""}`}
                  data-heading-level={p.headingLevel}
                >
                  <span className="paragraph-number" aria-hidden="true">
                    {String(p.index + 1).padStart(2, "0")}
                  </span>
                  {p.kind === "list" && <span aria-hidden="true">• </span>}
                  {p.text}
                  {issue?.nodeId === p.id && (
                    <span className={`paragraph-flag ${issue.severity}`}>
                      <CircleAlert size={12} />
                      {issue.actual}
                    </span>
                  )}
                </div>
              ))}
            <div className="paper-end">
              <span />
              Hết nội dung
              <span />
            </div>
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <Info size={14} />
        <span>Bản đọc trích xuất · Bố cục có thể khác tài liệu Word.</span>
      </div>
    </section>
  );
}
