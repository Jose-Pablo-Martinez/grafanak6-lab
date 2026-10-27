/**
 * ============================================================================
 * TALLER DE GRAFANA K6 - SCRIPT 01: SMOKE TEST (PRUEBA DE HUMO)
 * ============================================================================
 * Propósito:
 * Verificar rápidamente que el microservicio está en pie y que los endpoints
 * básicos responden sin errores bajo una carga mínima antes de ejecutar pruebas
 * más pesadas (evita malgastar recursos si el sistema tiene errores de sintaxis o despliegue).
 */

// Importación de módulos esenciales del core de k6
import http from 'k6/http';
import { check, sleep } from 'k6';
// Importación del helper local para reporte dual (CLI + HTML)
import { createSummary } from '../lib/html-report.js';

// URL base parametrizable mediante variables de entorno (por defecto localhost:3000)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * CONFIGURACIÓN DE LA PRUEBA (options):
 * Define la intensidad, duración y criterios de aceptación (SLAs / Quality Gates).
 */
export const options = {
  // Cantidad fija de Usuarios Virtuales (VUs) concurrentes para una prueba de humo
  vus: 5,

  // Duración corta suficiente para validar disponibilidad (15 segundos)
  duration: '15s',

  // Criterios de Aceptación (Thresholds):
  // Si no se cumple, k6 finaliza con código de error (exit code != 0), bloqueando el pipeline.
  thresholds: {
    // El 95% de las peticiones debe responder en menos de 200 milisegundos
    http_req_duration: ['p(95)<200'],
    // La tasa de error debe ser exactamente 0% durante el smoke test
    http_req_failed: ['rate==0'],
  },
};

/**
 * FUNCIÓN DEFAULT:
 * Código que ejecuta cada Usuario Virtual (VU) en bucle continuo durante los 15s.
 */
export default function smokeTest() {
  // --------------------------------------------------------------------------
  // 1. Verificación del endpoint de salud (Health Check)
  // --------------------------------------------------------------------------
  const resHealth = http.get(`${BASE_URL}/api/health`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'HealthCheck' },
  });

  // Validaciones lógicas (Checks) sobre la respuesta de salud
  check(resHealth, {
    'GET /api/health responde status 200': (r) => r.status === 200,
    'GET /api/health contiene status "ok"': (r) => {
      try {
        return JSON.parse(r.body).status === 'ok';
      } catch (error_) {
        console.warn(`Healthcheck parse error: ${error_.message}`);
        return false;
      }
    },
  });

  // Pausa corta para simular comportamiento humano (Think Time)
  sleep(0.5);

  // --------------------------------------------------------------------------
  // 2. Verificación del endpoint principal de órdenes
  // --------------------------------------------------------------------------
  const resOrdenes = http.get(`${BASE_URL}/api/ordenes`, {
    headers: { 'Accept': 'application/json' },
    tags: { name: 'GetOrdenes' },
  });

  // Validaciones lógicas sobre la consulta de órdenes
  check(resOrdenes, {
    'GET /api/ordenes responde status 200': (r) => r.status === 200,
    'GET /api/ordenes retorna arreglo con datos': (r) => {
      try {
        const json = JSON.parse(r.body);
        return Array.isArray(json.data) && json.data.length > 0;
      } catch (error_) {
        console.warn(`Error al validar catálogo de órdenes: ${error_.message}`);
        return false;
      }
    },
  });

  // Pausa de 1 segundo entre iteraciones de cada usuario virtual
  sleep(1);
}

/**
 * REPORTE DUAL (CLI + HTML):
 * Genera la tabla en terminal y exporta el archivo reporte-smoke.html
 */
export const handleSummary = createSummary('reporte-smoke.html', {
  title: 'SMOKE TEST - VERIFICACIÓN DE DISPONIBILIDAD',
});
