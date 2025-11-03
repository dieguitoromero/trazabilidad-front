import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse} from '@angular/common/http';
import {Observable} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {LoadingService} from '../../services/loading.service';


@Injectable()
export class HttpActivityInterceptor implements HttpInterceptor {

    constructor(private loading: LoadingService) {
    }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        this.loading.setLoading(true, request.url);
        // @ts-ignore
        return next.handle(request)
            .pipe(catchError((err) => {
                this.loading.setLoading(false, request.url);
                return err;
            }))
            // @ts-ignore
            .pipe(map<HttpEvent<any>, any>((evt: HttpEvent<any>) => {
                if (evt instanceof HttpResponse) {
                    this.loading.setLoading(false, request.url);
                }
                return evt;
            }));
    }
}
