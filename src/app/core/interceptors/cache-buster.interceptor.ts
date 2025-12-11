import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Interceptor que agrega headers anti-caché a todas las peticiones HTTP.
 * Esto asegura que el navegador y servidores proxy no cacheen las respuestas.
 */
@Injectable()
export class CacheBusterInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // Solo aplicar a peticiones GET (las más propensas a ser cacheadas)
    // Las peticiones POST, PUT, DELETE generalmente no se cachean
    if (request.method === 'GET') {
      const noCacheRequest = request.clone({
        setHeaders: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        // Agregar timestamp como query param para evitar caché de navegador
        params: request.params.set('_t', Date.now().toString()),
      });
      return next.handle(noCacheRequest);
    }

    return next.handle(request);
  }
}

