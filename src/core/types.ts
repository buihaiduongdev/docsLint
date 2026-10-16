export type Severity = "error" | "warning";
export type RuleSetting = Severity | "off";

export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface ParagraphStyle extends TextStyle {
  alignment?: string;
  lineSpacing?: number;
  lineMode?: string;
  outlineLevel?: number;
  indent?: number;
  listId?: string;
  listLevel?: number;
}

export interface TextRun {
  text: string;
  style: TextStyle;
}

export interface Paragraph {
  id: string;
  index: number;
  text: string;
  kind: "heading" | "paragraph" | "list";
  headingLevel?: number;
  style: ParagraphStyle;
  runs: TextRun[];
  inTable: boolean;
}

export interface DocumentModel {
  name: string;
  paragraphs: Paragraph[];
  wordCount: number;
}

export interface Diagnostic {
  id: string;
  ruleId: string;
  severity: Severity;
  nodeId: string;
  message: string;
  expected: string;
  actual: string;
  suggestion: string;
}

export type RuleOptions = Record<string, string | number>;
export interface OptionDefinition {
  label: string;
  type: "text" | "number" | "select";
  default: string | number;
  min?: number;
  max?: number;
  choices?: { value: string; label: string }[];
}

export interface RuleContext {
  document: DocumentModel;
  options: RuleOptions;
  report: (issue: Omit<Diagnostic, "id" | "ruleId" | "severity">) => void;
}

export interface Rule {
  id: string;
  title: string;
  description: string;
  category: "Cấu trúc" | "Định dạng" | "Đoạn văn";
  defaultSeverity: Severity;
  options?: Record<string, OptionDefinition>;
  check(context: RuleContext): void;
}

export interface LintPlugin {
  id: string;
  name: string;
  version: string;
  apiVersion: 1;
  description: string;
  author: string;
  rules: Rule[];
}

export interface LintConfig {
  version: 1;
  plugins: Record<string, boolean>;
  rules: Record<string, { severity: RuleSetting; options: RuleOptions }>;
}
