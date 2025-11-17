import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ADMIN_MOCK_DATA } from './mock-admin-data';
import { MisComprasService, MisComprasResponseDto } from '../../services/mis-compras.service';
import { environment } from '../../../environments/environment';

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

  loading = false;
  error = false;

  constructor(private router: Router, private misComprasService: MisComprasService) {}

  ngOnInit(): void {
    this.fetchComprasReal();
  }

  private fetchComprasReal(): void {
    this.loading = true;
    const rutPrueba = '762530058';
    this.misComprasService.getCompras(rutPrueba).subscribe({
      next: (resp: MisComprasResponseDto) => {
        const hasData = !!resp.compras && resp.compras.length > 0;
        if (hasData || !environment.useMockOnEmpty) {
          // Usar siempre la respuesta real; si viene vacía y no queremos mock, mostrar vacío
          this.compras = (resp.compras || []) as Compra[];
          this.perPage = resp.perPage || 10;
          this.page = resp.page || 1;
          const base = this.compras.length || 1;
          this.totalPages = resp.totalPages || Math.max(1, Math.ceil(base / this.perPage));
          this.error = false;
        } else {
          // Fallback a mock sólo si está permitido en env
          this.applyMock();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('[MisComprasComponent] Error API, usando mock', err);
        this.error = true;
        if (environment.useMockOnEmpty) {
          this.applyMock();
        } else {
          // Mantener vacío si no se permite mock
          this.compras = [];
          this.totalPages = 1;
        }
        this.loading = false;
      }
    });
  }

  private applyMock(): void {
    this.compras = ADMIN_MOCK_DATA.compras as Compra[];
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
    let last = -1;
    const reached = new Set(compra.trazabilidad.map(t => t.glosa.toLowerCase()));
    this.pasos.forEach((p, idx) => {
      if (reached.has(p.toLowerCase())) last = idx;
    });
    return last;
  }

  verDetalle(c: Compra): void {
    const tipo = this.mapTipoDocumentoToCode(c.tipoDocumento);
    const folio = Number(c.numeroDocumento);
    this.router.navigate(['/tracking'], {
      queryParams: {
        folioDocumento: isNaN(folio) ? c.numeroDocumento : folio,
        tipoDocumento: tipo
      },
      queryParamsHandling: 'merge'
    });
  }

  verMas(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
    }
  }

  buscar(): void {
    this.searchPressed = true;
    this.page = 1;
  }

  onInputChange(): void {
    this.searchPressed = true;
    this.page = 1;
  }

  private mapTipoDocumentoToCode(tipo: string): string {
    const t = (tipo || '').toLowerCase().trim();
    if (t.includes('boleta')) return 'BLV';
    if (t.includes('factura')) return 'FCV';
    if (t.includes('nota') && t.includes('venta')) return 'NVV';
    return 'BLV';
  }

  verDetalleFactura(numeroFactura: string): void {
    const folio = this.tryParseFolio(numeroFactura);
    this.router.navigate(['/tracking'], {
      queryParams: {
        folioDocumento: folio,
        tipoDocumento: 'FCV',
        api: 'v1'
      },
      queryParamsHandling: 'merge'
    });
  }

  private tryParseFolio(n: string): number | string {
    const digits = (n || '').match(/\d+/g)?.join('') || '';
    const num = Number(digits);
    return isNaN(num) ? n : num;
  }

  estadoActual(c: Compra): string {
    const idx = this.lastReachedIndex(c);
    return idx >= 0 ? this.pasos[idx] : this.pasos[0];
  }

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

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages) {
      this.page = p;
    }
  }
}
