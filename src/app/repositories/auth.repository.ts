import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { AuthModel } from "../core/models/auth.model";
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class AuthRepository {
  private url = environment.urlToken;
  private token: BehaviorSubject<AuthModel | undefined>;
  private tokenExpiration: Date | undefined;

  constructor(private http: HttpClient) {
    this.token = new BehaviorSubject<AuthModel | undefined>(undefined);
    // Force initial fetch by setting an already-expired time
    this.tokenExpiration = new Date(0);
  }

  // Método para obtener el token (de memoria o del servidor)
  getToken(): Observable<AuthModel | undefined> {
    const now: Date = new Date();
    const current = this.token.value;
    if (current && this.tokenExpiration && this.tokenExpiration > now) {
      return of(current);
    }

    return this.http.post(this.url, null).pipe(
      map((response: any) => {
        const tokenModel: AuthModel = AuthModel.mapFromObj(response);
        this.token.next(tokenModel);
        const expiresInSec = Number(response?.expires_in) || 300; // default 5 minutes if absent
        const expirationInMilis = expiresInSec * 1000;
        this.tokenExpiration = new Date(now.getTime() + expirationInMilis);
        return tokenModel;
      }),
      catchError((error) => {
        console.error('[AuthRepository] Token fetch failed', error);
        return of(undefined);
      })
    );
  }
}
