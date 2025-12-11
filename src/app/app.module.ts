import { BrowserModule } from "@angular/platform-browser";
import { LOCALE_ID, NgModule } from "@angular/core";
import localeCL from "@angular/common/locales/es-CL";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
import { MAT_DATE_LOCALE } from "@angular/material/core";
import {
  APP_BASE_HREF,
  PlatformLocation,
  registerLocaleData,
} from "@angular/common";
import { HttpActivityInterceptor } from "./core/interceptors/http-activity.interceptor";
import { CacheBusterInterceptor } from "./core/interceptors/cache-buster.interceptor";
import { LoadingService } from "./services/loading.service";
import { AuthRepository } from "./repositories/auth.repository";
import { AuthService } from "./services/auth.service";
import { AuthInterceptor } from "./core/interceptors/auth.interceptor";
import { MisComprasComponent } from './modules/mis-compras/mis-compras.component';
import { TimelineModule } from './modules/timeline/timeline.module';
import { FormatFechaCompraPipe } from './modules/mis-compras/format-fecha-compra.pipe';
import { FormsModule } from '@angular/forms';

registerLocaleData(localeCL);

@NgModule({
  declarations: [AppComponent, MisComprasComponent, FormatFechaCompraPipe],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    TimelineModule,
  ],
  providers: [
    LoadingService,
    {
      provide: APP_BASE_HREF,
      useFactory: (s: PlatformLocation) => s.getBaseHrefFromDOM(),
      deps: [PlatformLocation],
    },
    { provide: LOCALE_ID, useValue: "es-CL" },
    // CacheBusterInterceptor debe ir primero para agregar headers anti-caché
    { provide: HTTP_INTERCEPTORS, useClass: CacheBusterInterceptor, multi: true },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpActivityInterceptor,
      multi: true,
    },
    { provide: MAT_DATE_LOCALE, useValue: "es-CL" },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    AuthService,
    AuthRepository,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
