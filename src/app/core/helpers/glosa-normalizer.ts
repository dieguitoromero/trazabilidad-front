// Central helper to normalize tracking step glosas across views
export function normalizeGlosa(raw: string): string {
  if (!raw) return '';
  const base = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const map: Record<string,string> = {
    'pedido ingresado': 'Pedido ingresado',
    'pedido pagado': 'Pedido pagado',
    'pedido aprobado': 'Pedido pagado',
    'preparacion de pedido': 'Preparación de pedido',
    'preparación de pedido': 'Preparación de pedido',
    'disponible para retiro': 'Disponible para retiro',
    'pedido entregado': 'Pedido entregado',
    'pedido en ruta': 'Preparación de pedido' // provisional mapping; adjust if business rules differ
  };
  return map[base] || raw;
}
