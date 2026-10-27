/**
 * ============================================================================
 * TALLER DE GRAFANA K6 - SCRIPT 02: PRUEBA DE CARGA CON SLAs (QUALITY GATE)
 * ============================================================================
 * Propósito:
 * Evaluar el comportamiento del microservicio bajo carga nominal esperada (50 VUs).
 * Valida el cumplimiento estricto de Acuerdos de Nivel de Servicio (SLAs):
 *  1. p(95) de latencia < 500ms (el 95% de las transacciones responde bajo 500ms).
 *  2. Tasa de fallo < 1% (menos del 1% de errores HTTP 4xx/5xx).
 *
 * Este script actúa como el "Quality Gate" en los pipelines de CI/CD (GitHub Actions).
 */

// Importación de módulos principales de k6
import http from 'k6/http';
import { check, sleep } from 'k6';
// Importación del helper local para reporte dual interactivo
import { createSummary } from '../lib/html-report.js';

// URL del microservicio (sobrescribible por variable de entorno __ENV.BASE_URL)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Bandera para ejecuciones ultra rápidas en entornos CI o demos en clase
const IS_QUICK = __ENV.CI_QUICK === 'true' || __ENV.CI_QUICK === '1';

// Definición dinámica de duraciones (por defecto: 1m subida, 1m meseta, 30s bajada)
const RAMP_UP_TIME = IS_QUICK ? '15s' : '1m';
const PLATEAU_TIME = IS_QUICK ? '30s' : '1m';
const RAMP_DOWN_TIME = IS_QUICK ? '10s' : '30s';

/**
 * CONFIGURACIÓN DE LA PRUEBA (options):
 * Define la curva de carga progresiva mediante Stages y los SLAs obligatorios.
 */
export const options = {
  // Escenario de Carga Progresiva (Ramp-up -> Plateau -> Ramp-down)
  stages: [
    // Etapa 1: Calentamiento y rampa de subida de 0 a 50 usuarios virtuales
    { duration: RAMP_UP_TIME, target: 50 },

    // Etapa 2: Meseta de estrés sostenido con 50 usuarios virtuales concurrentes
    { duration: PLATEAU_TIME, target: 50 },

    // Etapa 3: Rampa de enfriamiento y desconexión gradual de 50 a 0 usuarios
    { duration: RAMP_DOWN_TIME, target: 0 },
  ],

  // Criterios de Aceptación y Quality Gates (Thresholds / SLAs)
  thresholds: {
    // SLA de Rendimiento: El percentil 95 debe responder por debajo de 500ms
    http_req_duration: ['p(95)<500'],

    // SLA de Confiabilidad: El ratio de peticiones fallidas debe ser inferior al 1%
    http_req_failed: ['rate<0.01'],
  },
};

/**
 * FUNCIÓN DEFAULT:
 * Simula el flujo transaccional de un cliente real:
 *  Paso 1: Consulta catálogo de órdenes (GET).
 *  Paso 2: Genera y envía una nueva orden (POST).
 */
export default function () {
  // --------------------------------------------------------------------------
  // Paso 1: Petición GET para listar órdenes existentes
  // --------------------------------------------------------------------------
  const resGet = http.get(`${BASE_URL}/api/ordenes`, {
    headers: {
      'Accept': 'application/json',
      'X-Request-Source': 'k6-load-test',
    },
    tags: { name: 'GET_Ordenes_Catalog' },
  });

  // Validaciones del GET
  check(resGet, {
    'GET /api/ordenes retorna HTTP 200': (r) => r.status === 200,
    'GET /api/ordenes responde en menos de 500ms': (r) => r.timings.duration < 500,
  });

  // Tiempo de pensamiento simulado entre acciones (Think Time)
  sleep(0.5);

  // --------------------------------------------------------------------------
  // Paso 2: Petición POST para crear una nueva orden de compra
  // --------------------------------------------------------------------------
  const payload = JSON.stringify({
    producto: 'Monitor Curvo 34" Ultrawide',
    cantidad: Math.floor(Math.random() * 3) + 1,
  });

  const resPost = http.post(`${BASE_URL}/api/ordenes`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Request-Source': 'k6-load-test',
    },
    tags: { name: 'POST_Crear_Orden' },
  });

  // Validaciones del POST
  check(resPost, {
    'POST /api/ordenes retorna HTTP 201': (r) => r.status === 201,
    'POST /api/ordenes retorna ID generado': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.orden && typeof json.orden.id === 'string';
      } catch (e) {
        return false;
      }
    },
  });

  // Pausa de 1 segundo antes de iniciar la siguiente iteración
  sleep(1);
}

/**
 * REPORTE DUAL (CLI + HTML):
 * Imprime la tabla resumen en la consola y exporta el archivo reporte-load-sla.html
 */
export const handleSummary = createSummary('reporte-load-sla.html', {
  title: 'LOAD TEST - VERIFICACIÓN DE SLAs Y QUALITY GATE',
});
