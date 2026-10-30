/**
 * ============================================================================
 * PLANTILLA: SMOKE TEST (PRUEBA DE HUMO / SANITY CHECK)
 * ============================================================================
 * Equipo: [Nombre del Equipo]
 * Microservicio: [Nombre del Microservicio / Ej: Pagos, Usuarios, etc.]
 *
 * USO BÁSICO:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 smoke-test.template.js
 *
 * USO CON AUTENTICACIÓN Y RUTA ESPECÍFICA:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 -e HEALTH_PATH=/health -e AUTH_TOKEN="Bearer xyz" smoke-test.template.js
 *
 * PROPÓSITO:
 *   Verificación rápida y de bajísimo impacto (1 a 5 usuarios virtuales durante 30s)
 *   para comprobar que el microservicio está desplegado, configurado y respondiendo
 *   correctamente antes de invertir tiempo y recursos en pruebas de carga pesadas.
 *   Si el Smoke Test falla, no tiene sentido ejecutar Load, Stress o Soak.
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Variables de entorno parametrizables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const HEALTH_PATH = __ENV.HEALTH_PATH || '/api/health';
const RESOURCE_PATH = __ENV.RESOURCE_PATH || '/api/v1/recurso';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const TEST_DURATION = __ENV.DURATION || '30s';
const VUS_COUNT = Number.parseInt(__ENV.VUS || '3', 10);

export const options = {
  // Carga mínima de verificación
  vus: VUS_COUNT,
  duration: TEST_DURATION,

  // Criterios de aceptación estrictos: en un smoke test NO debe haber fallos
  thresholds: {
    // 100% de peticiones exitosas (cero tolerancia a fallos en prueba de humo)
    http_req_failed: ['rate==0'],
    // Respuesta rápida nominal para endpoints básicos
    http_req_duration: ['p(95)<300'],
  },
};

export default function smokeTestTemplate() {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'k6-smoke-test-template/1.0',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = AUTH_TOKEN;
  }

  // 1. Verificación del endpoint de disponibilidad / salud
  const resHealth = http.get(`${BASE_URL}${HEALTH_PATH}`, {
    headers,
    tags: { check: 'health' },
  });

  check(resHealth, {
    'Healthcheck responde status 200': (r) => r.status === 200,
    'Healthcheck responde en menos de 200ms': (r) => r.timings.duration < 200,
  });

  sleep(0.5);

  // 2. Verificación de lectura básica en endpoint de negocio
  const resResource = http.get(`${BASE_URL}${RESOURCE_PATH}`, {
    headers,
    tags: { check: 'resource_read' },
  });

  check(resResource, {
    'Recurso responde status exitoso (200 o 204)': (r) => r.status === 200 || r.status === 204,
  });

  sleep(1);
}

/**
 * Reporte dual: terminal con colores + HTML autocontenido
 */
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reporte-smoke-template.html': htmlReport(data, { title: 'TEMPLATE: SMOKE TEST' }),
  };
}

