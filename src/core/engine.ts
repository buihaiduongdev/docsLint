import type {
  Diagnostic,
  DocumentModel,
  LintConfig,
  LintPlugin,
  RuleOptions,
} from "./types";

export function createConfig(plugins: LintPlugin[]): LintConfig {
  const config: LintConfig = { version: 1, plugins: {}, rules: {} };
  for (const plugin of plugins) {
    if (plugin.apiVersion !== 1)
      throw new Error(`Plugin ${plugin.id} không tương thích API v1.`);
    if (plugin.id in config.plugins)
      throw new Error(`Trùng plugin: ${plugin.id}`);
    config.plugins[plugin.id] = true;
    for (const rule of plugin.rules) {
      const id = `${plugin.id}/${rule.id}`;
      if (id in config.rules) throw new Error(`Trùng rule: ${id}`);
      config.rules[id] = {
        severity: rule.defaultSeverity,
        options: Object.fromEntries(
          Object.entries(rule.options ?? {}).map(([key, option]) => [
            key,
            option.default,
          ]),
        ),
      };
    }
  }
  return config;
}

/** Presets are data only. Unknown plugins/rules and invalid options are rejected. */
export function parseConfig(value: unknown, plugins: LintPlugin[]): LintConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Preset phải là một JSON object.");
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new Error("Preset cần có version: 1.");
  const config = createConfig(plugins);
  if (
    !input.plugins ||
    typeof input.plugins !== "object" ||
    Array.isArray(input.plugins)
  )
    throw new Error("Preset thiếu plugins.");
  if (
    !input.rules ||
    typeof input.rules !== "object" ||
    Array.isArray(input.rules)
  )
    throw new Error("Preset thiếu rules.");
  for (const [id, enabled] of Object.entries(input.plugins)) {
    if (!Object.hasOwn(config.plugins, id))
      throw new Error(`Plugin chưa được cài: ${id}`);
    if (typeof enabled !== "boolean")
      throw new Error(`Trạng thái plugin ${id} phải là boolean.`);
    config.plugins[id] = enabled;
  }
  for (const [id, raw] of Object.entries(input.rules)) {
    if (!Object.hasOwn(config.rules, id))
      throw new Error(`Rule không tồn tại: ${id}`);
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error(`Cấu hình rule không hợp lệ: ${id}`);
    const setting = raw as Record<string, unknown>;
    if (!["off", "error", "warning"].includes(String(setting.severity)))
      throw new Error(`Mức độ không hợp lệ: ${id}`);
    if (
      !setting.options ||
      typeof setting.options !== "object" ||
      Array.isArray(setting.options)
    )
      throw new Error(`Options không hợp lệ: ${id}`);
    const rule = plugins
      .flatMap((p) => p.rules.map((r) => ({ ...r, fullId: `${p.id}/${r.id}` })))
      .find((r) => r.fullId === id)!;
    const options: RuleOptions = { ...config.rules[id].options };
    for (const [key, v] of Object.entries(setting.options)) {
      const spec = rule.options?.[key];
      if (!spec) throw new Error(`Option không tồn tại: ${id}.${key}`);
      if (spec.type === "number") {
        if (
          typeof v !== "number" ||
          !Number.isFinite(v) ||
          v < (spec.min ?? -Infinity) ||
          v > (spec.max ?? Infinity)
        )
          throw new Error(`Giá trị số không hợp lệ: ${key}`);
      } else if (
        typeof v !== "string" ||
        !v.trim() ||
        v.length > 100 ||
        (spec.choices && !spec.choices.some((c) => c.value === v))
      ) {
        throw new Error(`Giá trị không hợp lệ: ${key}`);
      }
      options[key] = v as string | number;
    }
    config.rules[id] = {
      severity: setting.severity as "off" | "error" | "warning",
      options,
    };
  }
  return config;
}

export function lint(
  document: DocumentModel,
  plugins: LintPlugin[],
  config: LintConfig,
) {
  const issues: Diagnostic[] = [];
  for (const plugin of plugins) {
    if (!config.plugins[plugin.id]) continue;
    for (const rule of plugin.rules) {
      const ruleId = `${plugin.id}/${rule.id}`;
      const setting = config.rules[ruleId];
      if (!setting || setting.severity === "off") continue;
      const severity = setting.severity;
      rule.check({
        document,
        options: setting.options,
        report: (issue) =>
          issues.push({
            ...issue,
            ruleId,
            severity,
            id: `${ruleId}:${issue.nodeId}:${issues.length}`,
          }),
      });
    }
  }
  const positions = new Map(document.paragraphs.map((p, i) => [p.id, i]));
  return issues.sort(
    (a, b) => positions.get(a.nodeId)! - positions.get(b.nodeId)!,
  );
}
