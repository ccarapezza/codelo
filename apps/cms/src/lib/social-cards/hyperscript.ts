// Mini "hyperscript" para construir el árbol que espera satori sin JSX.
// h('div', { style }, ...children) -> { type, props: { style, children } }
export interface SatoriNode {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
}

export function h(
  type: string,
  props: Record<string, unknown> = {},
  ...children: unknown[]
): SatoriNode {
  const flat = (children.flat(Infinity) as unknown[]).filter(
    (c) => c !== null && c !== undefined && c !== false && c !== "",
  );
  let kids: unknown;
  if (flat.length === 0) kids = undefined;
  else if (flat.length === 1) kids = flat[0];
  else kids = flat;
  return { type, props: { ...props, children: kids } };
}
