/**
 * ============================================================================
 * TALLER DE GRAFANA K6 - SCRIPT 03: PRUEBA DE ESTRÉS Y PUNTO DE RUPTURA
 * ============================================================================
 * Propósito:
 * Empujar el microservicio más allá de su capacidad nominal (escalando a 100 y 200 VUs)
 * para identificar su "Punto de Ruptura" (Breaking Point) y demostrar la técnica
 * de AISLAMIENTO DE CAJA NEGRA:
 *
 *  - Endpoint /api/health (CPU / Event Loop puro): Se mantiene < 100ms y 100% exitoso (VERDE).
 *  - Endpoint /api/ordenes (Pool de Base de Datos): Sufre contención severa > 600ms - 2200ms
 *    y arroja errores 500 por agotamiento de conexiones (ROJO ✗).
 *
 * Permite a los estudiantes responder: "¿Qué componente colapsó primero y por qué?".
 */

// Importación de funciones centrales de k6
import http from 'k6/http';
import { check, sleep } from 'k6';
// Importación del helper para generación dual (CLI stdout + reporte HTML visual)
import { createSummary } from '../lib/html-report.js';

// URL del microservicio bajo prueba
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Bandera para ajustar duración en demostraciones rápidas de clase
const IS_QUICK = __ENV.CI_QUICK === 'true' || __ENV.CI_QUICK === '1';

/**
 * CONFIGURACIÓN DE LA PRUEBA (options):
 * Define la rampa de estrés agresivo y los Thresholds segmentados por TAG.
 */
export const options = {
  // Escalada progresiva para encontrar el punto de degradación
  stages: [
    // 1. Carga nominal moderada (50 usuarios)
    { duration: IS_QUICK ? '10s' : '30s', target: 50 },

    // 2. Zona de saturación (100 usuarios)
    { duration: IS_QUICK ? '15s' : '45s', target: 100 },

    // 3. Punto de ruptura extremo (200 usuarios concurrentes)
    { duration: IS_QUICK ? '20s' : '45s', target: 200 },

    // 4. Enfriamiento y recuperación del sistema
    { duration: IS_QUICK ? '10s' : '20s', target: 0 },
  ],

  // Thresholds con aislamiento por TAG (Métricas por Endpoint)
  thresholds: {
    // Aislamiento: /api/health NO toca base de datos, debe responder en < 100ms
    'http_req_duration{endpoint:health}': ['p(95)<100'],
    'http_req_failed{endpoint:health}': ['rate==0'],

    // Punto de ruptura esperado: /api/ordenes sufrirá contención en el pool DB
    // Este umbral FALLARÁ intencionalmente en la consola (marcado con ✗),
    // demostrando visualmente a los alumnos el cuello de botella arquitectónico.
    'http_req_duration{endpoint:ordenes_db}': ['p(95)<500'],
    'http_req_failed{endpoint:ordenes_db}': ['rate<0.01'],
  },
};

/**
 * FUNCIÓN DEFAULT:
 * Ejecuta alternadamente peticiones a ambos endpoints etiquetándolos con TAGS
 * para que k6 desglose las métricas de forma independiente.
 */
export default function () {
  // --------------------------------------------------------------------------
  // 1. Petición al Endpoint de Aislamiento / Health (Tags: endpoint: 'health')
  // --------------------------------------------------------------------------
  const resHealth = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: 'health' },
    headers: { 'Accept': 'application/json' },
  });

  // Validaciones del endpoint ligero
  check(resHealth, {
    'Healthcheck responde 200 OK': (r) => r.status === 200,
    'Healthcheck responde ultra rápido (< 50ms)': (r) => r.timings.duration < 50,
  });

  // Breve pausa para no sobrecargar el hilo de pruebas
  sleep(0.3);

  // --------------------------------------------------------------------------
  // 2. Petición al Endpoint con Base de Datos (Tags: endpoint: 'ordenes_db')
  // --------------------------------------------------------------------------
  const resOrdenes = http.get(`${BASE_URL}/api/ordenes`, {
    tags: { endpoint: 'ordenes_db' },
    headers: { 'Accept': 'application/json' },
  });

  // Validaciones del endpoint con cuello de botella simulado
  check(resOrdenes, {
    'Órdenes DB responde exitosamente (200)': (r) => r.status === 200,
    'Órdenes DB dentro de SLA (< 500ms)': (r) => r.timings.duration < 500,
  });

  // Pausa entre 0.5s y 1s para simular variabilidad de usuarios
  sleep(0.5);
}

/**
 * REPORTE DUAL (CLI + HTML):
 * Muestra el colapso en consola y genera el reporte visual interactivo reporte-stress.html
 */
export const handleSummary = createSummary('reporte-stress.html', {
  title: 'STRESS TEST - EXPERIMENTO DE ROTURA Y AISLAMIENTO (100-200 VUs)',
});
