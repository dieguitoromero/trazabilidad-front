import { Component, OnInit } from '@angular/core';
import { LoadingService } from './services/loading.service';
import { delay } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MisComprasService } from './services/mis-compras.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
    title = 'imperial-trazabilidad';

    loading = true;

    constructor(private loadingService: LoadingService,
                private router: Router,
                private misComprasService: MisComprasService) {

    }

    ngOnInit(): void {
        this.setupLoading();
        this.handleIncomingRut();
    }

    private handleIncomingRut(): void {
        const rut = this.extractRut();
        if (!rut) { return; }

        // Consultar si el rut tiene compras; si tiene -> navegar a /mis-compras
        this.misComprasService.getCompras(rut, 1, 1).subscribe(resp => {
            const has = !!(resp && Array.isArray(resp.compras) && resp.compras.length > 0);
            if (has) {
                // pasar rut como query param para que la vista pueda usarlo si es necesario
                try {
                    this.router.navigate(['/mis-compras'], { queryParams: { rut } });
                } catch (e) {
                    // fallback: cambiar location
                    window.location.href = this.buildHostBaseUrl();
                }
            } else {
                // redirigir al host público sin query
                window.location.href = this.buildHostBaseUrl();
            }
        }, err => {
            // en caso de error de red, redirigir al host público
            window.location.href = this.buildHostBaseUrl();
        });
    }

    private extractRut(): string | undefined {
        // 1) revisar query string actual
        const fromLocation = this.getParamFromQuery(window.location.search, 'rut');
        if (fromLocation) return fromLocation;

        // 2) intentar desde referrer (por si el navegador cargó la app desde otra URL)
        try {
            const ref = document.referrer || '';
            const idx = ref.indexOf('?');
            if (idx >= 0) {
                const qs = ref.substring(idx);
                const v = this.getParamFromQuery(qs, 'rut');
                if (v) return v;
            }
        } catch (e) {
            // noop
        }

        // 3) si estamos embebidos en un parent (iframe), intentar leer el search del parent
        try {
            if (window.parent && window.parent !== window) {
                const parentSearch = (window.parent.location && window.parent.location.search) ? window.parent.location.search : '';
                const v = this.getParamFromQuery(parentSearch, 'rut');
                if (v) return v;
            }
        } catch (e) {
            // cross-origin — no podemos leer parent
        }

        return undefined;
    }

    private getParamFromQuery(query: string, key: string): string | undefined {
        if (!query) return undefined;
        const q = query.startsWith('?') ? query.substring(1) : query;
        try {
            const params = new URLSearchParams(q);
            const v = params.get(key);
            return v ? v.trim() : undefined;
        } catch (e) {
            // fallback parse manual
            const parts = q.split('&');
            for (const p of parts) {
                const [k, val] = p.split('=');
                if (k === key && val) return decodeURIComponent(val);
            }
            return undefined;
        }
    }

    private buildHostBaseUrl(): string {
        // Construir la URL pública base a la que redirigir cuando no hay compras.
        // Por defecto usar el host esperado '/trazabilidad-app' en el mismo origin si coincide,
        // o usar el origin que aparece en la URL objetivo indicada por el usuario.
        try {
            const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
            // Si la app está servida en localhost, preferir la URL pública conocida
            if (origin.indexOf('localhost') >= 0 || origin.indexOf('127.0.0.1') >= 0) {
                return 'https://soa-qa-iis.imperial.cl/trazabilidad-app';
            }
            // Si ya estamos en el host público, devolver la misma origin + path
            return origin.replace(/\/$/, '') + '/trazabilidad-app';
        } catch (e) {
            return 'https://soa-qa-iis.imperial.cl/trazabilidad-app';
        }
    }

    private setupLoading(): void {
        this.loadingService.loadingSub
            .pipe(delay(0))
            .subscribe((loading) => {
                this.loading = loading;
            });
    }
}
