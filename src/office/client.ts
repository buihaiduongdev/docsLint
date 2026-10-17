export interface OfficeSession {
  id: string;
  access: string;
  name: string;
  revision: number;
  config: Record<string, unknown>;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error(
      "Không kết nối được dịch vụ docsLint. Hãy chạy npm run dev.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "Dịch vụ docsLint chưa sẵn sàng.");
  }
  return response.json();
}
export const authorization = (session: OfficeSession) => ({
  Authorization: `Bearer ${session.access}`,
});
export async function createOfficeSession(source: ArrayBuffer, name: string) {
  const health = await api<{ officeReady: boolean }>("/api/health");
  if (!health.officeReady)
    throw new Error(
      "Trình soạn thảo đang tắt hoặc khởi động. Chạy npm run office:up, chờ khởi động rồi mở lại tài liệu.",
    );
  const session = await api<OfficeSession>("/api/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Document-Name": encodeURIComponent(name),
    },
    body: source,
  });
  rememberSession(session);
  return session;
}
export function rememberSession(session: OfficeSession) {
  try {
    localStorage.setItem(
      "docslint-office-session",
      JSON.stringify({ id: session.id, access: session.access }),
    );
  } catch {
    /* Session remains usable. */
  }
}
export async function resumeOfficeSession() {
  const saved = JSON.parse(
    localStorage.getItem("docslint-office-session") || "null",
  );
  if (!saved?.id || !saved?.access) throw new Error("Chưa có tài liệu đã lưu.");
  return api<OfficeSession>(`/api/documents/${saved.id}/reopen`, {
    method: "POST",
    headers: authorization(saved),
  });
}
export async function officeBytes(session: OfficeSession) {
  const response = await fetch(`/api/documents/${session.id}/download`, {
    headers: authorization(session),
  });
  if (!response.ok) throw new Error("Không tải được bản DOCX đã lưu.");
  return response.arrayBuffer();
}
