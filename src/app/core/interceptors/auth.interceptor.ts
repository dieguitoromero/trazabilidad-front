import { Injectable } from "@angular/core";
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { AuthService } from "../../services/auth.service";
import { AuthModel } from "../models/auth.model";
import { environment } from "src/environments/environment";

@Injectable({
  providedIn: "root",
})
export class AuthInterceptor implements HttpInterceptor {
  private excludedUrls: string[] = [ 
    environment.urlToken,
  ];

  constructor(private authService: AuthService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (this.excludedUrls.some(url => url.includes(req.url))) {
      return next.handle(req);
    }
    return this.authService.getToken().pipe(
      switchMap((token: AuthModel | undefined) => {
        
        if (!token) {
            throw new Error("Invalid response fron the server (no auth token)");
        }

        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token.access_token}`,
            ...req.headers.keys().reduce((headers, key) => {
              headers[key] = req.headers.get(key) || '';
              return headers;
            }, {} as Record<string, string>),
          },
        });

        return next.handle(authReq).pipe(
          catchError((error) => {
            if (error.status === 401 || error.status === 403) {
              // handle error
            }
            return throwError(error);
          })
        );;
      })
    );
  }
}
