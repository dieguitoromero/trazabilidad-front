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
    this.tokenExpiration = new Date(Number.MAX_SAFE_INTEGER);
  }

  // Método para obtener el token (de memoria o del servidor)
  getToken(): Observable<AuthModel | undefined> {
    const now : Date = new Date(Date.now());
    if (this.token && this.tokenExpiration && this.tokenExpiration > now) {
      return this.token.asObservable();
    }

    return this.http.post(this.url, null).pipe(
      map((response: any) => { const tokenModel: AuthModel = AuthModel.mapFromObj(response)
        this.token.next(tokenModel);
        const expirationInMilis = response.expires_in * 1000;
        this.tokenExpiration = new Date(now.getTime() + expirationInMilis);
        return tokenModel;
      }),
      catchError((error) => {
        console.error(error);
        return of(undefined);
      })
    );
  }
}
