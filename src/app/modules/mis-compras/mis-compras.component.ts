import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ADMIN_MOCK_DATA } from './mock-admin-data';
import { MisComprasService, MisComprasResponseDto } from '../../services/mis-compras.service';
import { TrackingDataService } from '../../services/tracking-data.service';
import { environment } from '../../../environments/environment';
import { normalizeGlosa } from '../../core/helpers/glosa-normalizer';

type MachinableOrder = {
  title?: { text: string; color?: string; isBold?: boolean };
  description?: string;
  color?: string;
  date?: string;
  machinable_steps?: Array<{
    title?: { text: string; color?: string; isBold?: boolean };
    description?: string;
    date?: string;
    icon?: string;
  }>;
  Boards?: Array<{
    quantity?: number;
    code?: string | number;
    code_unimed?: string;
    image?: string;
    description?: string;
    description_unimed?: string;
    state_description?: string;
  }>;
};

type Machinable = {
  text?: string;
  color?: string;
  icon?: string;
  orders?: MachinableOrder[];
};

type Trazabilidad = {
  etapa?: string;
  glosa: string;
  observacion?: string;
  fechaRegistro: string;
  estado: 'activo' | 'finalizado' | string;
  orden?: number;
  indProcesado?: number | null; // 1 = completado, 0 = en progreso, null = pendiente
  // Campos calculados del backend (preferir usar estos cuando estén disponibles)
  title?: {
    text: string;
    color: string;
    isBold: boolean;
  };
  description?: string;
  date?: string | null; // Fecha ISO 8601 con milisegundos o null
  icon?: string; // URL del ícono
  // Machinable (dimensionado) - viene cuando el producto tiene corte/optimización
  machinable?: Machinable;
};

type StepSnapshot = {
  label: string;
  estado: string;
  fecha?: string;
  observacion?: string;
  isActive: boolean;
  isCompleted: boolean;
  isInProgress?: boolean; // Si el paso está en progreso (indProcesado = 0)
  color?: string; // Color del título según indProcesado
  isBold?: boolean; // Si el título debe ser negrita
  icon?: string; // URL del ícono o 'pending'
  hasPendingAfter?: boolean; // Si hay pasos pendientes después de este paso
  hasPendingFrom?: boolean; // Si este paso pendiente viene después de un paso completado/en progreso
  productCount?: number; // Cantidad de productos en este estado
};
type FacturaAsociada = { numeroFactura: string; fechaEmision: string; idFactura: number };

type Pickup = {
  title?: string; // "Retiro en Tienda" o "Despacho a Domicilio"
  text?: string; // Dirección de entrega o tienda
  title_date?: string; // "Retira a partir del " o "Llega a partir del "
  date?: string; // Fecha ISO 8601
  icon?: string; // URL del ícono
};

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
  pickup?: Pickup; // Datos completos de entrega/retiro del backend
};

@Component({
  selector: 'app-mis-compras',
  templateUrl: './mis-compras.component.html',
  styleUrls: ['./mis-compras.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MisComprasComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
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
  clienteIdRequerido = false; // Indica que falta el parámetro clienteId en la URL
  facturasModalVisible = false;
  facturasModalTitle = '';
  facturasModalItems: FacturaAsociada[] = [];

  // RUT del cliente - se obtiene de query params (requerido)
  rut: string | null = null;
  private rutProporcionadoExplicitamente = false;
  
  // Mapa de estados de productos por paso (para calcular el badge)
  // NOTA: Este mapa debería actualizarse para usar los estados reales que envía el backend
  // en lugar de estados canónicos hardcodeados. El backend debería enviar esta información.
  private statusMap: { [key: string]: string[] } = {
    // Estados canónicos (mantener para compatibilidad)
    'Pedido Ingresado': ['Pendiente', 'Pendiente de despacho'],
    'Pedido Aprobado': [],
    'Preparacion de Pedido': ['Pendiente'],
    'Pendiente de Envío': ['Pendiente de despacho'],
    'Pedido en Ruta': ['En Ruta'],
    'Pedido Entregado': ['Entregado', 'Producto Entregado'],
    // Variaciones que el backend puede enviar
    'Pedido pagado': ['Pendiente', 'Pendiente de despacho'],
    'Disponible para retiro': ['Producto Listo para Retiro'],
    'Proceso de fabricacion': ['Pendiente'],
    // Agregar más variaciones según los estados reales que envía el backend
  };

  constructor(
    private router: Router, 
    private route: ActivatedRoute, 
    private misComprasService: MisComprasService, 
    private trackingDataService: TrackingDataService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Restaurar estado de paginación desde query params si existen
    const qp = this.route.snapshot.queryParams || {};
    const qpPage = Number(qp.page);
    const qpPerPage = Number(qp.perPage);
    if (!isNaN(qpPage) && qpPage > 0) { this.page = qpPage; }
    if (!isNaN(qpPerPage) && qpPerPage > 0) { this.perPage = qpPerPage; }

    // Leer el RUT del cliente desde query params (requerido)
    // También aceptar clienteId como alias para rut
    const rutParam = qp.rut || qp.clienteId;
    if (rutParam && typeof rutParam === 'string' && rutParam.trim()) {
      this.rut = rutParam.trim();
      this.rutProporcionadoExplicitamente = true;
      this.clienteIdRequerido = false;
    } else {
      // Si no se proporciona, mostrar vista de clienteId requerido
      this.clienteIdRequerido = true;
      this.error = false;
      this.clienteNoEncontrado = false;
      this.loading = false;
      return;
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
    if (!this.rut) {
      this.error = true;
      this.loading = false;
      return;
    }
    
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
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
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
    'Pedido Aprobado',
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

  private isCompletedEstado(estado: string | undefined, indProcesado?: number | null): boolean {
    // Priorizar indProcesado si está disponible
    if (indProcesado !== undefined && indProcesado !== null) {
      return indProcesado === 1; // 1 = completado
    }
    // Fallback al estado anterior para compatibilidad
    const norm = this.estadoNormalized(estado);
    return norm === 'activo' || norm === 'finalizado' || norm === 'completado' || norm === 'entregado';
  }

  private isInProgressEstado(indProcesado?: number | null): boolean {
    return indProcesado === 0; // 0 = en progreso
  }

  private isPendingEstado(indProcesado?: number | null): boolean {
    return indProcesado === null || indProcesado === undefined;
  }

  private computeTitleColor(indProcesado?: number | null, estado?: string): string {
    if (indProcesado === 1) {
      return '#4d4f57'; // gris oscuro para completado
    } else if (indProcesado === 0) {
      return '#00aa00'; // verde para en progreso (opcional, puede usar #4d4f57)
    }
    return '#575962'; // gris medio para pendiente
  }

  private computeIsBold(indProcesado?: number | null, estado?: string): boolean {
    if (indProcesado === 1 || indProcesado === 0) {
      return true; // Negrita para completado o en progreso
    }
    return false; // No negrita para pendiente
  }

  private computeIconFromEstado(estado: string | undefined, indProcesado?: number | null): string {
    // Priorizar indProcesado si está disponible
    if (indProcesado !== undefined && indProcesado !== null) {
      if (indProcesado === 1) {
        return this.timelineCompleteIcon; // Completado
      } else if (indProcesado === 0) {
        return this.timelineCompleteIcon; // En progreso (usar mismo ícono o timeline_in_progress_icon.svg si existe)
      } else {
        return 'pending'; // Pendiente
      }
    }
    // Fallback al estado anterior para compatibilidad
    const e = (estado || '').toLowerCase();
    if (!e) return 'pending';
    const doneStates = ['activo', 'finalizado', 'completado', 'entregado'];
    return doneStates.some(ds => e.indexOf(ds) >= 0) ? this.timelineCompleteIcon : 'pending';
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
    // Retornar array vacío si no hay datos, ya que usamos los estados reales del backend
    // Si necesitamos un placeholder, el backend debería enviar al menos un paso
    return [];
  }

  // Determina si el paso actual es el último completado antes de pasos pendientes
  public isLastCompleted(steps: StepSnapshot[], index: number): boolean {
    if (!steps || !steps[index]) return false;
    const current = steps[index];
    const next = steps[index + 1];
    
    // Es el último completado si: está completado/en progreso Y el siguiente es pendiente (o no hay siguiente)
    if (current.isCompleted || current.isInProgress) {
      if (!next) return true; // Es el último paso
      return !next.isCompleted && !next.isInProgress; // El siguiente es pendiente
    }
    return false;
  }

  // Convierte stepperSnapshot al formato de TrackingStepModel para usar tracking-stepper-view
  public getTrackingSteps(compra: Compra): any[] {
    const snapshot = this.stepperSnapshot(compra);
    return snapshot.map(step => ({
      title: {
        text: step.label,
        color: step.color || '#2b3e63',
        isBold: step.isBold || false
      },
      description: step.observacion || '-',
      date: step.fecha || null,
      icon: step.icon || 'pending'
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
    // Filtrar "Pedido en Ruta" si es retiro en tienda
    const isRetiro = this.isRetiroEnTienda(compra);
    
    // Usar directamente los estados que vienen del backend
    // Filtrar "Pedido en Ruta" si es retiro en tienda
    let filteredEntries = entries;
    if (isRetiro) {
      filteredEntries = entries.filter(t => {
        const titleText = t.title?.text || t.etapa || t.glosa || '';
        return this.normalize(titleText) !== this.normalize('Pedido en Ruta');
      });
    }
    
    // Mapear directamente los estados del backend
    const snapshots = filteredEntries.map((entry) => {
      // Usar el título del backend si está disponible, sino usar etapa o glosa
      const label = entry.title?.text || entry.etapa || entry.glosa || '';
      const match = entry;
      // Usar directamente los datos del backend
      const indProcesado = match.indProcesado;

        // Si no hay indProcesado ni estado válido, el paso es pendiente
        const hasValidState = indProcesado !== undefined && indProcesado !== null;
        const hasEstado = match.estado && match.estado.trim() && this.isCompletedEstado(match.estado, undefined);

        // Preferir campos calculados del backend si están disponibles
        let fecha: string | undefined = undefined;
        let isCompleted = false;
        let isInProgress = false;

        if (match.date !== undefined) {
          // Usar fecha calculada del backend (puede ser null)
          fecha = match.date !== null ? match.date : undefined;
        } else {
          // Fallback: calcular fecha manualmente
          fecha = (indProcesado !== null && indProcesado !== undefined && match.fechaRegistro && match.fechaRegistro.trim())
            ? match.fechaRegistro
            : undefined;
        }

        // Calcular ícono: SIEMPRE usar el del backend si está disponible (el backend siempre envía icon)
        // El backend envía URLs como: https://dvimperial.blob.core.windows.net/traceability/timeline_pending_icon.svg
        // IMPORTANTE: El backend SIEMPRE envía el campo icon, incluso para etapas pendientes
        let icon: string;
        if (match.icon && typeof match.icon === 'string' && match.icon.trim() && match.icon.trim() !== 'null') {
          // El backend siempre envía una URL de ícono, usarla directamente
          icon = match.icon.trim();
        } else if (hasValidState || hasEstado) {
          // Fallback: calcular manualmente solo si el backend no envió icon
          icon = this.computeIconFromEstado(match.estado, indProcesado);
        } else {
          // Sin estado válido ni icon del backend: usar círculo gris (pending)
          icon = 'pending';
        }

        // Determinar estado completado y en progreso basado en indProcesado (mutuamente excluyentes)
        // IMPORTANTE: Lógica igual que tracking-stepper-view
        // Un paso con icono real (no pending) tiene completed = true
        // indProcesado = 0 → en progreso (tiene icono, así que completed = true también)
        // indProcesado = 1 → completado
        // indProcesado = null/undefined → pendiente (sin icono)
        if (indProcesado === 1) {
          isCompleted = true;
          isInProgress = false;
        } else if (indProcesado === 0) {
          // En progreso: tiene icono real, así que completed = true
          // Esto es igual a tracking-stepper-view donde isStepCompleted verifica si icono !== 'pending'
          isCompleted = true;
          isInProgress = true;
        } else {
          // indProcesado es null o undefined → paso pendiente
          isCompleted = false;
          isInProgress = false;
        }

        // Preferir campos calculados del backend para color y negrita
        let color: string;
        let isBold: boolean;

        if (match.title) {
          color = match.title.color || this.computeTitleColor(indProcesado, match.estado);
          isBold = match.title.isBold !== undefined ? match.title.isBold : this.computeIsBold(indProcesado, match.estado);
        } else {
          color = this.computeTitleColor(indProcesado, match.estado);
          isBold = this.computeIsBold(indProcesado, match.estado);
        }

      // Calcular productCount basado en los productos de la compra
      // Usar el label real del backend para buscar en statusMap
      const productCount = this.calculateProductCount(compra, label, isCompleted, isInProgress);

      return {
        label: label, // Usar el label real del backend
        estado: match.estado || '',
        fecha: fecha,
        observacion: match.description !== undefined ? match.description : match.observacion,
        isActive: isInProgress || this.isActiveEstado(match.estado),
        isCompleted: isCompleted, // true solo si está completado (indProcesado === 1)
        isInProgress: isInProgress, // true si está en progreso (indProcesado === 0)
        icon: icon, // URL del ícono o 'pending'
        color: color,
        isBold: isBold,
        productCount: productCount
      };
    });

    // Segunda pasada: calcular hasPendingAfter
    // hasPendingAfter: Un paso completado tiene pasos pendientes después si:
    // 1. Está completado (no en progreso)
    // 2. El siguiente paso inmediato es pendiente (no completado ni en progreso)
    const snapshotsWithPendingAfter = snapshots.map((snapshot, index) => {
      const nextSnapshot = snapshots[index + 1];

      const hasPendingAfter = snapshot.isCompleted && !snapshot.isInProgress &&
        nextSnapshot &&
        !nextSnapshot.isCompleted &&
        !nextSnapshot.isInProgress;

      return {
        ...snapshot,
        hasPendingAfter
      };
    });

    // Tercera pasada: calcular hasPendingFrom iterativamente
    // hasPendingFrom: Un paso pendiente viene después de un completado/en progreso si:
    // 1. No está completado ni en progreso (es pendiente)
    // 2. El paso anterior está completado, en progreso, O es pendiente con hasPendingFrom
    //    (esto extiende las líneas verdes a TODOS los pendientes consecutivos)
    const finalSnapshots: StepSnapshot[] = [];
    for (let i = 0; i < snapshotsWithPendingAfter.length; i++) {
      const snapshot = snapshotsWithPendingAfter[i];
      const prevSnapshot = i > 0 ? finalSnapshots[i - 1] : undefined;

      // Calcular hasPendingFrom con logging
      const isPending = !snapshot.isCompleted && !snapshot.isInProgress;
      const prevIsCompleted = prevSnapshot?.isCompleted === true;
      const prevIsInProgress = prevSnapshot?.isInProgress === true;
      const prevHasPendingFrom = prevSnapshot?.hasPendingFrom === true;

      const hasPendingFrom = isPending && (prevIsCompleted || prevIsInProgress || prevHasPendingFrom);

      finalSnapshots.push({
        ...snapshot,
        hasPendingFrom
      });
    }

    return finalSnapshots;
  }

  // Calcula el número de productos en un estado específico
  // stepLabel puede ser un estado canónico o un estado real del backend
  private calculateProductCount(compra: Compra, stepLabel: string, isCompleted: boolean, isInProgress: boolean): number {
    if (!compra.productos || compra.productos.length === 0) {
      return 0;
    }

    // Buscar en statusMap usando el label exacto o variaciones normalizadas
    let allowedStates = this.statusMap[stepLabel];
    if (!allowedStates) {
      // Intentar con variaciones normalizadas
      const normalizedLabel = this.normalize(stepLabel);
      for (const [key, states] of Object.entries(this.statusMap)) {
        if (this.normalize(key) === normalizedLabel) {
          allowedStates = states;
          break;
        }
      }
    }
    
    if (!allowedStates || allowedStates.length === 0) {
      return 0;
    }

    // Solo mostrar badge si el paso está en progreso o es el último completado antes de pendientes
    if (!isInProgress && !isCompleted) {
      return 0;
    }

    // Contar productos que tienen un estado en allowedStates
    const count = compra.productos.filter(p => {
      const stateDesc = p.state_description || '';
      return allowedStates.includes(stateDesc);
    }).length;

    return count;
  }

  private findCanonicalMatch(entries: Trazabilidad[], canonicalKey: string): Trazabilidad | undefined {
    // Primero intentar match directo
    let match = entries.find(t => this.matchesCanonicalEntry(t, canonicalKey));
    if (match) return match;

    // Si no hay match directo, buscar por aliases
    // "Pedido pagado" debe mapearse a "Pedido Aprobado"
    if (canonicalKey === this.normalize('Pedido Aprobado')) {
      const pagadoKey = this.normalize('Pedido pagado');
      match = entries.find(t => {
        const etapaKey = this.normalize(t.etapa || '');
        const glosaKey = this.normalize(t.glosa || '');
        return etapaKey === pagadoKey || glosaKey === pagadoKey;
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

  private legacyTraceabilitySteps(trazabilidad: Trazabilidad[], isRetiroEnTienda: boolean = false): any[] {
    const entries = this.sortTrazabilidad(Array.isArray(trazabilidad) ? [...trazabilidad] : []);
    // Filtrar "Pedido en Ruta" si es retiro en tienda
    let filteredEntries = entries;
    if (isRetiroEnTienda) {
      filteredEntries = entries.filter(t => {
        const titleText = t.title?.text || t.etapa || t.glosa || '';
        return this.normalize(titleText) !== this.normalize('Pedido en Ruta');
      });
    }
    
    // Usar directamente los estados del backend
    return filteredEntries.map((entry) => {
      const match = entry;
      const hasMatch = true; // Siempre hay match porque estamos iterando sobre entries
      // Usar el título del backend si está disponible, sino usar etapa o glosa
      const etapaLabel = (match.title?.text || match.etapa || match.glosa || '').trim();
      const label = etapaLabel;

      // Preferir campos calculados del backend si están disponibles
      let icon = 'pending';
      let color = '#575962'; // gris medio para pendiente
      let isBold = false;
      let fecha: string | undefined = undefined;
      let machinable: any = null;

      if (hasMatch && match) {
        const indProcesado = match.indProcesado;

        // Usar campos calculados del backend si están disponibles
        if (match.title && match.icon) {
          icon = match.icon;
          color = match.title.color || '#575962';
          isBold = match.title.isBold !== undefined ? match.title.isBold : false;
        } else {
          // Fallback: calcular manualmente basado en indProcesado
          if (indProcesado === 1) {
            // Completado
            icon = this.timelineCompleteIcon;
            color = '#4d4f57'; // gris oscuro
            isBold = true;
          } else if (indProcesado === 0) {
            // En progreso
            icon = this.timelineCompleteIcon; // o timeline_in_progress_icon.svg si existe
            color = '#00aa00'; // verde (opcional, puede usar #4d4f57)
            isBold = true;
          } else {
            // Pendiente o fallback al estado anterior
            if (this.isCompletedEstado(match.estado, indProcesado)) {
              icon = this.timelineCompleteIcon;
              color = '#4d4f57';
              isBold = true;
            }
          }
        }

        // Usar fecha calculada del backend si está disponible
        if (match.date !== undefined) {
          fecha = match.date !== null ? match.date : undefined;
        } else {
          // Fallback: calcular fecha manualmente
          const indProcesado = match.indProcesado;
          fecha = (indProcesado !== null && match.fechaRegistro && match.fechaRegistro.trim())
            ? match.fechaRegistro
            : undefined;
        }

        // Mapear machinable si existe (para productos dimensionados)
        if ((match as any).machinable && (match as any).machinable.orders && (match as any).machinable.orders.length > 0) {
          const m = (match as any).machinable;
          machinable = {
            text: m.text || 'Dimensionado',
            color: m.color || '#eb414a',
            icon: m.icon || 'https://dvimperial.blob.core.windows.net/traceability/dimensioned_icon.svg',
            orders: (m.orders || []).map((order: any) => ({
              title: order.title || { text: '', color: '', isBold: false },
              description: order.description || '',
              color: order.color || '#000000',
              date: order.date,
              machinable_steps: order.machinable_steps || [],
              Boards: order.Boards || []
            }))
          };
        }
      }

      return {
        title: { text: label, color: color, isBold: isBold }, // Usar el label real del backend
        description: hasMatch && match
          ? (match.description !== undefined ? match.description : (match.observacion || ''))
          : '',
        date: fecha,
        icon: icon,
        machinable: machinable
      };
    });
  }

  lastReachedIndex(compra: Compra): number {
    // Último índice alcanzado según los estados reales del backend
    const entries = this.sortTrazabilidad(Array.isArray(compra?.trazabilidad) ? [...compra.trazabilidad] : []);
    // Filtrar "Pedido en Ruta" si es retiro en tienda
    const isRetiro = this.isRetiroEnTienda(compra);
    let filteredEntries = entries;
    if (isRetiro) {
      filteredEntries = entries.filter(t => {
        const titleText = t.title?.text || t.etapa || t.glosa || '';
        return this.normalize(titleText) !== this.normalize('Pedido en Ruta');
      });
    }
    // Retornar el índice del último paso que tiene indProcesado !== null/undefined
    let last = -1;
    filteredEntries.forEach((t, idx) => {
      if (t.indProcesado !== null && t.indProcesado !== undefined) {
        last = idx;
      }
    });
    return last;
  }

  verDetalle(c: Compra): void {
    if (!this.rut) {
      return;
    }
    const tipo = this.mapTipoDocumentoToCode(c.tipoDocumento);
    // Búsqueda y navegación unificada
    this.misComprasService.buscarDocumento(this.rut, c.numeroDocumento, 1, this.perPage)
      .pipe(takeUntil(this.destroy$))
      .subscribe(resp => {
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
    if (!this.rut) {
      this.error = true;
      this.loading = false;
      return;
    }
    
    console.log('[MisComprasComponent] Llamando a buscarDocumento con:', { rut: this.rut, term, page: 1, perPage: this.perPage });

    // Buscar documento específico en la API
    this.isSearching = true;
    this.searchPressed = true;
    this.loading = true;
    this.page = 1;

    this.misComprasService.buscarDocumento(this.rut, term, 1, this.perPage)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
          if (this.rut) {
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: { page: this.page, perPage: this.perPage, rut: this.rut, buscar: term },
              queryParamsHandling: 'merge'
            });
          }
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('[MisComprasComponent] Error buscando documento', err);
          this.error = true;
          this.compras = [];
          this.resetStepperCache();
          this.totalPages = 1;
          this.loading = false;
          this.searchPressed = true; // Asegurar que se muestre el mensaje de error
          this.cdr.markForCheck();
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
    if (!this.rut) {
      return;
    }
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
    const rawTrace = (encontrado?.trazabilidad || c?.trazabilidad || []) as any[];
    // Si la trazabilidad ya viene con machinable u ordenada desde la API, úsala tal cual para no perder datos (Boards)
    const hasRichTrace = rawTrace.some(t => t?.machinable && t.machinable.orders && t.machinable.orders.length > 0);
    // Determinar si es retiro en tienda para filtrar "Pedido en Ruta"
    const isRetiro = this.isRetiroEnTienda(encontrado || c);
    // Si tiene trazabilidad rica, filtrar "Pedido en Ruta" manualmente si es retiro
    let traceabilitySteps = hasRichTrace ? rawTrace : this.legacyTraceabilitySteps(rawTrace as any, isRetiro);
    // Si es trazabilidad rica y es retiro, filtrar el paso "Pedido en Ruta"
    if (hasRichTrace && isRetiro) {
      traceabilitySteps = traceabilitySteps.filter((step: any) => {
        const titleText = step?.title?.text || step?.title || '';
        return this.normalize(titleText) !== this.normalize('Pedido en Ruta');
      });
    }
    // Construir pickup: usar datos del backend si están disponibles, sino hacer fallback
    // El backend ahora envía pickup correctamente con title, text, title_date, date e icon
    const backendPickup = (encontrado as any)?.pickup || (c as any)?.pickup;
    const tipoEntregaFromBackend = encontrado?.tipoEntrega || c?.tipoEntrega || '';
    const direccionFromBackend = encontrado?.direccionEntrega || c?.direccionEntrega || '';
    
    // Si el backend envió pickup completo, usarlo directamente
    // Si no, construir desde tipoEntrega y direccionEntrega (fallback)
    const pickup = backendPickup ? {
      title: backendPickup.title || (tipoEntregaFromBackend.toLowerCase().includes('retiro') ? 'Retiro en Tienda' : 'Despacho a Domicilio'),
      text: backendPickup.text || direccionFromBackend,
      title_date: backendPickup.title_date || (isRetiro ? 'Retira a partir del ' : 'Llega a partir del '),
      date: backendPickup.date || undefined,
      icon: backendPickup.icon || (isRetiro 
        ? 'https://dvimperial.blob.core.windows.net/traceability/store_pickup_icon.svg'
        : 'https://dvimperial.blob.core.windows.net/traceability/delivery_icon.svg')
    } : {
      title: tipoEntregaFromBackend.toLowerCase().includes('retiro') ? 'Retiro en Tienda' : 'Despacho a Domicilio',
      text: direccionFromBackend,
      title_date: isRetiro ? 'Retira a partir del ' : 'Llega a partir del ',
      date: undefined,
      icon: isRetiro 
        ? 'https://dvimperial.blob.core.windows.net/traceability/store_pickup_icon.svg'
        : 'https://dvimperial.blob.core.windows.net/traceability/delivery_icon.svg'
    };

    const legacyInvoice = {
      number_printed: folioDigits.toString().padStart(10, '0'),
      type_document: tipoDocumentoCode,
      label_document: encontrado?.tipoDocumento || c?.tipoDocumento || '',
      total: encontrado?.total || c?.total || 0,
      date_issue: new Date().toISOString(),
      id_pay: 0,
      pickup: pickup,
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
      // Replicar productos tanto en 'productos' como en 'DetailsProduct' para que Tracking pueda mostrarlos
      // (InvoiceModel prioriza 'productos' y hace fallback a 'DetailsProduct')
      productos: (encontrado?.productos || c?.productos || []).map(p => ({
        cantidad: p.cantidad,
        codigo: p.codigo,
        descripcion: p.descripcion || p.nombre || p.descripcion,
        estado: p.estado || p.state_description,
        imagen: p.imagen || p.image,
        nombre: p.nombre || p.descripcion,
        sku: p.sku || p.codigo,
        unidadMedida: p.unidadMedida || p.description_unimed,
        state_description: p.state_description
      })),
      DetailsProduct: (encontrado?.productos || c?.productos || []).map(p => ({
        quantity: p.cantidad,
        code: p.codigo,
        description: p.descripcion || p.nombre || p.descripcion,
        state_description: p.estado || p.state_description,
        image: p.imagen || p.image,
        description_unimed: p.unidadMedida || p.description_unimed,
      })),
      trazabilidad: encontrado?.trazabilidad || c?.trazabilidad || []
    };
    this.trackingDataService.setInvoicePayload(legacyInvoice);
    // URL simplificada: solo los parámetros necesarios para la vista de detalle
    this.router.navigate(['/tracking'], {
      queryParams: {
        folio: folioDigits,
        tipo: tipoDocumentoCode,
        cliente: this.rut,
        detalle: '1' // Indica que es vista de detalle
      },
      state: { compraBuscarDocumentoResp: resp }
    });
  }

  private tryParseFolio(n: string): number | string {
    const digits = (n || '').match(/\d+/g)?.join('') || '';
    const num = Number(digits);
    return isNaN(num) ? n : num;
  }

  estadoActual(c: Compra): string {
    const entries = this.sortTrazabilidad(Array.isArray(c?.trazabilidad) ? [...c.trazabilidad] : []);
    // Filtrar "Pedido en Ruta" si es retiro en tienda
    const isRetiro = this.isRetiroEnTienda(c);
    let filteredEntries = entries;
    if (isRetiro) {
      filteredEntries = entries.filter(t => {
        const titleText = t.title?.text || t.etapa || t.glosa || '';
        return this.normalize(titleText) !== this.normalize('Pedido en Ruta');
      });
    }
    const idx = this.lastReachedIndex(c);
    if (idx >= 0 && filteredEntries[idx]) {
      const entry = filteredEntries[idx];
      return entry.title?.text || entry.etapa || entry.glosa || 'Pedido Ingresado';
    }
    return filteredEntries.length > 0 
      ? (filteredEntries[0].title?.text || filteredEntries[0].etapa || filteredEntries[0].glosa || 'Pedido Ingresado')
      : 'Pedido Ingresado';
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
      if (this.isSearching && this.searchTerm.trim() && this.rut) {
        const term = this.searchTerm.trim();
        this.loading = true;
        this.misComprasService.buscarDocumento(this.rut, term, p, this.perPage)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
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
              this.cdr.markForCheck();
            },
            error: (err: any) => {
              console.error('[MisComprasComponent] Error buscando documento en página', err);
              this.error = true;
              this.loading = false;
              this.cdr.markForCheck();
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // TrackBy functions para optimizar *ngFor
  trackByCompra(index: number, compra: Compra): string {
    return compra.numeroDocumento || index.toString();
  }

  trackByStep(index: number, step: any): string {
    return step.label || step.title?.text || index.toString();
  }

  trackByFactura(index: number, factura: FacturaAsociada): string {
    return factura.numeroFactura || index.toString();
  }

  trackByPage(index: number, page: number | string): string {
    return typeof page === 'number' ? page.toString() : page;
  }
}