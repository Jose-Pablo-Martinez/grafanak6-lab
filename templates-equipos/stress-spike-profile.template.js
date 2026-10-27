/**
 * ============================================================================
 * PLANTILLA 3: STRESS & SPIKE PROFILE (ESCENARIOS AVANZADOS DE TRÁFICO)
 * ============================================================================
 * Equipo: [Nombre del Equipo]
 * Microservicio: [Nombre del Microservicio]
 *
 * USO:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 stress-spike-profile.template.js
 *
 * PROPÓSITO:
 *   Demostrar el poder de la API de Scenarios de k6 para modelar perfiles
 *   de tráfico del mundo real:
 *   1. Scenario 'pico_repentino' (executor: ramping-vus): Simula un aluvión repentino
 *      de usuarios (ej: Flash Sale o notificación push masiva) y evalúa si el sistema
 *      se autorecupera tras el pico.
 *   2. Scenario 'tasa_llegada_constante' (executor: ramping-arrival-rate):
 *      Modelo de Sistema Abierto (Open Model) donde el tráfico se mide en peticiones
 *      por segundo (RPS) independientemente de la latencia de la aplicación.
 * ============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TARGET_PATH = __ENV.TARGET_PATH || '/api/health';

export const options = {
  scenarios: {
    // ------------------------------------------------------------------------
    // ESCENARIO 1: Pico Repentino (Spike Test) con Ramping VUs
    // ------------------------------------------------------------------------
    pico_repentino: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },  // Carga base tibia
        { duration: '5s', target: 120 },  // DISPARO VIOLENTO a 120 usuarios en 5 segundos
        { duration: '20s', target: 120 }, // Mantiene el pico de saturación
        { duration: '10s', target: 10 },  // Caída abrupta (regreso a la normalidad)
        { duration: '15s', target: 0 },   // Enfriamiento final
      ],
      gracefulRampDown: '5s',
      exec: 'ejecutarSpike',
    },

    // ------------------------------------------------------------------------
    // ESCENARIO 2: Tasa de Llegada Controlada (Arrival Rate / Closed vs Open Model)
    // Se ejecuta después del pico para comprobar si el microservicio quedó degradado
    // ------------------------------------------------------------------------
    tasa_llegada_constante: {
      executor: 'ramping-arrival-rate',
      startTime: '65s',                  // Inicia luego de terminar el escenario 1
      startRate: 5,                      // 5 iteraciones/segundo iniciales
      timeUnit: '1s',                    // Unidad de tiempo base
      preAllocatedVUs: 20,               // Pool inicial de VUs reservados en memoria
      maxVUs: 80,                        // Límite máximo de VUs si la latencia sube
      stages: [
        { duration: '15s', target: 40 }, // Rampa hacia 40 peticiones por segundo sostenidas
        { duration: '30s', target: 40 }, // Meseta de tráfico uniforme
        { duration: '15s', target: 0 },  // Cierre ordenado
      ],
      exec: 'ejecutarArrivalRate',
    },
  },

  // Umbrales diferenciados por Escenario
  thresholds: {
    // Durante el pico, toleramos hasta 1.5s de latencia p95
    'http_req_duration{scenario:pico_repentino}': ['p(95)<1500'],
    // Durante la tasa constante, exigimos SLA nominal estricto < 500ms
    'http_req_duration{scenario:tasa_llegada_constante}': ['p(95)<500'],
    // Tolerancia máxima del 5% de error bajo condiciones extremas
    'http_req_failed': ['rate<0.05'],
  },
};

/**
 * Función ejecutada por el escenario 'pico_repentino'
 */
export function ejecutarSpike() {
  const res = http.get(`${BASE_URL}${TARGET_PATH}`, {
    tags: { profile: 'spike' },
  });

  check(res, {
    'Spike: status es 200 o 429/503 controlado': (r) =>
      r.status === 200 || r.status === 429 || r.status === 503,
  });

  sleep(0.5);
}

/**
 * Función ejecutada por el escenario 'tasa_llegada_constante'
 */
export function ejecutarArrivalRate() {
  const res = http.get(`${BASE_URL}${TARGET_PATH}`, {
    tags: { profile: 'arrival_rate' },
  });

  check(res, {
    'ArrivalRate: respuesta 200 OK nominal': (r) => r.status === 200,
  });
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reporte-stress-spike.html': htmlReport(data, { title: 'PERFIL DE ESTRÉS Y PICOS DE CARGA' }),
  };
}
