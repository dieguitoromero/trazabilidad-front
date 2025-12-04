// Central helper to normalize tracking step glosas across views
export function normalizeGlosa(raw: string): string {
  if (!raw) return '';
  const base = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const map: Record<string,string> = {
    'pedido ingresado': 'pedido ingresado',
    'pedido pagado': 'pedido pagado',
    'pedido aprobado': 'pedido pagado',
    'preparacion de pedido': 'preparacion de pedido',
    'preparación de pedido': 'preparacion de pedido',
    'pendiente de envio': 'pendiente de envio',
    'pendiente de envío': 'pendiente de envio',
    'pedido en ruta': 'pedido en ruta',
    'disponible para retiro': 'disponible para retiro',
    'pedido entregado': 'pedido entregado'
  };
  return map[base] || raw;
}
