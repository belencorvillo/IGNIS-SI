// Visual vocabulary for the knowledge graph produced by backend/nube.py.
// Same three groups as the original vis-network graph, in NASA's corporate colours:
// NASA Red, NASA Blue and the silver/grey of the palette (PMS 877, approximated for screens).

export const GROUP_STYLE = {
  csv: { color: '#fc3d21', label: 'Raw data (CSV)' }, // NASA Red
  txt: { color: '#0b3d91', label: 'Raw data (TXT)' }, // NASA Blue
  tag: { color: '#a7a9ac', label: 'Taxonomy tag' }, // PMS 877 silver
}

export function nodeKind(node) {
  if (node.group === 'archivo_csv') return 'csv'
  if (node.group === 'archivo_txt') return 'txt'
  return 'tag'
}

export const isInvestigationTag = (node) => node.id.startsWith('psi:')

/** Short, human-readable label for a node. */
export function nodeLabel(node) {
  if (node.group === 'archivo_csv' || node.group === 'archivo_txt') {
    const name = node.label.replace(/\.(csv|txt)$/i, '').replace(/_/g, ' ')
    return name.length > 34 ? `${name.slice(0, 33)}…` : name
  }
  const [kind, value = ''] = node.id.split(':')
  if (kind === 'psi') return value
  return `${kind} · ${value.replace(/_/g, ' ')}`
}

/**
 * The info the original graph showed in its tooltip ("ID / Título / Resumen"
 * for files, "Etiqueta taxonómica" for tags), split into fields.
 */
export function nodeInfo(node) {
  const text = node.title ?? ''
  const field = (key) => text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? null
  const summaryAt = text.search(/^Resumen:/m)
  return {
    title: field('Título'),
    summary: summaryAt >= 0 ? text.slice(summaryAt).replace(/^Resumen:\s*/, '').trim() : null,
  }
}
