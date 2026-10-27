/**
 * ============================================================================
 * tests/lib/html-report.js
 * Helper para Generación Dual de Reportes en Grafana k6:
 * 1. CLI Stdout clásico con colores y tabla resumen intacta.
 * 2. Reporte HTML interactivo y autocontenido (benc-uk/k6-reporter).
 * ============================================================================
 */

import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

/**
 * Crea la función `handleSummary` para scripts de k6.
 * Al finalizar la ejecución, k6 invoca automáticamente handleSummary(data).
 *
 * @param {string} reportName - Nombre del archivo HTML a generar (ej. 'reporte-smoke.html')
 * @param {object} [options] - Opciones opcionales para personalizar el reporte
 * @returns {Function} Función handleSummary(data) compatible con el runtime de k6
 */
export function createSummary(reportName, options = {}) {
  const title = options.title || reportName.replace('.html', '').toUpperCase();

  return function handleSummary(data) {
    return {
      // 1. Mantiene la tabla clásica en la terminal (stdout) con colores
      'stdout': textSummary(data, { indent: ' ', enableColors: true }),

      // 2. Genera el archivo HTML autocontenido con diseño moderno y métricas
      [reportName]: htmlReport(data, { title: title, ...options }),
    };
  };
}

export default createSummary;
