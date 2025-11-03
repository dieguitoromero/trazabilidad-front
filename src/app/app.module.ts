import {BrowserModule} from '@angular/platform-browser';
import {LOCALE_ID, NgModule} from '@angular/core';
import localeCL from '@angular/common/locales/es-CL';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {MAT_DATE_LOCALE} from '@angular/material/core';
import {APP_BASE_HREF, PlatformLocation, registerLocaleData} from '@angular/common';
import {HttpActivityInterceptor} from './core/interceptors/http-activity.interceptor';
import {LoadingService} from './services/loading.service';

registerLocaleData(localeCL);

@NgModule({
    declarations: [
        AppComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,

        HttpClientModule
    ],
    providers: [
        LoadingService,
        {
            provide: APP_BASE_HREF,
            useFactory: (s: PlatformLocation) => s.getBaseHrefFromDOM(),
            deps: [PlatformLocation]
        },
        {provide: LOCALE_ID, useValue: 'es-CL'},
        {provide: HTTP_INTERCEPTORS, useClass: HttpActivityInterceptor, multi: true},
        {provide: MAT_DATE_LOCALE, useValue: 'es-CL'},
    ],
    bootstrap: [AppComponent]
})
export class AppModule {
}
