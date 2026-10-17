import { createApp } from "./app.mjs";
import { officeEnv } from "../scripts/office-env.mjs";
const secret = process.env.JWT_SECRET || (await officeEnv());
const server = await createApp({
  secret,
  dataDir: process.env.DATA_DIR || ".local/documents",
  officeUrl: process.env.ONLYOFFICE_URL || "http://127.0.0.1:8082",
  internalUrl:
    process.env.APP_INTERNAL_URL || "http://host.docker.internal:3001",
});
const port = Number(process.env.PORT || 3001);
server.listen(port, "0.0.0.0", () =>
  console.log(`docsLint API listening on port ${port}`),
);
