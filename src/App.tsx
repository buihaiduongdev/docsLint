import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Keyboard,
  CornerUpLeft,
  Braces,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileCheck2,
  FileText,
  Info,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Plug,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { createConfig, lint, parseConfig } from "./core/engine";
import type {
  Diagnostic,
  DocumentModel,
  LintConfig,
  Paragraph,
  RuleSetting,
} from "./core/types";
import { parseDocx } from "./parser/docx";
import { plugins } from "./plugins";
import { DocumentPane } from "./components/DocumentPane";
import { ShortcutHelp } from "./components/ShortcutHelp";

type View = "review" | "rules" | "plugins";
type Filter = "all" | "error" | "warning";
const initialConfig = () => {
  try {
    const saved = localStorage.getItem("docslint-config-v1");
    return saved
      ? parseConfig(JSON.parse(saved), plugins)
      : createConfig(plugins);
  } catch {
    return createConfig(plugins);
  }
};
const download = (filename: string, data: unknown) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function App() {
  const [view, setView] = useState<View>("review");
  const [doc, setDoc] = useState<DocumentModel | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [config, setConfig] = useState<LintConfig>(initialConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const presetInput = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const issues = useMemo(
    () => (doc ? lint(doc, plugins, config) : []),
    [doc, config],
  );
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const enabledRules = plugins.flatMap((p) =>
    config.plugins[p.id]
      ? p.rules.filter(
          (r) => config.rules[`${p.id}/${r.id}`].severity !== "off",
        )
      : [],
  ).length;
  const visible = issues.filter(
    (i) =>
      (filter === "all" || i.severity === filter) &&
      `${i.message} ${i.ruleId} ${doc?.paragraphs.find((p) => p.id === i.nodeId)?.text}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const selectedIssue = issues.find((i) => i.id === selected);
  const selectedIndex = visible.findIndex((issue) => issue.id === selected);
  const reviewing = view === "review" && !!doc;

  useEffect(() => {
    try {
      localStorage.setItem("docslint-config-v1", JSON.stringify(config));
    } catch {
      /* Storage is optional. */
    }
  }, [config]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);

  const load = async (file?: File) => {
    const token = ++operation.current;
    setLoading(true);
    setError("");
    setSelected(null);
    setFocusedNode(null);
    try {
      if (file && !file.name.toLowerCase().endsWith(".docx"))
        throw new Error(
          "Hãy chọn tệp .docx. Prototype chưa hỗ trợ .doc hoặc PDF.",
        );
      if (file && file.size > 10 * 1024 * 1024)
        throw new Error("Tệp quá lớn. Vui lòng chọn DOCX nhỏ hơn 10 MB.");
      let bytes: ArrayBuffer;
      if (file) bytes = await file.arrayBuffer();
      else {
        const response = await fetch("/sample-report.docx");
        if (!response.ok)
          throw new Error("Chưa tải được tài liệu mẫu. Hãy thử lại.");
        bytes = await response.arrayBuffer();
      }
      const parsed = parseDocx(
        new Uint8Array(bytes),
        file?.name ?? "Báo cáo nghiên cứu.docx",
      );
      if (operation.current !== token) return;
      setDoc(parsed);
      setIsSample(!file);
      setView("review");
      setFilter("all");
      setSearch("");
      setNotice(
        file
          ? "Đã kiểm tra tài liệu của bạn."
          : "Đã mở tài liệu mẫu có sẵn lỗi để thử quy tắc.",
      );
    } catch (err) {
      if (operation.current === token)
        setError(err instanceof Error ? err.message : "Không đọc được tệp.");
    } finally {
      if (operation.current === token) setLoading(false);
    }
  };

  const focusNode = (nodeId: string, issueId?: string) => {
    setSelected(issueId ?? null);
    setFocusedNode(nodeId);
    requestAnimationFrame(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      const el = document.getElementById(`doc-${nodeId}`);
      const container = el?.closest(".document-preview");
      if (el && container && window.innerWidth >= 1100) {
        container.scrollTo({
          top:
            container.scrollTop +
            el.getBoundingClientRect().top -
            container.getBoundingClientRect().top -
            container.clientHeight / 3,
          behavior,
        });
      } else {
        el?.scrollIntoView({ behavior, block: "center" });
      }
      if (!issueId) el?.focus({ preventScroll: true });
      if (issueId) {
        const card = document.getElementById(`issue-${issueId}`);
        const list = card?.closest(".issue-list");
        if (card && list) {
          const rect = card.getBoundingClientRect();
          const bounds = list.getBoundingClientRect();
          if (rect.top < bounds.top || rect.bottom > bounds.bottom)
            list.scrollTo({
              top: list.scrollTop + rect.top - bounds.top - 16,
              behavior,
            });
        }
      }
    });
  };
  const moveIssue = (direction: number) => {
    const next =
      selectedIndex < 0
        ? direction > 0
          ? 0
          : visible.length - 1
        : selectedIndex + direction;
    const issue = visible[next];
    if (issue) focusNode(issue.nodeId, issue.id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shortcutsOpen) return;
      const target = event.target as HTMLElement;
      const editing =
        target.matches("input, textarea, select") || target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        fileInput.current?.click();
        return;
      }
      if (editing) return;
      if (event.key === "?" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (view !== "review" || !doc) return;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.altKey && ["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        moveIssue(event.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (selected && !visible.some((issue) => issue.id === selected)) {
      setSelected(null);
      setFocusedNode(null);
    }
  }, [selected, visible]);

  const changeRule = (
    id: string,
    severity?: RuleSetting,
    key?: string,
    value?: string | number,
  ) => {
    setConfig((current) => ({
      ...current,
      rules: {
        ...current.rules,
        [id]: {
          severity: severity ?? current.rules[id].severity,
          options: key
            ? { ...current.rules[id].options, [key]: value! }
            : current.rules[id].options,
        },
      },
    }));
  };
  const importPreset = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("Preset vượt giới hạn 100 KB.");
      setConfig(parseConfig(JSON.parse(await file.text()), plugins));
      setError("");
      setNotice("Đã áp dụng bộ quy tắc mới.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preset không hợp lệ.");
    }
  };

  return (
    <div className={`app-shell ${reviewing ? "is-reviewing" : ""}`}>
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="sidebar">
        <button
          className="brand"
          onClick={() => setView("review")}
          aria-label="docsLint trang chính"
        >
          <span className="brand-mark">
            <FileCheck2 size={23} strokeWidth={1.8} />
          </span>
          <span>
            docs<span className="brand-light">Lint</span>
            <span className="brand-dot">.</span>
          </span>
        </button>
        <span className="brand-divider" />
        <nav aria-label="Điều hướng chính">
          <button
            className={view === "review" ? "nav-item active" : "nav-item"}
            aria-current={view === "review" ? "page" : undefined}
            onClick={() => setView("review")}
          >
            <FileCheck2 size={19} />
            Kiểm tra tài liệu
            <ChevronRight size={16} className="nav-chevron" />
          </button>
          <button
            className={view === "rules" ? "nav-item active" : "nav-item"}
            aria-current={view === "rules" ? "page" : undefined}
            onClick={() => setView("rules")}
          >
            <SlidersHorizontal size={19} />
            Bộ quy tắc<span className="nav-count">{enabledRules}</span>
          </button>
          <button
            className={view === "plugins" ? "nav-item active" : "nav-item"}
            aria-current={view === "plugins" ? "page" : undefined}
            onClick={() => setView("plugins")}
          >
            <Plug size={19} />
            Plugins
            <span className="nav-count">
              {plugins.filter((p) => config.plugins[p.id]).length}
            </span>
          </button>
        </nav>
        <div className="app-header-actions">
          <span
            className="local-badge"
            title="File được xử lý trong trình duyệt, không tải lên máy chủ"
          >
            <LockKeyhole size={14} />
            Tài liệu chỉ ở máy bạn
          </span>
          <button
            className="icon-button shortcuts-trigger"
            title="Phím tắt (?)"
            aria-label="Phím tắt"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard size={19} />
            <kbd>?</kbd>
          </button>
          <span className="version-tag">v0.1</span>
        </div>
      </header>
      <ShortcutHelp
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <div className="workspace">
        <main
          id="main-content"
          className={reviewing ? "review-main" : "overview-main"}
          tabIndex={-1}
          aria-busy={loading}
          onDragOver={(event) => {
            if (reviewing && event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setDragging(false);
          }}
          onDrop={(event) => {
            if (!reviewing) return;
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void load(file);
          }}
        >
          {reviewing && dragging && (
            <div className="drop-overlay">
              <Upload size={30} />
              <strong>Thả để kiểm tra tài liệu mới</strong>
              <span>DOCX · Tối đa 10 MB</span>
            </div>
          )}
          {!reviewing && (
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {view === "review"
                    ? "Không gian kiểm tra DOCX"
                    : view === "rules"
                      ? "Cấu hình"
                      : "Hệ sinh thái docsLint"}
                </div>
                <h1>
                  {view === "review"
                    ? "Báo cáo chỉn chu, từ từng chi tiết."
                    : view === "rules"
                      ? "Bộ quy tắc kiểm tra"
                      : "Mở rộng bằng plugin."}
                </h1>
                <p>
                  {view === "review"
                    ? "Kiểm tra cấu trúc và định dạng báo cáo bằng những quy tắc rõ ràng."
                    : view === "rules"
                      ? "Điều chỉnh chuẩn định dạng. Kết quả được cập nhật ngay khi bạn thay đổi."
                      : "Mỗi plugin bổ sung những quy tắc độc lập cho tài liệu của bạn."}
                </p>
              </div>
              {view === "review" && (
                <button
                  className="button secondary heading-action"
                  onClick={() => setView("rules")}
                >
                  <Settings2 size={16} /> Tùy chỉnh quy tắc
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="alert error-alert" role="alert">
              <CircleAlert size={19} />
              <span>{error}</span>
              <button
                aria-label="Đóng thông báo lỗi"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <CircleCheck size={17} />
              {notice}
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            aria-label="Chọn tài liệu DOCX"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void load(file);
              e.target.value = "";
            }}
          />
          <input
            ref={presetInput}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Nhập preset JSON"
            onChange={(e) => {
              void importPreset(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {view === "review" && (
            <>
              {!doc && (
                <section
                  className={`upload-card ${dragging ? "dragging" : ""}`}
                  aria-label="Tải tài liệu"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void load(file);
                  }}
                >
                  <div className="upload-icon">
                    {loading ? (
                      <LoaderCircle className="spin" size={25} />
                    ) : (
                      <Upload size={25} />
                    )}
                  </div>
                  <div className="upload-copy">
                    <h2>
                      {loading
                        ? "Đang đọc và kiểm tra tài liệu…"
                        : "Thả tài liệu vào đây để bắt đầu"}
                    </h2>
                    <p>
                      Định dạng .docx <span>•</span> Tối đa 10 MB <span>•</span>{" "}
                      Không cần đăng nhập
                    </p>
                  </div>
                  <div className="upload-actions">
                    <button
                      className="button text-button"
                      disabled={loading}
                      onClick={() => void load()}
                    >
                      <FileText size={15} />
                      Dùng tài liệu mẫu
                    </button>
                    <button
                      className="button primary"
                      disabled={loading}
                      onClick={() => fileInput.current?.click()}
                    >
                      <Plus size={18} /> Chọn tệp DOCX
                    </button>
                  </div>
                </section>
              )}

              {doc ? (
                <>
                  <div className="document-bar">
                    <div className="file-mini">
                      <FileText size={18} />
                      <strong title={doc.name}>{doc.name}</strong>
                      {isSample && (
                        <span className="sample-tag">TÀI LIỆU MẪU</span>
                      )}
                      <span className="file-meta">
                        {doc.paragraphs.length} đoạn ·{" "}
                        {doc.wordCount.toLocaleString("vi-VN")} từ
                      </span>
                    </div>
                    <div className="document-actions">
                      <button
                        className="button secondary"
                        disabled={loading}
                        onClick={() => fileInput.current?.click()}
                      >
                        {loading ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <Upload size={15} />
                        )}
                        Đổi tài liệu
                      </button>
                      <button
                        className="button primary export"
                        onClick={() =>
                          download(
                            `${doc.name.replace(/\.docx$/i, "")}-lint.json`,
                            { document: doc.name, config, issues },
                          )
                        }
                      >
                        <ArrowDownToLine size={15} /> Xuất kết quả
                      </button>
                    </div>
                  </div>
                  <section
                    className="stats-grid"
                    aria-label="Tổng quan kết quả"
                  >
                    <div className="stat-card">
                      <div className="stat-icon neutral">
                        <ListChecks size={21} />
                      </div>
                      <div>
                        <span>Tổng vấn đề</span>
                        <strong>
                          {issues.length}
                          <small>cần rà soát</small>
                        </strong>
                      </div>
                      <span className="stat-decoration">/</span>
                    </div>
                    <button
                      className={`stat-card clickable ${filter === "error" ? "stat-active" : ""}`}
                      onClick={() =>
                        setFilter(filter === "error" ? "all" : "error")
                      }
                    >
                      <div className="stat-icon danger">
                        <CircleAlert size={21} />
                      </div>
                      <div>
                        <span>Lỗi cần sửa</span>
                        <strong>
                          {errors}
                          <small>cần chỉnh sửa</small>
                        </strong>
                      </div>
                    </button>
                    <button
                      className={`stat-card clickable ${filter === "warning" ? "stat-active" : ""}`}
                      onClick={() =>
                        setFilter(filter === "warning" ? "all" : "warning")
                      }
                    >
                      <div className="stat-icon warning">
                        <Info size={21} />
                      </div>
                      <div>
                        <span>Cảnh báo</span>
                        <strong>
                          {warnings}
                          <small>nên kiểm tra</small>
                        </strong>
                      </div>
                    </button>
                    <button
                      className="stat-card clickable"
                      onClick={() => setView("rules")}
                    >
                      <div className="stat-icon success">
                        <ShieldCheck size={21} />
                      </div>
                      <div>
                        <span>Quy tắc đang bật</span>
                        <strong>
                          {enabledRules}
                          <small>
                            từ{" "}
                            {plugins.filter((p) => config.plugins[p.id]).length}{" "}
                            plugins
                          </small>
                        </strong>
                      </div>
                      <ArrowRight size={15} className="stat-arrow" />
                    </button>
                  </section>
                  <div className="review-grid">
                    <DocumentPane
                      doc={doc}
                      issue={selectedIssue}
                      focusedNode={focusedNode}
                      onFocus={(nodeId) => focusNode(nodeId)}
                    />
                    <section className="panel issues-panel">
                      <div className="panel-heading">
                        <h2>
                          <ListChecks size={18} />
                          Kết quả kiểm tra{" "}
                          <span className="count-pill">{issues.length}</span>
                        </h2>
                        <span className="live-indicator">
                          <i /> Đã cập nhật
                        </span>
                      </div>
                      <div className="issue-toolbar">
                        <div
                          className="filter-tabs"
                          role="group"
                          aria-label="Lọc mức độ"
                        >
                          {(["all", "error", "warning"] as const).map((f) => (
                            <button
                              key={f}
                              className={filter === f ? "selected" : ""}
                              aria-pressed={filter === f}
                              onClick={() => setFilter(f)}
                            >
                              {f === "all"
                                ? "Tất cả"
                                : f === "error"
                                  ? "Lỗi"
                                  : "Cảnh báo"}
                              <span>
                                {f === "all"
                                  ? issues.length
                                  : f === "error"
                                    ? errors
                                    : warnings}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="search-box">
                          <Search size={15} />
                          <input
                            ref={searchInput}
                            aria-label="Tìm lỗi"
                            placeholder="Tìm lỗi, quy tắc…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                          {!search && <kbd>/</kbd>}
                          {search && (
                            <button
                              aria-label="Xóa tìm kiếm"
                              onClick={() => setSearch("")}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        className="issue-list"
                        tabIndex={0}
                        aria-label="Danh sách lỗi"
                      >
                        {visible.map((issue) => (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            paragraph={doc.paragraphs.find(
                              (p) => p.id === issue.nodeId,
                            )!}
                            active={selected === issue.id}
                            onClick={() => focusNode(issue.nodeId, issue.id)}
                          />
                        ))}
                        {!visible.length && (
                          <div className="empty-results">
                            <CircleCheck size={36} />
                            <h3>
                              {issues.length
                                ? "Không có kết quả phù hợp"
                                : enabledRules
                                  ? "Không phát hiện vấn đề"
                                  : "Chưa bật quy tắc nào"}
                            </h3>
                            <p>
                              {issues.length
                                ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
                                : enabledRules
                                  ? "Tài liệu phù hợp với các quy tắc đã bật trên dữ liệu đọc được."
                                  : "Bật plugin hoặc quy tắc để kiểm tra tài liệu."}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="panel-footer issue-navigation">
                        <span>
                          {visible.length
                            ? selectedIndex < 0
                              ? `${visible.length} vấn đề · Chọn để xem`
                              : `${selectedIndex + 1} / ${visible.length} vấn đề`
                            : "Không có vấn đề"}
                        </span>
                        <span className="navigation-hint">Alt + ↑ / ↓</span>
                        <button
                          className="icon-button"
                          aria-label="Lỗi trước"
                          title="Lỗi trước (Alt + ↑)"
                          disabled={!visible.length || selectedIndex === 0}
                          onClick={() => moveIssue(-1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Lỗi tiếp theo"
                          title="Lỗi tiếp theo (Alt + ↓)"
                          disabled={
                            !visible.length ||
                            selectedIndex === visible.length - 1
                          }
                          onClick={() => moveIssue(1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <div className="review-statusbar">
                    <span>
                      <CircleCheck size={13} />
                      Đã kiểm tra · {enabledRules} quy tắc
                    </span>
                    <span>
                      Chỉ kiểm tra dữ liệu đọc được · Chưa kiểm tra bố cục trang
                    </span>
                    <button onClick={() => setView("rules")}>
                      <Settings2 size={13} />
                      Tùy chỉnh quy tắc
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <section className="welcome-panel">
                  <div className="welcome-visual">
                    <div className="mini-paper">
                      <div className="mini-line title" />
                      <div className="mini-line" />
                      <div className="mini-line short" />
                      <div className="mini-highlight">
                        <span />
                        <Check size={14} />
                      </div>
                      <div className="mini-line" />
                      <div className="mini-line short" />
                    </div>
                    <span className="floating-check">
                      <CheckCheck size={24} />
                    </span>
                  </div>
                  <div className="welcome-copy">
                    <span className="eyebrow">
                      ÍT SỬA VẶT. NHIỀU TẬP TRUNG HƠN.
                    </span>
                    <h2>
                      Một lượt kiểm tra,
                      <br />
                      bản báo cáo chỉn chu hơn.
                    </h2>
                    <p>
                      Tìm nhanh tiêu đề nhảy cấp, font chữ không đồng nhất và
                      những đoạn văn chưa đúng chuẩn.
                    </p>
                    <button
                      className="button primary"
                      disabled={loading}
                      onClick={() => void load()}
                    >
                      Khám phá với tài liệu mẫu <ArrowRight size={16} />
                    </button>
                    <span className="sample-hint">
                      Tài liệu mẫu có sẵn lỗi để bạn thử ngay.
                    </span>
                  </div>
                  <div className="welcome-features">
                    <div>
                      <Braces size={19} />
                      <span>
                        <strong>Quy tắc minh bạch</strong>
                        <small>Biết rõ vì sao cần sửa</small>
                      </span>
                    </div>
                    <div>
                      <Plug size={19} />
                      <span>
                        <strong>Linh hoạt với plugin</strong>
                        <small>Tùy chỉnh theo chuẩn của bạn</small>
                      </span>
                    </div>
                    <div>
                      <LockKeyhole size={19} />
                      <span>
                        <strong>Riêng tư từ đầu</strong>
                        <small>Không lưu nội dung tài liệu</small>
                      </span>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {view === "rules" && (
            <>
              {doc && (
                <button
                  className="back-to-document"
                  onClick={() => setView("review")}
                >
                  <CornerUpLeft size={15} />
                  Quay lại {doc.name}
                </button>
              )}
              <div className="config-toolbar">
                <span>
                  <span className="preset-dot" /> Bộ chuẩn báo cáo{" "}
                  <span className="subtle">· Có thể tùy chỉnh</span>
                </span>
                <div>
                  <button
                    className="button secondary"
                    onClick={() => presetInput.current?.click()}
                  >
                    <Upload size={15} />
                    Nhập JSON
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => download("docslint-preset.json", config)}
                  >
                    <ArrowDownToLine size={15} />
                    Xuất JSON
                  </button>
                  <button
                    className="button icon-button secondary"
                    title="Khôi phục mặc định"
                    aria-label="Khôi phục mặc định"
                    onClick={() => {
                      setConfig(createConfig(plugins));
                      setNotice("Đã khôi phục bộ quy tắc mặc định.");
                    }}
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              <div className="rules-list">
                {plugins.map((plugin) => (
                  <section className="panel rule-group" key={plugin.id}>
                    <div className="panel-heading">
                      <h2>
                        <Plug size={18} />
                        {plugin.name}
                        <span className="count-pill">
                          {plugin.rules.length} rules
                        </span>
                      </h2>
                      <span
                        className={
                          config.plugins[plugin.id] ? "enabled-label" : "subtle"
                        }
                      >
                        {config.plugins[plugin.id]
                          ? "Đang bật"
                          : "Plugin đã tắt"}
                      </span>
                    </div>
                    {plugin.rules.map((rule) => {
                      const id = `${plugin.id}/${rule.id}`;
                      const setting = config.rules[id];
                      return (
                        <div
                          className={`rule-row ${!config.plugins[plugin.id] || setting.severity === "off" ? "disabled-rule" : ""}`}
                          key={id}
                        >
                          <div className="rule-info">
                            <h3>
                              {rule.title}
                              <span>{rule.category}</span>
                            </h3>
                            <code>{id}</code>
                            <p>{rule.description}</p>
                          </div>
                          <div className="rule-controls">
                            {Object.entries(rule.options ?? {}).map(
                              ([key, option]) => (
                                <label key={key}>
                                  {option.label}
                                  {option.type === "select" ? (
                                    <select
                                      aria-label={option.label}
                                      value={setting.options[key]}
                                      disabled={
                                        !config.plugins[plugin.id] ||
                                        setting.severity === "off"
                                      }
                                      onChange={(e) =>
                                        changeRule(
                                          id,
                                          undefined,
                                          key,
                                          e.target.value,
                                        )
                                      }
                                    >
                                      {option.choices?.map((c) => (
                                        <option value={c.value} key={c.value}>
                                          {c.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      aria-label={option.label}
                                      key={`${id}-${setting.options[key]}`}
                                      type={
                                        option.type === "number"
                                          ? "number"
                                          : "text"
                                      }
                                      min={option.min}
                                      max={option.max}
                                      step={
                                        option.type === "number"
                                          ? "0.5"
                                          : undefined
                                      }
                                      maxLength={100}
                                      defaultValue={setting.options[key]}
                                      disabled={
                                        !config.plugins[plugin.id] ||
                                        setting.severity === "off"
                                      }
                                      onBlur={(e) => {
                                        const raw = e.target.value.trim();
                                        const value =
                                          option.type === "number"
                                            ? Number(raw)
                                            : raw;
                                        if (
                                          !raw ||
                                          (typeof value === "number" &&
                                            (!Number.isFinite(value) ||
                                              value <
                                                (option.min ?? -Infinity) ||
                                              value > (option.max ?? Infinity)))
                                        ) {
                                          e.target.value = String(
                                            setting.options[key],
                                          );
                                          setNotice(
                                            "Giá trị không hợp lệ; đã giữ giá trị trước đó.",
                                          );
                                          return;
                                        }
                                        changeRule(id, undefined, key, value);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          e.currentTarget.blur();
                                      }}
                                    />
                                  )}
                                </label>
                              ),
                            )}
                            <label>
                              Mức độ
                              <select
                                aria-label={`Mức độ ${rule.title}`}
                                disabled={!config.plugins[plugin.id]}
                                value={setting.severity}
                                onChange={(e) =>
                                  changeRule(id, e.target.value as RuleSetting)
                                }
                              >
                                <option value="error">Lỗi</option>
                                <option value="warning">Cảnh báo</option>
                                <option value="off">Tắt</option>
                              </select>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
              <p className="scope-note">
                <Info size={14} />
                Cấu hình được lưu trên trình duyệt này. Preset JSON có thể chia
                sẻ; không chứa nội dung tài liệu.
              </p>
            </>
          )}

          {view === "plugins" && (
            <>
              <div className="plugin-banner">
                <div className="plugin-banner-icon">
                  <Plug size={27} />
                </div>
                <div>
                  <h2>Mỗi chuẩn trình bày, một bộ quy tắc.</h2>
                  <p>
                    Bật plugin đã cài, hoặc viết thêm rule TypeScript qua API
                    chung của docsLint.
                  </p>
                </div>
                <span className="api-badge">PLUGIN API v1</span>
              </div>
              <div className="plugin-grid">
                {plugins.map((plugin) => (
                  <article className="panel plugin-card" key={plugin.id}>
                    <div className="plugin-card-top">
                      <div className={`plugin-logo ${plugin.id}`}>
                        <Braces size={26} />
                      </div>
                      <button
                        role="switch"
                        aria-checked={config.plugins[plugin.id]}
                        aria-label={`Bật plugin ${plugin.name}`}
                        className={`toggle ${config.plugins[plugin.id] ? "on" : ""}`}
                        onClick={() =>
                          setConfig((c) => ({
                            ...c,
                            plugins: {
                              ...c.plugins,
                              [plugin.id]: !c.plugins[plugin.id],
                            },
                          }))
                        }
                      >
                        <span />
                      </button>
                    </div>
                    <h2>
                      {plugin.name}
                      <span>v{plugin.version}</span>
                    </h2>
                    <p>{plugin.description}</p>
                    <div className="plugin-chips">
                      {[...new Set(plugin.rules.map((r) => r.category))].map(
                        (c) => (
                          <span key={c}>{c}</span>
                        ),
                      )}
                    </div>
                    <div className="plugin-card-bottom">
                      <span>
                        {plugin.author} <span>·</span> {plugin.rules.length}{" "}
                        rules
                      </span>
                      <button onClick={() => setView("rules")}>
                        Xem quy tắc <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <section className="panel developer-panel">
                <div>
                  <span className="eyebrow">DÀNH CHO NGƯỜI VIẾT PLUGIN</span>
                  <h2>Thêm rule, giữ nguyên core.</h2>
                  <p>
                    Tạo plugin trong <code>src/plugins/</code>, đăng ký tại{" "}
                    <code>index.ts</code>. Rule nhận Document Model đã chuẩn hóa
                    và trả về lỗi có vị trí.
                  </p>
                  <p className="subtle">
                    Prototype chạy các plugin được đóng gói cùng app. Preset
                    JSON chỉ cấu hình các rule đã cài.
                  </p>
                  <a
                    href="/plugin-guide.md"
                    target="_blank"
                    rel="noreferrer"
                    className="button secondary"
                  >
                    Đọc hướng dẫn plugin <ArrowRight size={15} />
                  </a>
                </div>
                <pre>
                  <code>{`export const myPlugin = {
  id: 'my-school',
  apiVersion: 1,
  rules: [{
    id: 'my-rule',
    check({ document, report }) {
      // Kiểm tra → trả lỗi có vị trí
    }
  }]
}`}</code>
                </pre>
              </section>
            </>
          )}
          {!reviewing && (
            <footer className="main-footer">
              <span>
                docsLint <span>—</span> Một chút gọn gàng cho tài liệu của bạn.
              </span>
              <span>Được kiểm tra bằng quy tắc, không dùng AI.</span>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  paragraph,
  active,
  onClick,
}: {
  issue: Diagnostic;
  paragraph: Paragraph;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`issue-card ${active ? "active" : ""}`}
      id={`issue-${issue.id}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className={`issue-status ${issue.severity}`}>
        {issue.severity === "error" ? (
          <CircleAlert size={17} />
        ) : (
          <Info size={17} />
        )}
      </div>
      <div className="issue-body">
        <div className="issue-title">
          <h3>{issue.message}</h3>
          <span className={`severity ${issue.severity}`}>
            {issue.severity === "error" ? "Lỗi" : "Cảnh báo"}
          </span>
        </div>
        <div className="issue-location">
          Đoạn {paragraph.index + 1}
          {paragraph.inTable ? " · Trong bảng" : ""}
          <span>·</span>
          <code>
            {issue.ruleId.replace("standard/", "").replace("academic/", "")}
          </code>
        </div>
        <p className="issue-excerpt">“{paragraph.text}”</p>
        <div className="comparison">
          <span>
            <span className="comparison-label">Thực tế</span>
            {issue.actual}
          </span>
          <ArrowRight size={13} />
          <span className="expected">
            <span className="comparison-label">Yêu cầu</span>
            {issue.expected}
          </span>
        </div>
        {active && (
          <div className="suggestion">
            <span>Gợi ý sửa</span>
            {issue.suggestion}
          </div>
        )}
      </div>
      <ChevronRight className="issue-arrow" size={16} />
    </button>
  );
}

export default App;
