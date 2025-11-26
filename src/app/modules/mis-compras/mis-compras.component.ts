import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ADMIN_MOCK_DATA } from './mock-admin-data';
import { MisComprasService, MisComprasResponseDto } from '../../services/mis-compras.service';
import { TrackingDataService } from '../../services/tracking-data.service';
import { environment } from '../../../environments/environment';
import { normalizeGlosa } from '../../core/helpers/glosa-normalizer';

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
  productos?: any[]; // agregado para mostrar lista de productos
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
  perPage = environment.limitDefault;
  totalPages = 1;
  private asociadasOpen = new Set<string>();
  // Pager condensado móvil
  readonly maxPagerNodes = 5;

  loading = false;
  error = false;

  constructor(private router: Router, private route: ActivatedRoute, private misComprasService: MisComprasService, private trackingDataService: TrackingDataService) {}

  ngOnInit(): void {
    // Restaurar estado de paginación desde query params si existen
    const qp = this.route.snapshot.queryParams || {};
    const qpPage = Number(qp.page);
    const qpPerPage = Number(qp.perPage);
    if (!isNaN(qpPage) && qpPage > 0) { this.page = qpPage; }
    if (!isNaN(qpPerPage) && qpPerPage > 0) { this.perPage = qpPerPage; }
    this.fetchComprasReal();
  }

  private fetchComprasReal(): void {
    this.loading = true;
    const rut = environment.clienteId;
    this.misComprasService.getCompras(rut, this.page, this.perPage).subscribe({
      next: (resp: MisComprasResponseDto) => {
        const hasData = !!resp.compras && resp.compras.length > 0;
        if (hasData || !environment.useMockOnEmpty) {
          // Usar siempre la respuesta real; si viene vacía y no queremos mock, mostrar vacío
          this.compras = (resp.compras || []) as Compra[];
          this.perPage = resp.perPage || environment.limitDefault;
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
    // Con paginación server-side: el backend ya devolvió sólo la página actual
    // Aún aplicamos filtro de búsqueda sobre el subset actual para coherencia rápida
    return this.fullFiltered();
  }

  get totalFilteredCount(): number { return this.fullFiltered().length; }

  get pages(): number[] {
    // Usar totalPages entregado por la API directamente
    const total = Math.max(1, this.totalPages);
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Índice activo (page actual en base 0)
  private activeIndex(): number { return this.page - 1; }

  // Lógica pager condensado: siempre máximo 5 páginas mostradas si total >5
  get condensedPager(): number[] {
    const total = this.totalPages;
    if (total <= this.maxPagerNodes) return this.pages; // muestra todos si <=5
    const current = this.page; // 1-based
    const last = total;
    // Casos:
    // 1) Si current <=4 -> [1,2,3,4,last]
    if (current <= 4) return [1,2,3,4,last];
    // 2) Si current >= last-3 -> [1,last-3,last-2,last-1,last]
    if (current >= last - 3) return [1,last-3,last-2,last-1,last];
    // 3) Ventana intermedia -> [1,current-1,current,current+1,last]
    return [1,current-1,current,current+1,last];
  }

  isPagerActive(p: number): boolean { return p === this.page; }
  isPagerNeighbor(p: number): boolean {
    // vecino solo cuando está inmediatamente antes o después del activo en la lista mostrada (excepto primero y último que no se pintan como vecinos en extremos)
    if (p === this.page) return false;
    const list = this.condensedPager;
    const idx = list.indexOf(p);
    const activeIdx = list.indexOf(this.page);
    return Math.abs(idx - activeIdx) === 1;
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

  private normalize(s: string): string {
    // Usar helper y llevar a minúsculas para set comparisons
    return (normalizeGlosa(s) || '').toLowerCase();
  }

  pasoActivo(compra: Compra, paso: string): boolean {
    const target = this.normalize(paso);
    const item = compra.trazabilidad.find(p => this.normalize(p.glosa) === target);
    return !!item && (item.estado === 'activo' || item.estado === 'finalizado');
  }

  lastReachedIndex(compra: Compra): number {
    let last = -1;
    const reached = new Set(compra.trazabilidad.map(t => this.normalize(t.glosa)));
    this.pasos.forEach((p, idx) => { if (reached.has(this.normalize(p))) last = idx; });
    return last;
  }

  verDetalle(c: Compra): void {
    const tipo = this.mapTipoDocumentoToCode(c.tipoDocumento);
    const rut = environment.clienteId;
    // Búsqueda y navegación unificada
    this.misComprasService.buscarDocumento(rut, c.numeroDocumento, 1).subscribe(resp => {
      this.handleBuscarDocumentoResponse(resp, tipo, c.numeroDocumento, c);
    });
  }

  verMas(): void {
    if (this.page < this.totalPages) {
      this.goToPage(this.page + 1);
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
    const rut = environment.clienteId;
    // Forzar búsqueda igual que documento principal para transportar respuesta y productos
    this.misComprasService.buscarDocumento(rut, numeroFactura, 1).subscribe(resp => {
      // Priorizar tipo desde respuesta si existe, fallback FCV
      const encontrado = resp.compras?.[0];
      const tipo = this.mapTipoDocumentoToCode(encontrado?.tipoDocumento || 'factura');
      this.handleBuscarDocumentoResponse(resp, tipo, numeroFactura, encontrado as any);
    });
  }

  /**
   * Construye legacyInvoice, setea payloads y navega al tracking con state para que el constructor los imprima.
   * Compra puede venir del listado original o de la respuesta buscarDocumento (encontrado).
   */
  private handleBuscarDocumentoResponse(resp: MisComprasResponseDto, tipoDocumentoCode: string, numeroOriginal: string, compraContext: Compra | undefined): void {
    const encontrado = resp.compras?.[0];
    // Folio: preferir encontrado.numeroDocumento si existe
    const folioRaw = encontrado?.numeroDocumento || numeroOriginal;
    const folioDigits = this.tryParseFolio(folioRaw);
    // Guardar payload bruto para Tracking
    this.trackingDataService.setCompraPayload(resp);
    const c = compraContext || (encontrado as any as Compra);
    // Construcción invoice legacy genérica tomando datos disponibles
    const legacyInvoice = {
      number_printed: folioDigits.toString().padStart(10,'0'),
      type_document: tipoDocumentoCode,
      label_document: c?.tipoDocumento || encontrado?.tipoDocumento || '',
      total: c?.total || encontrado?.total || 0,
      date_issue: new Date().toISOString(),
      id_pay: 0,
      pickup: {
        title: (c?.tipoEntrega || encontrado?.tipoEntrega || '').toLowerCase().includes('retiro') ? 'Retiro en Tienda' : 'Despacho',
        text: c?.direccionEntrega || encontrado?.direccionEntrega || '',
        title_date: 'Retira a partir del ',
        date: new Date().toISOString(),
        icon: 'https://dvimperial.blob.core.windows.net/traceability/store_pickup_icon.svg'
      },
      traceability: {
        steps: ((c?.trazabilidad || encontrado?.trazabilidad) || []).map(t => ({
          title: { text: t.glosa, color: '#4d4f57', isBold: true },
          description: '',
          date: t.fechaRegistro,
          icon: t.estado === 'finalizado' || t.estado === 'activo' ? 'https://dvimperial.blob.core.windows.net/traceability/timeline_complete_icon.svg' : 'pending',
          machinable: null
        }))
      },
      seller: {
        title: 'Vendedor', name: '', mail: '', phone: '',
        icon_principal: 'https://dvimperial.blob.core.windows.net/traceability/contact_icon.svg',
        icon_phone: 'https://dvimperial.blob.core.windows.net/traceability/phone_icon.svg',
        icon_mail: 'https://dvimperial.blob.core.windows.net/traceability/phone_icon.svg'
      },
      productos: (encontrado?.productos || c?.productos || []).map(p => ({
        cantidad: p.cantidad,
        codigo: p.codigo,
        descripcion: p.descripcion,
        estado: p.estado,
        imagen: p.imagen,
        nombre: p.nombre,
        sku: p.sku,
        unidadMedida: p.unidadMedida
      })),
      DetailsProduct: []
    };
    this.trackingDataService.setInvoicePayload(legacyInvoice);
    const api = 'doc';
    this.router.navigate(['/tracking'], {
      queryParams: {
        folioDocumento: folioDigits,
        tipoDocumento: tipoDocumentoCode,
        api,
        section: 'details',
        page: this.page,
        perPage: this.perPage
      },
      queryParamsHandling: 'merge',
      state: { compraBuscarDocumentoResp: resp }
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
      // Actualizar URL para persistir estado y permitir volver con la misma página
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { page: this.page, perPage: this.perPage },
        queryParamsHandling: 'merge'
      });
      this.fetchComprasReal();
    }
  }
}
