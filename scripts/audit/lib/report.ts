export type Finding = { rule: string; file?: string | undefined; message: string };
export type Report = { name: string; violations: Finding[]; warnings: Finding[] };
export function report(name: string): Report {
  return { name, violations: [], warnings: [] };
}
function line(finding: Finding) {
  return `  ${finding.rule}${finding.file ? ` ${finding.file}` : ''}: ${finding.message}\n`;
}
export function format(result: Report) {
  let text = `${result.name}: ${result.violations.length} violation(s), ${result.warnings.length} warning(s)\n`;
  for (const finding of result.violations) text += line(finding);
  if (result.warnings.length) text += 'warnings:\n';
  for (const finding of result.warnings) text += line(finding);
  return text;
}
export function finish(result: Report) {
  process.stdout.write(format(result));
  process.exit(result.violations.length ? 1 : 0);
}
