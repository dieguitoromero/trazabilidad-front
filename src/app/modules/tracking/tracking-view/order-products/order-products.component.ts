import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

interface OrderProductItem {
  imagen?: string;
  image?: string;
  nombre?: string;
  descripcion?: string;
  description?: string;
  cantidad?: number;
  quantity?: number;
  codigo?: number | string;
  code?: number | string;
  sku?: string;
}

@Component({
  selector: 'app-order-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="productos-list" *ngIf="productos?.length; else sinProductos">
      <div class="producto-item" *ngFor="let p of productos">
        <div class="img-col">
          <img [src]="img(p)" alt="producto" />
        </div>
        <div class="info-col">
          <p class="nombre">{{ nombre(p) }}</p>
          <p class="cantidad">{{ cantidad(p) }}</p>
        </div>
        <div class="sku-col" *ngIf="sku(p)"><span class="sku">SKU {{ sku(p) }}</span></div>
      </div>
    </div>
    <ng-template #sinProductos>
      <div class="sin-productos">No hay productos para mostrar.</div>
    </ng-template>
  `,
  styles: [`
    .productos-list { display:flex; flex-direction:column; }
    .producto-item { display:flex; align-items:stretch; padding:12px 0; border-bottom:1px solid #d9d9d9; }
    .producto-item:last-child { border-bottom:none; }
    .img-col { width:64px; height:64px; display:flex; align-items:center; justify-content:center; margin-right:16px; }
    .img-col img { max-width:64px; max-height:64px; object-fit:contain; border-radius:4px; background:#fff; box-shadow:0 0 0 1px #eee; }
    .info-col { flex:1; display:flex; flex-direction:column; justify-content:center; }
    .info-col .nombre { margin:0; font-size:14px; line-height:18px; font-weight:500; color:#222; }
    .info-col .cantidad { margin:4px 0 0 0; font-size:11px; line-height:14px; letter-spacing:0.5px; color:#6a6a6a; font-weight:600; text-transform:uppercase; }
    .sku-col { min-width:90px; display:flex; align-items:center; justify-content:flex-end; font-size:11px; letter-spacing:0.5px; color:#4d4f57; }
    .sku { white-space:nowrap; }
    .sin-productos { padding:12px 0; font-size:13px; color:#777; font-style:italic; }
  `]
})
export class OrderProductsComponent {
  @Input() productos: OrderProductItem[] | null | undefined;

  nombre(p: OrderProductItem): string {
    return (p.nombre || p.description || p.descripcion || '').trim();
  }

  img(p: OrderProductItem): string | undefined {
    return p.imagen || p.image || '';
  }

  cantidad(p: OrderProductItem): string {
    const q = p.cantidad ?? p.quantity ?? 0;
    return q === 1 ? '1 UNIDAD' : q + ' UNIDADES';
  }

  sku(p: OrderProductItem): string | undefined {
    if (p.codigo !== undefined && p.codigo !== null) return String(p.codigo);
    if (p.code !== undefined && p.code !== null) return String(p.code);
    if (p.sku) return p.sku;
    return undefined;
  }
}
