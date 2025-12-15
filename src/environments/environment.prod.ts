export const environment = {
  production: true,
  /**
   * En producción asumimos que la app corre bajo el mismo dominio
   * que el backend de Mis Compras, usando rutas relativas.
   */
  baseApiUrl: '/MisCompras',
  baseApiUrlV2: '/MisCompras',
  baseUrl: '/MisCompras',
  // El servicio de token sigue expuesto vía APIM; se mantiene URL absoluta
  urlToken: 'https://apim-imperial-dev-ues-001.azure-api.net/get-token/token',
  // Deprecated: se mantiene por compatibilidad, pero ya no debe usarse
  baseMisComprasApiUrl: '/MisCompras/api',
  limitDefault: 10,
  useMockOnEmpty: false
};
