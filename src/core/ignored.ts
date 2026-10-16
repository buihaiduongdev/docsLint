import type { Diagnostic } from "./types";

// Engine IDs contain a changing array index; don't use them for persistent decisions.
export const diagnosticKey = (issue: Diagnostic) =>
  JSON.stringify([
    issue.ruleId,
    issue.nodeId,
    issue.severity,
    issue.message,
    issue.actual,
    issue.expected,
  ]);

export async function documentKey(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function readIgnored(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`docslint-ignored:${key}`) ?? "[]",
    );
    return new Set(
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function saveIgnored(key: string, ignored: Set<string>): boolean {
  try {
    if (ignored.size)
      localStorage.setItem(
        `docslint-ignored:${key}`,
        JSON.stringify([...ignored]),
      );
    else localStorage.removeItem(`docslint-ignored:${key}`);
    return true;
  } catch {
    return false;
  }
}
