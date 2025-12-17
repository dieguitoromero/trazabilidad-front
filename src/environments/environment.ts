export const environment = {
  production: false,
  /**
   * Rutas relativas para usar con proxy de Angular (proxy.conf.json)
   * y evitar dependencias directas a hosts externos (APIM).
   */
  baseApiUrl: "https://apim-imperial-dev-ues-001.azure-api.net",
  baseApiUrlV2: "https://apim-imperial-dev-ues-001.azure-api.net",
  baseUrl: "https://apim-imperial-dev-ues-001.azure-api.net",
  // El servicio de token sigue expuesto vía APIM; se mantiene URL absoluta
  urlToken: "https://apim-imperial-dev-ues-001.azure-api.net/get-token/token",
  // Deprecated: se mantiene por compatibilidad, pero ya no debe usarse
  baseMisComprasApiUrl: "https://apim-imperial-dev-ues-001.azure-api.net",
  limitDefault: 10,
  useMockOnEmpty: false
};
