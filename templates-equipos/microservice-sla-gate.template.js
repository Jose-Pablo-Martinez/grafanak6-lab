/**
 * ============================================================================
 * PLANTILLA 1: MICROSERVICE SLA GATE (QUALITY GATE PARA CI/CD)
 * ============================================================================
 * Equipo: [Nombre del Equipo]
 * Microservicio: [Nombre del Microservicio / Ej: Pagos, Notificaciones, etc.]
 *
 * USO:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 -e AUTH_TOKEN="Bearer xyz" microservice-sla-gate.template.js
 *
 * PROPÓSITO:
 *   Plantilla lista para ser copiada a cualquier repositorio de microservicio.
 *   Evalúa que las APIs cumplan los SLAs estándar de la organización:
 *    - 95% de peticiones en menos de 500ms.
 *    - Menos del 1% de errores HTTP.
 *   Exporta resumen en consola, reporte visual HTML y reporte JUnit XML para CI/CD.
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary, jUnit } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Variables de entorno configurables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'Bearer dev-token-demo';
const API_PREFIX = __ENV.API_PREFIX || '/api/v1';

export const options = {
  // Curva de carga estándar (Ramp-up -> Meseta -> Ramp-down)
  stages: [
    { duration: '1m', target: 50 },  // Calentamiento a 50 usuarios
    { duration: '2m', target: 50 },  // Carga sostenida
    { duration: '30s', target: 0 },  // Descenso ordenado
  ],

  // Quality Gates / SLAs obligatorios para aprobar el pipeline
  thresholds: {
    http_req_duration: ['p(95)<500'], // Latencia SLA p95 < 500ms
    http_req_failed: ['rate<0.01'],    // Tasa de error < 1%
  },
};

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': AUTH_TOKEN,
    'X-Correlation-ID': `k6-sla-${__VU}-${__ITER}`,
    'User-Agent': 'k6-microservice-quality-gate/1.0',
  };

  // Endpoint de verificación (Reemplazar '/recurso' por el endpoint real de su microservicio)
  const res = http.get(`${BASE_URL}${API_PREFIX}/recurso`, { headers });

  check(res, {
    'Respuesta exitosa (200 OK)': (r) => r.status === 200,
    'SLA de latencia cumplido (< 500ms)': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

/**
 * GENERACIÓN DE REPORTES TRIPLES:
 * 1. stdout: Terminal en vivo con tabla resumen.
 * 2. HTML: Reporte gráfico para inspección humana o GitHub Artifacts.
 * 3. XML (JUnit): Formato estándar consumido por pipelines (GitLab, Azure DevOps, Jenkins).
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reporte-sla-gate.html': htmlReport(data, { title: 'MICROSERVICE SLA QUALITY GATE' }),
    'junit-results.xml': jUnit(data, { name: 'k6-microservice-sla-suite' }),
  };
}
