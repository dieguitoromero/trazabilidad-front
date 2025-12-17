export const environment = {
  production: true,
  /**
   * URLs absolutas apuntando al APIM para asegurar que todas las llamadas
   * pasen por el gateway, independientemente de dónde esté desplegada la app.
   */
  baseApiUrl: 'https://apim-imperial-dev-ues-001.azure-api.net',
  baseApiUrlV2: 'https://apim-imperial-dev-ues-001.azure-api.net',
  baseUrl: 'https://apim-imperial-dev-ues-001.azure-api.net',
  // El servicio de token sigue expuesto vía APIM
  urlToken: 'https://apim-imperial-dev-ues-001.azure-api.net/get-token/token',
  // Deprecated: se mantiene por compatibilidad, pero ya no debe usarse
  baseMisComprasApiUrl: 'https://apim-imperial-dev-ues-001.azure-api.net',
  limitDefault: 10,
  useMockOnEmpty: false
};
