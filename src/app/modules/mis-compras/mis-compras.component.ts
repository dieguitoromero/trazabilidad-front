import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
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
  isSearching = false; // Indica si estamos en modo búsqueda (buscando documento específico)
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
  clienteNoEncontrado = false;
  facturasModalVisible = false;
  facturasModalTitle = '';
  facturasModalItems: FacturaAsociada[] = [];
  
  // RUT del cliente - se obtiene de query params o usa el valor por defecto del environment
  rut: string = environment.clienteId;
  private rutProporcionadoExplicitamente = false;

  constructor(private router: Router, private route: ActivatedRoute, private misComprasService: MisComprasService, private trackingDataService: TrackingDataService) { }

  ngOnInit(): void {
    // Restaurar estado de paginación desde query params si existen
    const qp = this.route.snapshot.queryParams || {};
    const qpPage = Number(qp.page);
    const qpPerPage = Number(qp.perPage);
    if (!isNaN(qpPage) && qpPage > 0) { this.page = qpPage; }
    if (!isNaN(qpPerPage) && qpPerPage > 0) { this.perPage = qpPerPage; }
    
    // Leer el RUT del cliente desde query params
    if (qp.rut && typeof qp.rut === 'string' && qp.rut.trim()) {
      this.rut = qp.rut.trim();
      this.rutProporcionadoExplicitamente = true;
    }
    
    // Si hay un término de búsqueda en la URL, ejecutar la búsqueda
    if (qp.buscar && typeof qp.buscar === 'string' && qp.buscar.trim()) {
      this.searchTerm = qp.buscar.trim();
      this.buscar();
    } else {
      this.fetchComprasReal();
    }
  }

  private fetchComprasReal(): void {
    this.loading = true;
    this.clienteNoEncontrado = false;
    this.error = false;
    this.isSearching = false; // Resetear modo búsqueda al cargar todas las compras
    this.misComprasService.getCompras(this.rut, this.page, this.perPage).subscribe({
      next: (resp: MisComprasResponseDto) => {
        const hasData = !!resp.compras && resp.compras.length > 0;
        
        // Si no hay datos y el RUT fue proporcionado explícitamente, considerar que el cliente no existe
        if (!hasData && this.rutProporcionadoExplicitamente) {
          this.clienteNoEncontrado = true;
          this.compras = [];
          this.resetStepperCache();
          this.totalPages = 1;
          this.error = false;
        } else if (hasData || !environment.useMockOnEmpty) {
          // Usar siempre la respuesta real; si viene vacía y no queremos mock, mostrar vacío
          this.compras = (resp.compras || []) as Compra[];
          this.resetStepperCache();
          this.perPage = resp.perPage || environment.limitDefault;
          this.page = resp.page || 1;
          const base = this.compras.length || 1;
          this.totalPages = resp.totalPages || Math.max(1, Math.ceil(base / this.perPage));
          this.error = false;
          this.clienteNoEncontrado = false;
        } else {
          // Fallback a mock sólo si está permitido en env
          this.applyMock();
          this.clienteNoEncontrado = false;
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('[MisComprasComponent] Error API', err);
        
        // Si el error es 404 o 400 y el RUT fue proporcionado explícitamente, considerar cliente no encontrado
        const isHttpError = err instanceof HttpErrorResponse;
        const isNotFound = isHttpError && (err.status === 404 || err.status === 400);
        
        if (isNotFound && this.rutProporcionadoExplicitamente) {
          this.clienteNoEncontrado = true;
          this.error = false;
          this.compras = [];
          this.resetStepperCache();
          this.totalPages = 1;
        } else {
          this.error = true;
          if (environment.useMockOnEmpty) {
            this.applyMock();
            this.clienteNoEncontrado = false;
          } else {
            // Mantener vacío si no se permite mock
            this.compras = [];
            this.resetStepperCache();
            this.totalPages = 1;
            this.clienteNoEncontrado = false;
          }
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
    // Si estamos en modo búsqueda, los resultados ya vienen filtrados de la API
    // NO aplicar filtro local cuando estamos buscando - los resultados vienen del servicio
    if (this.isSearching) {
      return this.compras;
    }
    // Si no estamos buscando y hay un término de búsqueda, NO aplicar filtro local
    // porque significa que el usuario aún no ha presionado buscar
    // Solo mostrar todas las compras hasta que se ejecute la búsqueda
    return this.compras;
  }

  get filteredCompras(): Compra[] {
    // Con paginación server-side: el backend ya devolvió sólo la página actual
    // Si estamos en modo búsqueda, los resultados ya vienen filtrados de la API
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
    if (current <= 4) return [1, 2, 3, 4, last];
    // 2) Si current >= last-3 -> [1,last-3,last-2,last-1,last]
    if (current >= last - 3) return [1, last - 3, last - 2, last - 1, last];
    // 3) Ventana intermedia -> [1,current-1,current,current+1,last]
    return [1, current - 1, current, current + 1, last];
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

  getVisiblePages(): (number | string)[] {
    const total = Math.max(1, this.totalPages || 1);
    const current = Math.max(1, this.page || 1);
    const result: (number | string)[] = [];

    if (total <= 7) {
      // Si hay 7 o menos páginas, mostrar todas
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Siempre mostrar la primera página
    result.push(1);

    if (current <= 4) {
      // Si estamos cerca del inicio: 1, 2, 3, 4, ..., total
      for (let i = 2; i <= 4; i++) {
        result.push(i);
      }
      if (total > 5) {
        result.push('...');
      }
      result.push(total);
    } else if (current >= total - 3) {
      // Si estamos cerca del final: 1, ..., total-3, total-2, total-1, total
      result.push('...');
      for (let i = total - 3; i <= total; i++) {
        result.push(i);
      }
    } else {
      // En el medio: 1, ..., current-1, current, current+1, ..., total
      result.push('...');
      result.push(current - 1);
      result.push(current);
      result.push(current + 1);
      result.push('...');
      result.push(total);
    }

    return result;
  }

  handlePageClick(page: number | string): void {
    if (typeof page === 'number') {
      this.goToPage(page);
    }
  }

  get hasNoResults(): boolean {
    const typed = (this.searchTerm || '').trim().length > 0;
    // Si estamos en modo búsqueda o hay texto en el campo de búsqueda, y no hay resultados
    return (this.isSearching || this.searchPressed || typed) && this.totalFilteredCount === 0;
  }

  private readonly canonicalPasos = [
    'Pedido Ingresado',
    'Pedido pagado',
    'Preparacion de Pedido',
    'Pendiente de Envío',
    'Pedido en Ruta',
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
    // Primero intentar match directo
    let match = entries.find(t => this.matchesCanonicalEntry(t, canonicalKey));
    if (match) return match;
    
    // Si no hay match directo, buscar por aliases
    // "Pedido Aprobado" debe mapearse a "Pedido pagado"
    if (canonicalKey === this.normalize('Pedido pagado')) {
      const aprobadoKey = this.normalize('Pedido Aprobado');
      match = entries.find(t => {
        const etapaKey = this.normalize(t.etapa || '');
        const glosaKey = this.normalize(t.glosa || '');
        return etapaKey === aprobadoKey || glosaKey === aprobadoKey;
      });
      if (match) return match;
    }
    
    // "Disponible para retiro" debe mapearse a "Pendiente de Envío"
    if (canonicalKey === this.normalize('Pendiente de Envío')) {
      const retiroKey = this.normalize('Disponible para retiro');
      match = entries.find(t => {
        const etapaKey = this.normalize(t.etapa || '');
        const glosaKey = this.normalize(t.glosa || '');
        return etapaKey === retiroKey || glosaKey === retiroKey;
      });
    }
    
    return match;
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
    // Búsqueda y navegación unificada
    this.misComprasService.buscarDocumento(this.rut, c.numeroDocumento, 1, this.perPage).subscribe(resp => {
      this.handleBuscarDocumentoResponse(resp, tipo, c.numeroDocumento, c);
    });
  }

  verMas(): void {
    if (this.page < this.totalPages) {
      this.goToPage(this.page + 1);
    }
  }

  buscar(): void {
    const term = (this.searchTerm || '').trim();
    console.log('[MisComprasComponent] buscar() llamado con término:', term, 'RUT:', this.rut);
    
    if (!term) {
      // Si no hay término de búsqueda, volver a cargar todas las compras
      this.isSearching = false;
      this.searchPressed = false;
      this.page = 1;
      // Limpiar el parámetro 'buscar' de la URL
      const currentParams = this.route.snapshot.queryParams;
      const newParams: any = { page: 1, perPage: this.perPage, rut: this.rut };
      // Copiar otros parámetros excepto 'buscar'
      Object.keys(currentParams).forEach(key => {
        if (key !== 'buscar' && !newParams.hasOwnProperty(key)) {
          newParams[key] = currentParams[key];
        }
      });
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: newParams
      });
      this.fetchComprasReal();
      return;
    }
    
    // Asegurar que tenemos un RUT válido antes de buscar
    const rutToUse = this.rut || environment.clienteId;
    console.log('[MisComprasComponent] Llamando a buscarDocumento con:', { rut: rutToUse, term, page: 1, perPage: this.perPage });
    
    // Buscar documento específico en la API
    this.isSearching = true;
    this.searchPressed = true;
    this.loading = true;
    this.page = 1;
    
    this.misComprasService.buscarDocumento(rutToUse, term, 1, this.perPage).subscribe({
      next: (resp: MisComprasResponseDto) => {
        console.log('[MisComprasComponent] Respuesta de buscarDocumento:', resp);
        const hasData = !!resp.compras && resp.compras.length > 0;
        this.compras = (resp.compras || []) as Compra[];
        this.resetStepperCache();
        this.perPage = resp.perPage || environment.limitDefault;
        this.page = resp.page || 1;
        // Usar el totalPages real de la respuesta para permitir paginación
        // si hay múltiples resultados de búsqueda
        this.totalPages = resp.totalPages || 1;
        this.error = false;
        this.loading = false;
        // Asegurar que searchPressed esté en true para mostrar mensaje si no hay resultados
        if (!hasData) {
          this.searchPressed = true;
        }
        
        // Actualizar URL con el término de búsqueda y la página
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: this.page, perPage: this.perPage, rut: rutToUse, buscar: term },
          queryParamsHandling: 'merge'
        });
      },
      error: (err: any) => {
        console.error('[MisComprasComponent] Error buscando documento', err);
        this.error = true;
        this.compras = [];
        this.resetStepperCache();
        this.totalPages = 1;
        this.loading = false;
        this.searchPressed = true; // Asegurar que se muestre el mensaje de error
      }
    });
  }

  onInputChange(): void {
    // Si el campo se limpia, volver a cargar todas las compras
    const term = (this.searchTerm || '').trim();
    if (!term && this.isSearching) {
      this.isSearching = false;
      this.searchPressed = false;
      this.page = 1;
      // Limpiar el parámetro 'buscar' de la URL
      const currentParams = this.route.snapshot.queryParams;
      const newParams: any = { page: 1, perPage: this.perPage, rut: this.rut };
      // Copiar otros parámetros excepto 'buscar'
      Object.keys(currentParams).forEach(key => {
        if (key !== 'buscar' && !newParams.hasOwnProperty(key)) {
          newParams[key] = currentParams[key];
        }
      });
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: newParams
      });
      this.fetchComprasReal();
    }
  }

  volverATodosLosDocumentos(): void {
    // Limpiar búsqueda y volver a mostrar todos los documentos
    this.searchTerm = '';
    this.isSearching = false;
    this.searchPressed = false;
    this.page = 1;
    
    // Actualizar URL eliminando el parámetro 'buscar'
    const currentParams = this.route.snapshot.queryParams;
    const newParams: any = { page: 1, perPage: this.perPage, rut: this.rut };
    // Copiar otros parámetros excepto 'buscar'
    Object.keys(currentParams).forEach(key => {
      if (key !== 'buscar' && !newParams.hasOwnProperty(key)) {
        newParams[key] = currentParams[key];
      }
    });
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: newParams
    });
    
    // Cargar todos los documentos
    this.fetchComprasReal();
  }

  private mapTipoDocumentoToCode(tipo: string): string {
    const t = (tipo || '').toLowerCase().trim();
    if (t.includes('boleta')) return 'BLV';
    if (t.includes('factura')) return 'FCV';
    if (t.includes('nota') && t.includes('venta')) return 'NVV';
    return 'BLV';
  }

  verDetalleFactura(numeroFactura: string): void {
    // Forzar búsqueda igual que documento principal para transportar respuesta y productos
    this.misComprasService.buscarDocumento(this.rut, numeroFactura, 1, this.perPage).subscribe(resp => {
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
    // Construcción invoice legacy genérica tomando datos disponibles
    const traceabilitySteps = this.legacyTraceabilitySteps((encontrado?.trazabilidad || c?.trazabilidad) || []);
    const legacyInvoice = {
      number_printed: folioDigits.toString().padStart(10, '0'),
      type_document: tipoDocumentoCode,
      label_document: encontrado?.tipoDocumento || c?.tipoDocumento || '',
      total: encontrado?.total || c?.total || 0,
      date_issue: new Date().toISOString(),
      id_pay: 0,
      pickup: {
        title: (encontrado?.tipoEntrega || c?.tipoEntrega || '').toLowerCase().includes('retiro') ? 'Retiro en Tienda' : 'Despacho',
        text: encontrado?.direccionEntrega || c?.direccionEntrega || '',
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
      DetailsProduct: [],
      trazabilidad: encontrado?.trazabilidad || c?.trazabilidad || []
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

  /**
   * Determina si es retiro en tienda basado en el tipoEntrega.
   * Maneja variantes como "Entrega a domicilio", "Despacho a domicilio", etc.
   */
  isRetiroEnTienda(compra: Compra): boolean {
    if (!compra || !compra.tipoEntrega) return false;
    const tipo = (compra.tipoEntrega || '').toLowerCase().trim();
    // Si contiene "retiro" o "tienda", es retiro en tienda
    if (tipo.includes('retiro') || tipo.includes('tienda')) {
      return true;
    }
    // Si contiene "domicilio", "entrega" o "despacho", es domicilio (no retiro)
    if (tipo.includes('domicilio') || tipo.includes('entrega') || tipo.includes('despacho')) {
      return false;
    }
    // Por defecto, asumir que no es retiro
    return false;
  }

  /**
   * Obtiene el tipo de entrega normalizado para mostrar.
   */
  getTipoEntregaLabel(compra: Compra): string {
    if (!compra || !compra.tipoEntrega) return '';
    const tipo = (compra.tipoEntrega || '').trim();
    
    // Normalizar variantes comunes
    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes('retiro') || tipoLower.includes('tienda')) {
      return 'Retiro en tienda';
    }
    if (tipoLower.includes('domicilio') || tipoLower.includes('entrega') || tipoLower.includes('despacho')) {
      return 'Despacho a domicilio';
    }
    
    // Si no coincide con ningún patrón, devolver el original
    return tipo;
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
      
      // Si estamos en modo búsqueda, buscar en la página correspondiente
      if (this.isSearching && this.searchTerm.trim()) {
        const term = this.searchTerm.trim();
        this.loading = true;
        this.misComprasService.buscarDocumento(this.rut, term, p, this.perPage).subscribe({
          next: (resp: MisComprasResponseDto) => {
            this.compras = (resp.compras || []) as Compra[];
            this.resetStepperCache();
            this.perPage = resp.perPage || environment.limitDefault;
            this.page = resp.page || p;
            this.totalPages = resp.totalPages || 1;
            this.error = false;
            this.loading = false;
            
            // Actualizar URL con el término de búsqueda y la página
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { page: this.page, perPage: this.perPage, rut: this.rut, buscar: term },
              queryParamsHandling: 'merge'
            });
          },
          error: (err: any) => {
            console.error('[MisComprasComponent] Error buscando documento en página', err);
            this.error = true;
            this.loading = false;
          }
        });
      } else {
        // Actualizar URL para persistir estado y permitir volver con la misma página
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: this.page, perPage: this.perPage, rut: this.rut },
          queryParamsHandling: 'merge'
        });
        this.fetchComprasReal();
      }
    }
  }
}