/**
 * API Simulación de Microservicio de Órdenes
 * Diseñada para talleres de Performance Testing y Quality Gates con Grafana k6.
 * Simula contención en pool de conexiones y latencia progresiva según concurrencia activa.
 */

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware para parsear cuerpos JSON
app.use(express.json());

// Contador en memoria de peticiones HTTP activas concurrentes
let activeRequests = 0;

// Middleware para rastrear la concurrencia en tiempo real
app.use((req, res, next) => {
  activeRequests++;
  const cleanup = () => {
    res.removeListener('finish', cleanup);
    res.removeListener('close', cleanup);
    activeRequests = Math.max(0, activeRequests - 1);
  };
  res.on('finish', cleanup);
  res.on('close', cleanup);
  next();
});

// Función utilitaria para generar delays aleatorios
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Almacén en memoria de órdenes para la demostración
const ordenesDb = [
  { id: 'ORD-1001', producto: 'Laptop Gamer X1', cantidad: 1, estado: 'completada' },
  { id: 'ORD-1002', producto: 'Monitor 4K 27"', cantidad: 2, estado: 'en_proceso' },
  { id: 'ORD-1003', producto: 'Teclado Mecánico RGB', cantidad: 3, estado: 'enviada' }
];

/**
 * GET /api/health
 * Endpoint de Caja Negra / Healthcheck sin dependencia de base de datos.
 * Diseñado para responder ultra rápido (~5ms) y demostrar aislamiento de fallos:
 * mientras /api/ordenes colapsa bajo estrés, /api/health se mantiene verde.
 */
app.get('/api/health', async (req, res) => {
  await sleep(5);
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeRequests,
    uptime: process.uptime()
  });
});

/**
 * GET /api/ordenes
 * Simula consulta intensiva a Base de Datos con contención en Connection Pool:
 * - Baja concurrencia (activeRequests <= 15): 40ms - 120ms (Comportamiento nominal).
 * - Concurrencia media (16 a 35): 200ms - 450ms (Contención moderada < 500ms SLA).
 * - Alta concurrencia (> 35): 600ms - 2200ms y 5% de error 500 (Punto de Ruptura / Breaking Point).
 */
app.get('/api/ordenes', async (req, res) => {
  const currentConcurrency = activeRequests;
  let delay = 0;
  let shouldFail = false;

  if (currentConcurrency <= 15) {
    // Escenario 1: Tráfico normal / nominal
    delay = randomBetween(40, 120);
  } else if (currentConcurrency <= 35) {
    // Escenario 2: Carga moderada con contención de conexiones en el pool
    delay = randomBetween(200, 450);
  } else {
    // Escenario 3: Saturación crítica / Breaking point
    delay = randomBetween(600, 2200);
    // 5% de probabilidad de error de conexión a la base de datos
    shouldFail = Math.random() < 0.05;
  }

  await sleep(delay);

  if (shouldFail) {
    return res.status(500).json({
      error: 'Database connection pool exhausted',
      activeRequests: currentConcurrency,
      simulatedLatencyMs: delay,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({
    data: ordenesDb,
    total: ordenesDb.length,
    activeRequests: currentConcurrency,
    simulatedLatencyMs: delay,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/ordenes
 * Simula creación transaccional de una orden:
 * Valida datos de entrada (400 si faltan) y simula persistencia (201 Created).
 */
app.post('/api/ordenes', async (req, res) => {
  const { producto, cantidad } = req.body || {};

  if (!producto || cantidad === undefined || cantidad === null) {
    return res.status(400).json({
      error: 'Solicitud inválida. Se requiere { producto, cantidad }',
      received: req.body
    });
  }

  // Latencia de persistencia transaccional moderada
  const delay = randomBetween(30, 90);
  await sleep(delay);

  const nuevaOrden = {
    id: `ORD-${Date.now().toString().slice(-4)}-${randomBetween(100, 999)}`,
    producto: String(producto),
    cantidad: Number(cantidad),
    estado: 'creada',
    createdAt: new Date().toISOString()
  };

  ordenesDb.push(nuevaOrden);

  return res.status(201).json({
    mensaje: 'Orden creada exitosamente',
    orden: nuevaOrden,
    activeRequests,
    simulatedLatencyMs: delay
  });
});

// Inicio del servidor
const server = app.listen(PORT, () => {
  console.log(`[API Microservicio] Servidor escuchando en http://localhost:${PORT}`);
  console.log(`[API Microservicio] Endpoints:`);
  console.log(`  - GET  /api/health   (Caja negra / Aislamiento, ~5ms)`);
  console.log(`  - GET  /api/ordenes  (Simulación DB con contención progresiva)`);
  console.log(`  - POST /api/ordenes  (Creación de órdenes, validación 400/201)`);
});

module.exports = { app, server };
