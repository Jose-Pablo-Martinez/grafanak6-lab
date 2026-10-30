/**
 * ============================================================================
 * PLANTILLA: SOAK TEST (PRUEBA DE RESISTENCIA / ENDURANCE)
 * ============================================================================
 * Equipo: [Nombre del Equipo]
 * Microservicio: [Nombre del Microservicio / Ej: Inventario, Facturación, etc.]
 *
 * USO BÁSICO:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 soak-test.template.js
 *
 * USO CON DURACIÓN PERSONALIZADA (ej. 30 minutos o 2 horas):
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 -e SOAK_DURATION=30m -e TARGET_VUS=25 soak-test.template.js
 *
 * PROPÓSITO:
 *   Someter el microservicio a una carga moderada y constante (~60%-80% de su
 *   capacidad nominal) durante un período prolongado (horas en pre-producción,
 *   o 10m-30m en talleres y demos) para detectar problemas acumulativos en el tiempo:
 *    1. Fugas de Memoria (Memory Leaks): Heap que crece continuamente sin liberarse.
 *    2. Agotamiento paulatino del Connection Pool de Base de Datos (Connection Leaks).
 *    3. Agotamiento de descriptores de socket/archivos del sistema operativo.
 *    4. Degradación de rendimiento acumulada (Performance Drift / fragmentación).
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Variables de entorno parametrizables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ENDPOINT_PATH = __ENV.ENDPOINT_PATH || '/api/v1/recurso';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

// Carga moderada y duración prolongada
// NOTA: Para demostraciones en clase se sugiere '10m' a '15m'.
// En pipelines nocturnos de pre-producción se configuran '2h', '4h' o '8h'.
const TARGET_VUS = Number.parseInt(__ENV.TARGET_VUS || '30', 10);
const RAMP_UP = __ENV.RAMP_UP || '2m';
const SOAK_DURATION = __ENV.SOAK_DURATION || '15m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '1m';

// Métrica personalizada para auditar si la latencia sufre degradación con el tiempo
const trendEnduranceLatency = new Trend('latencia_soak_sostenida', true);

export const options = {
  stages: [
    // 1. Rampa suave hacia la carga de resistencia
    { duration: RAMP_UP, target: TARGET_VUS },

    // 2. Meseta prolongada de resistencia (Soak Stage)
    { duration: SOAK_DURATION, target: TARGET_VUS },

    // 3. Rampa de descenso gradual
    { duration: RAMP_DOWN, target: 0 },
  ],

  // Thresholds de resistencia: el sistema NO debe degradarse ni aumentar fallos con el paso de las horas
  thresholds: {
    // Tasa de fallo estricta: menor al 1% acumulado a lo largo de toda la prueba
    http_req_failed: ['rate<0.01'],

    // SLAs de latencia: el percentil 95 debe mantenerse estable bajo 500ms
    http_req_duration: ['p(95)<500'],

    // SLA de percentil 99 para evitar que peticiones rezagadas se disparen por acumulación de basura
    'latencia_soak_sostenida': ['p(99)<800'],
  },
};

export default function soakTestTemplate() {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Correlation-ID': `k6-soak-${__VU}-${__ITER}`,
    'User-Agent': 'k6-soak-test-template/1.0',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = AUTH_TOKEN;
  }

  // Petición transaccional sostenida
  const res = http.get(`${BASE_URL}${ENDPOINT_PATH}`, {
    headers,
    tags: { stage: 'soak_sustained' },
  });

  // Registro de latencia en la métrica Trend de resistencia
  trendEnduranceLatency.add(res.timings.duration);

  // Verificaciones lógicas continuas
  check(res, {
    'Soak: HTTP responde 200 OK': (r) => r.status === 200,
    'Soak: Latencia nominal tolerada (< 500ms)': (r) => r.timings.duration < 500,
  });

  // Pausa moderada entre iteraciones para simular consumo real sostenido
  sleep(1);
}

/**
 * Reporte dual: consola stdout + reporte visual interactivo
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reporte-soak-template.html': htmlReport(data, {
      title: `TEMPLATE: SOAK TEST (RESISTENCIA - ${SOAK_DURATION})`,
    }),
  };
}

