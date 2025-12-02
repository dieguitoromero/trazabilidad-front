import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ADMIN_MOCK_DATA } from './mock-admin-data';
import { MisComprasService, MisComprasResponseDto } from '../../services/mis-compras.service';
import { TrackingDataService } from '../../services/tracking-data.service';
import { environment } from '../../../environments/environment';
import { normalizeGlosa } from '../../core/helpers/glosa-normalizer';

type Trazabilidad = {
  etapa?: string;
  glosa: string;
  observacion?: string;
  fechaRegistro: string;
  estado: 'activo' | 'finalizado' | string;
  orden?: number;
};

type StepSnapshot = {
  label: string;
  estado: string;
  fecha?: string;
  observacion?: string;
  isActive: boolean;
  isCompleted: boolean;
};
type FacturaAsociada = { numeroFactura: string; fechaEmision: string; idFactura: number };

type Compra = {
  tipoDocumento: string;
  numeroDocumento: string;
  fechaCompra: string;
  tipoEntrega: string;
  direccionEntrega: string;
  trazabilidad: Trazabilidad[];
  esDimensionado: boolean;
  total: number;
  facturasAsociadas?: FacturaAsociada[];
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
  private stepperCache = new WeakMap<Compra, StepSnapshot[]>();

  loading = false;
  error = false;
  facturasModalVisible = false;
  facturasModalTitle = '';
  facturasModalItems: FacturaAsociada[] = [];

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
          this.resetStepperCache();
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
          this.resetStepperCache();
          this.totalPages = 1;
        }
        this.loading = false;
      }
    });
  }

  private applyMock(): void {
    this.compras = ADMIN_MOCK_DATA.compras as Compra[];
    this.resetStepperCache();
    this.perPage = (ADMIN_MOCK_DATA as any).perPage || 10;
    this.page = (ADMIN_MOCK_DATA as any).page || 1;
    this.totalPages = (ADMIN_MOCK_DATA as any).totalPages || Math.max(1, Math.ceil(this.compras.length / this.perPage));
  }

  private resetStepperCache(): void {
    this.stepperCache = new WeakMap<Compra, StepSnapshot[]>();
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

  private readonly canonicalPasos = [
    'Pedido Ingresado',
    'Pedido Aprobado',
    'Preparación de pedido',
    'Disponible para retiro',
    'Pedido Entregado'
  ];
  private readonly maxStepperSteps = this.canonicalPasos.length;
  private readonly timelineCompleteIcon = 'https://dvimperial.blob.core.windows.net/traceability/timeline_complete_icon.svg';

  private normalize(s: string): string {
    // Normaliza textos de etapa/pasos a minúsculas y aplica helper de glosa
    return (normalizeGlosa(s) || '').toLowerCase();
  }

  private estadoNormalized(estado: string | undefined): string {
    return (estado || '').trim().toLowerCase();
  }

  private isActiveEstado(estado: string | undefined): boolean {
    return this.estadoNormalized(estado) === 'activo';
  }

  private isCompletedEstado(estado: string | undefined): boolean {
    const norm = this.estadoNormalized(estado);
    return norm === 'activo' || norm === 'finalizado' || norm === 'completado' || norm === 'entregado';
  }

  private sortTrazabilidad(entries: Trazabilidad[]): Trazabilidad[] {
    if (!entries.length) return entries;
    const hasOrden = entries.some(t => typeof t.orden === 'number');
    if (!hasOrden) return entries;
    return [...entries].sort((a, b) => {
      const ao = typeof a.orden === 'number' ? a.orden : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.orden === 'number' ? b.orden : Number.MAX_SAFE_INTEGER;
      if (ao === bo) return 0;
      return ao - bo;
    });
  }

  private buildPlaceholderSnapshot(): StepSnapshot[] {
    return this.canonicalPasos.map(label => ({
      label,
      estado: 'pendiente',
      isActive: false,
      isCompleted: false
    }));
  }

  public stepperSnapshot(compra: Compra): StepSnapshot[] {
    if (!compra) return this.buildPlaceholderSnapshot();
    const cached = this.stepperCache.get(compra);
    if (cached) return cached;
    const snapshot = this.buildCanonicalSnapshots(compra);
    this.stepperCache.set(compra, snapshot);
    return snapshot;
  }

  private buildCanonicalSnapshots(compra: Compra): StepSnapshot[] {
    const entries = this.sortTrazabilidad(Array.isArray(compra?.trazabilidad) ? [...compra.trazabilidad] : []);
    return this.canonicalPasos.map((label) => {
      const canonicalKey = this.normalize(label);
      const match = this.findCanonicalMatch(entries, canonicalKey);
      if (match) {
        const labelSource = (match.etapa || match.glosa || label).trim();
        return {
          label: labelSource,
          estado: match.estado || '',
          fecha: match.fechaRegistro,
          observacion: match.observacion,
          isActive: this.isActiveEstado(match.estado),
          isCompleted: this.isCompletedEstado(match.estado)
        };
      }
      return {
        label,
        estado: 'pendiente',
        isActive: false,
        isCompleted: false
      };
    });
  }

  private findCanonicalMatch(entries: Trazabilidad[], canonicalKey: string): Trazabilidad | undefined {
    return entries.find(t => this.matchesCanonicalEntry(t, canonicalKey));
  }

  private matchesCanonicalEntry(entry: Trazabilidad | undefined, canonicalKey: string): boolean {
    if (!entry) { return false; }
    const etapaKey = this.normalize(entry.etapa || '');
    if (etapaKey === canonicalKey) { return true; }
    const glosaKey = this.normalize(entry.glosa || '');
    return glosaKey === canonicalKey;
  }

  private legacyTraceabilitySteps(trazabilidad: Trazabilidad[]): any[] {
    const entries = this.sortTrazabilidad(Array.isArray(trazabilidad) ? [...trazabilidad] : []);
    return this.canonicalPasos.map((label) => {
      const canonicalKey = this.normalize(label);
      const match = this.findCanonicalMatch(entries, canonicalKey);
      const hasMatch = !!match;
      const etapaLabel = (match?.etapa || match?.glosa || label).trim();
      return {
        title: { text: etapaLabel, color: '#4d4f57', isBold: true },
        description: hasMatch ? (match?.observacion || '') : '',
        date: hasMatch ? match?.fechaRegistro : undefined,
        icon: hasMatch && this.isCompletedEstado(match?.estado) ? this.timelineCompleteIcon : 'pending',
        canonicalKey,
        machinable: null
      };
    }).slice(0, this.maxStepperSteps);
  }

  lastReachedIndex(compra: Compra): number {
    // Último índice alcanzado según 'etapa' reportada
    let last = -1;
    // Incluir tanto etapa como glosa normalizadas para el set de alcanzados
    const reached = new Set<string>();
    compra.trazabilidad.forEach(t => {
      const e = this.normalize((t.etapa || '').trim());
      const g = this.normalize((t.glosa || '').trim());
      if (e) reached.add(e);
      if (g) reached.add(g);
    });
    this.canonicalPasos.forEach((p, idx) => { if (reached.has(this.normalize(p))) last = idx; });
    return last;
  }

  verDetalle(c: Compra): void {
    const tipo = this.mapTipoDocumentoToCode(c.tipoDocumento);
    const rut = environment.clienteId;
    // Búsqueda y navegación unificada
    // Loguear documento seleccionado
    // eslint-disable-next-line no-console
    console.log('DOCUMENTO TRANSPORTADO', c);
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
    const traceabilitySteps = this.legacyTraceabilitySteps((c?.trazabilidad || encontrado?.trazabilidad) || []);
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
        steps: traceabilitySteps
      },
      trackingSteps: traceabilitySteps,
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
    return idx >= 0 ? this.canonicalPasos[idx] : this.canonicalPasos[0];
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

  openFacturasModal(c: Compra): void {
    if (!c?.facturasAsociadas || c.facturasAsociadas.length === 0) {
      return;
    }
    this.facturasModalItems = [...c.facturasAsociadas];
    this.facturasModalTitle = `${c.tipoDocumento} ${c.numeroDocumento}`.trim();
    this.facturasModalVisible = true;
  }

  closeFacturasModal(): void {
    this.facturasModalVisible = false;
    this.facturasModalItems = [];
    this.facturasModalTitle = '';
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
