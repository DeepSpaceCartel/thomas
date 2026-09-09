export function isResourceReference(value: string): boolean {
  return value.startsWith('<') && value.endsWith('>');
}
