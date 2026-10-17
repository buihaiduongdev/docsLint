import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export async function officeEnv() {
  await mkdir(".local", { recursive: true });
  const path = ".local/office.env";
  try {
    await writeFile(path, `JWT_SECRET=${randomBytes(48).toString("hex")}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const value = (await readFile(path, "utf8")).match(/^JWT_SECRET=(.+)$/m)?.[1];
  if (!value) throw new Error("Thiếu JWT_SECRET trong .local/office.env");
  return value;
}
