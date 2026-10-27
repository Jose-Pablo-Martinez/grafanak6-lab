/**
 * ============================================================================
 * PLANTILLA 2: API CRUD FLOW (FLUJO TRANSACCIONAL ENCADENADO)
 * ============================================================================
 * Equipo: [Nombre del Equipo]
 * Microservicio: [Nombre del Microservicio / Ej: Usuarios, Productos, Facturación]
 *
 * USO:
 *   k6 run -e BASE_URL=http://tu-microservicio:8080 api-crud-flow.template.js
 *
 * PROPÓSITO:
 *   Demostrar el uso de:
 *   1. group(): Para segmentar y organizar las etapas de un flujo de usuario.
 *   2. Trend (Métricas personalizadas): Medir de forma aislada cuánto tarda
 *      específicamente cada operación de negocio (POST, GET, PUT, DELETE).
 *   3. Encadenamiento de respuestas: El ID generado en el POST se pasa dinámicamente
 *      al GET, PUT y DELETE.
 * ============================================================================
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// URL y parámetros configurables
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ENDPOINT_PATH = __ENV.ENDPOINT_PATH || '/api/items';

// MÉTRICAS PERSONALIZADAS (Trend): Permiten monitorear cada verbo por separado
const trendCreate = new Trend('tiempo_transaccion_create', true);
const trendGetById = new Trend('tiempo_transaccion_get_by_id', true);
const trendUpdate = new Trend('tiempo_transaccion_update', true);
const trendDelete = new Trend('tiempo_transaccion_delete', true);

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    // Umbrales globales
    http_req_failed: ['rate<0.02'], // Menos del 2% de error global

    // Umbrales por operación de negocio
    'tiempo_transaccion_create': ['p(95)<400'],     // Creación < 400ms
    'tiempo_transaccion_get_by_id': ['p(95)<200'],  // Lectura < 200ms
    'tiempo_transaccion_update': ['p(95)<300'],     // Modificación < 300ms
    'tiempo_transaccion_delete': ['p(95)<250'],     // Borrado < 250ms
  },
};

export default function apiCrudFlow() {
  const commonHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  let createdId = null;

  // --------------------------------------------------------------------------
  // GRUPO 1: Creación de Recurso (POST)
  // --------------------------------------------------------------------------
  group('01_Crear_Recurso', () => {
    const payload = JSON.stringify({
      nombre: `Item-Prueba-${__VU}-${__ITER}`,
      precio: 99.99,
      categoria: 'Hardware',
    });

    const res = http.post(`${BASE_URL}${ENDPOINT_PATH}`, payload, { headers: commonHeaders });
    trendCreate.add(res.timings.duration);

    const checkOk = check(res, {
      'POST retorna 201 Created o 200 OK': (r) => r.status === 201 || r.status === 200,
    });

    if (checkOk) {
      try {
        const body = JSON.parse(res.body);
        // Extrae el ID según la convención de la API de cada equipo (id o _id)
        createdId = body.id || body.data?.id || `temp-${Date.now()}`;
      } catch (error_) {
        console.warn(`Error al parsear respuesta JSON: ${error_.message}`);
        createdId = `temp-${Date.now()}`;
      }
    }
  });

  sleep(0.5);

  // --------------------------------------------------------------------------
  // GRUPO 2: Consulta del Recurso por ID (GET)
  // --------------------------------------------------------------------------
  if (createdId) {
    group('02_Consultar_Por_ID', () => {
      const res = http.get(`${BASE_URL}${ENDPOINT_PATH}/${createdId}`, { headers: commonHeaders });
      trendGetById.add(res.timings.duration);

      check(res, {
        'GET by ID retorna 200': (r) => r.status === 200,
      });
    });

    sleep(0.5);

    // ------------------------------------------------------------------------
    // GRUPO 3: Actualización del Recurso (PUT)
    // ------------------------------------------------------------------------
    group('03_Actualizar_Recurso', () => {
      const updatePayload = JSON.stringify({
        nombre: `Item-Actualizado-${__VU}`,
        precio: 149.99,
      });

      const res = http.put(`${BASE_URL}${ENDPOINT_PATH}/${createdId}`, updatePayload, { headers: commonHeaders });
      trendUpdate.add(res.timings.duration);

      check(res, {
        'PUT retorna 200': (r) => r.status === 200 || r.status === 204,
      });
    });

    sleep(0.5);

    // ------------------------------------------------------------------------
    // GRUPO 4: Eliminación del Recurso (DELETE)
    // ------------------------------------------------------------------------
    group('04_Eliminar_Recurso', () => {
      const res = http.del(`${BASE_URL}${ENDPOINT_PATH}/${createdId}`, null, { headers: commonHeaders });
      trendDelete.add(res.timings.duration);

      check(res, {
        'DELETE retorna 200 o 204 No Content': (r) => r.status === 200 || r.status === 204,
      });
    });
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'reporte-crud-flow.html': htmlReport(data, { title: 'FLUJO CRUD TRANSACCIONAL' }),
  };
}
