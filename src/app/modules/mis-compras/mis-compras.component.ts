import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ADMIN_MOCK_DATA } from './mock-admin-data';

type Trazabilidad = { glosa: string; fechaRegistro: string; estado: 'activo' | 'finalizado' };
type Compra = {
  tipoDocumento: string;
  numeroDocumento: string;
  fechaCompra: string;
  tipoEntrega: string;
  direccionEntrega: string;
  trazabilidad: Trazabilidad[];
  esDimensionado: boolean;
  total: number;
  facturasAsociadas?: Array<{ numeroFactura: string; fechaEmision: string; idFactura: number }>;
};

@Component({
  selector: 'app-mis-compras',
  templateUrl: './mis-compras.component.html',
  styleUrls: ['./mis-compras.component.scss']
})
export class MisComprasComponent implements OnInit {
  compras: Compra[] = [];
  searchTerm = '';
  showAll = false;
  searchPressed = false;
  // Paginación
  page = 1;
  perPage = 10;
  totalPages = 1;
  private asociadasOpen = new Set<string>();

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Emula la respuesta del servicio para el usuario admin
    console.log('Mock compras admin:', ADMIN_MOCK_DATA);
    this.compras = ADMIN_MOCK_DATA.compras as Compra[];
    // Cargar metadatos de paginación si vienen
    this.perPage = (ADMIN_MOCK_DATA as any).perPage || 10;
    this.page = (ADMIN_MOCK_DATA as any).page || 1;
    this.totalPages = (ADMIN_MOCK_DATA as any).totalPages || Math.max(1, Math.ceil(this.compras.length / this.perPage));
  }

  private fullFiltered(): Compra[] {
    const t = (this.searchTerm || '').trim().toLowerCase();
    return !t ? this.compras : this.compras.filter(c => c.numeroDocumento.toLowerCase().includes(t));
  }

  get filteredCompras(): Compra[] {
    const list = this.fullFiltered();
    // Paginación por 10 ítems
    const start = (this.page - 1) * this.perPage;
    return list.slice(start, start + this.perPage);
  }

  get totalFilteredCount(): number { return this.fullFiltered().length; }

  get pages(): number[] {
    const total = Math.max(1, Math.ceil(this.totalFilteredCount / this.perPage));
    this.totalPages = total;
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  get hasNoResults(): boolean {
    const typed = (this.searchTerm || '').trim().length > 0;
    return (this.searchPressed || typed) && this.totalFilteredCount === 0;
  }

  // Orden de pasos a mostrar en el stepper
  readonly pasos = [
    'Pedido ingresado',
    'Pedido pagado',
    'Preparación de pedido',
    'Disponible para retiro',
    'Pedido entregado'
  ];

  pasoActivo(compra: Compra, paso: string): boolean {
    const item = compra.trazabilidad.find(p => p.glosa.toLowerCase() === paso.toLowerCase());
    return !!item && (item.estado === 'activo' || item.estado === 'finalizado');
  }

  lastReachedIndex(compra: Compra): number {
    // Busca el índice más alto cuyo glosa exista en la trazabilidad
    let last = -1;
    const reached = new Set(compra.trazabilidad.map(t => t.glosa.toLowerCase()));
    this.pasos.forEach((p, idx) => {
      if (reached.has(p.toLowerCase())) last = idx;
    });
    return last;
  }

  verDetalle(c: Compra): void {
    // Mapear tipoDocumento a los códigos esperados por el buscador (BLV, FCV, NVV)
    const tipo = this.mapTipoDocumentoToCode(c.tipoDocumento);
    const folio = Number(c.numeroDocumento);
    // Navega al módulo de tracking con query params para que se auto-ejecute la búsqueda
    this.router.navigate(['/tracking'], {
      queryParams: {
        folioDocumento: isNaN(folio) ? c.numeroDocumento : folio,
        tipoDocumento: tipo
      },
      queryParamsHandling: 'merge'
    });
  }

  verMas(): void {
    // Con paginación, avanzar a la siguiente página si existe
    if (this.page < this.totalPages) {
      this.page += 1;
    }
  }

  buscar(): void {
    this.searchPressed = true;
    // Resetear a la primera página al buscar
    this.page = 1;
  }

  onInputChange(): void {
    // Considerar la búsqueda activa mientras se escribe
    this.searchPressed = true;
    this.page = 1;
  }

  private mapTipoDocumentoToCode(tipo: string): string {
    const t = (tipo || '').toLowerCase().trim();
    if (t.includes('boleta')) return 'BLV';
    if (t.includes('factura')) return 'FCV';
    if (t.includes('nota') && t.includes('venta')) return 'NVV';
    // Por defecto, considerar Boleta
    return 'BLV';
  }

  // Ver detalle de factura asociada (para Nota de Venta)
  verDetalleFactura(numeroFactura: string): void {
    const folio = this.tryParseFolio(numeroFactura);
    this.router.navigate(['/tracking'], {
      queryParams: {
        folioDocumento: folio,
        tipoDocumento: 'FCV'
      },
      queryParamsHandling: 'merge'
    });
  }

  private tryParseFolio(n: string): number | string {
    // Si viene con prefijos tipo "F-2001" u otros, extraer dígitos
    const digits = (n || '').match(/\d+/g)?.join('') || '';
    const num = Number(digits);
    return isNaN(num) ? n : num;
  }

  // Estado actual (último paso alcanzado) para vista móvil
  estadoActual(c: Compra): string {
    const idx = this.lastReachedIndex(c);
    return idx >= 0 ? this.pasos[idx] : this.pasos[0];
  }

  // Toggle de facturas asociadas (por documento)
  toggleAsociadas(c: Compra): void {
    const key = `${c.tipoDocumento}-${c.numeroDocumento}`;
    if (this.asociadasOpen.has(key)) {
      this.asociadasOpen.delete(key);
    } else {
      this.asociadasOpen.add(key);
    }
  }

  isAsociadasOpen(c: Compra): boolean {
    const key = `${c.tipoDocumento}-${c.numeroDocumento}`;
    return this.asociadasOpen.has(key);
  }

  // Cambiar de página
  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) {
      this.page = p;
    }
  }
}
