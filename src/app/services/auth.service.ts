import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { AuthRepository } from "../repositories/auth.repository";
import { AuthModel } from "../core/models/auth.model";

@Injectable()
export class AuthService {

    constructor(private authRepository: AuthRepository) {
    }
  
    public getToken(): Observable<AuthModel | undefined> {
        return this.authRepository.getToken();
    }
}
