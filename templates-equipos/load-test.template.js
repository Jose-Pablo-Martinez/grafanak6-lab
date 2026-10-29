/**
 * ============================================================================
 * PLANTILLA: LOAD TEST (PRUEBA DE CARGA NOMINAL CON SLAs)
 * ============================================================================
 * Equipo: [Nombre del Equipo]
 * Microservicio: [Nombre del Microservicio / Ej: Catálogo, Pedidos, etc.]
 *
 * USO BÁSICO:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 load-test.template.js
 *
 * USO CON PARAMETRIZACIÓN AVANZADA:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 -e TARGET_VUS=60 -e AUTH_TOKEN="Bearer xyz" load-test.template.js
 *
 * PROPÓSITO:
 *   Evaluar el comportamiento del microservicio bajo el volumen de tráfico
 *   esperado en condiciones normales de producción (carga nominal).
 *   Valida los Acuerdos de Nivel de Servicio (SLAs / Quality Gates):
 *    - 95% de las transacciones bajo 500ms (p95 < 500ms).
 *    - Menos del 1% de errores HTTP (rate < 0.01).
 *   Exporta resumen en consola, reporte visual HTML y reporte JUnit XML para CI/CD.
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary, jUnit } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Variables de entorno parametrizables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ENDPOINT_PATH = __ENV.ENDPOINT_PATH || '/api/v1/recurso';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Configuración de la curva de carga
const TARGET_VUS = Number.parseInt(__ENV.TARGET_VUS || '50', 10);
const RAMP_UP = __ENV.RAMP_UP || '1m';
const PLATEAU = __ENV.PLATEAU || '2m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '30s';

export const options = {
  // Curva de carga estándar de 3 etapas
  stages: [
    { duration: RAMP_UP, target: TARGET_VUS },   // Rampa de subida (calentamiento)
    { duration: PLATEAU, target: TARGET_VUS },   // Carga nominal sostenida (meseta)
    { duration: RAMP_DOWN, target: 0 },          // Rampa de descenso (enfriamiento ordenado)
  ],

  // Quality Gates / SLAs obligatorios para aprobar la prueba
  thresholds: {
    // SLA de latencia: el 95% de las peticiones debe tardar menos de 500ms
    http_req_duration: ['p(95)<500'],
    // SLA de confiabilidad: menos del 1% de fallos
    http_req_failed: ['rate<0.01'],
  },
};

export default function loadTestTemplate() {
  const commonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Correlation-ID': `k6-load-${__VU}-${__ITER}`,
    'User-Agent': 'k6-load-test-template/1.0',
  };

  if (AUTH_TOKEN) {
    commonHeaders['Authorization'] = AUTH_TOKEN;
  }

  // 1. Petición GET: Consulta de recursos (lectura)
  const resGet = http.get(`${BASE_URL}${ENDPOINT_PATH}`, {
    headers: commonHeaders,
    tags: { action: 'read_list' },
  });

  check(resGet, {
    'GET retorna 200 OK': (r) => r.status === 200,
    'GET cumple SLA de latencia (< 500ms)': (r) => r.timings.duration < 500,
  });

  // Tiempo de pensamiento humano simulado (Think Time)
  sleep(0.5);

  // 2. Petición POST: Creación de recurso (escritura)
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    origen: 'k6-load-test',
    identificador: `VU-${__VU}-IT-${__ITER}`,
  });

  const resPost = http.post(`${BASE_URL}${ENDPOINT_PATH}`, payload, {
    headers: commonHeaders,
    tags: { action: 'create_record' },
  });

  check(resPost, {
    'POST retorna 201 Created o 200 OK': (r) => r.status === 201 || r.status === 200,
    'POST dentro de SLA (< 500ms)': (r) => r.timings.duration < 500,
  });

  // Pausa entre 1s y 1.5s antes del siguiente ciclo del usuario virtual
  sleep(1);
}

/**
 * Reportes Triples: Consola + HTML interactivo + JUnit XML para pipelines
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reporte-load-template.html': htmlReport(data, { title: 'TEMPLATE: LOAD TEST (CARGA NOMINAL CON SLAs)' }),
    'junit-load-results.xml': jUnit(data, { name: 'k6-load-test-suite' }),
  };
}

