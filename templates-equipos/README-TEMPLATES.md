# 📦 Plantillas de Rendimiento Grafana k6 para Equipos

Esta carpeta contiene **plantillas profesionales de pruebas de rendimiento listas para producción**. Han sido diseñadas para que los demás equipos del curso puedan integrarlas en sus respectivos microservicios sin tener que programar los scripts de k6 desde cero.

---

## 📑 Catálogo de Plantillas

| Archivo | Tipo de Prueba | Caso de Uso Ideal |
| :--- | :--- | :--- |
| `microservice-sla-gate.template.js` | **Quality Gate CI/CD** | Evaluar SLAs en Pull Requests (p95 < 500ms, errores < 1%). Exporta reporte HTML y JUnit XML. |
| `api-crud-flow.template.js` | **Flujo Transaccional CRUD** | APIs REST completas (POST -> GET -> PUT -> DELETE) con grupos (`group()`) y métricas de negocio (`Trend`). |
| `stress-spike-profile.template.js` | **Estrés y Picos (Spike)** | Pruebas de resiliencia con múltiples `scenarios` (`ramping-vus` y `ramping-arrival-rate`). |

---

## 🚀 ¿Cómo usar estas plantillas en tu microservicio?

### Paso 1: Copia el script a tu repositorio
Copia la plantilla que necesites a una carpeta dentro de tu repositorio (por ejemplo `tests/performance/`):

```bash
mkdir -p tests/performance
cp templates-equipos/microservice-sla-gate.template.js tests/performance/load-test.js
```

### Paso 2: Ejecuta pasando la URL y credenciales de tu API
Todas las plantillas están **100% parametrizadas** mediante variables de entorno de k6 (`__ENV` o bandera `-e`):

```bash
# Ejemplo básico apuntando a tu microservicio local
k6 run -e BASE_URL=http://localhost:8080 tests/performance/load-test.js

# Ejemplo con autenticación JWT o Token Bearer
k6 run -e BASE_URL=http://localhost:8080 -e AUTH_TOKEN="Bearer eyJhbGciOi..." tests/performance/load-test.js

# Ejemplo para api-crud-flow apuntando a la ruta de tu entidad
k6 run -e BASE_URL=http://localhost:8080 -e ENDPOINT_PATH="/api/v1/productos" tests/performance/api-crud-flow.template.js
```

### Paso 3: Personalizar el Body o Headers (Opcional)
Abre el archivo copiado y personaliza las siguientes secciones según la especificación OpenAPI / Swagger de tu equipo:

1. **Campos del JSON en peticiones POST/PUT**:
   Modifica el objeto enviado en `JSON.stringify({...})` para que coincida con el contrato de tu API.
2. **Camino de extracción del ID**:
   En `api-crud-flow.template.js`, ajusta si tu microservicio devuelve `body.id`, `body._id` o `body.data.id`.
3. **SLAs / Thresholds**:
   Si tu equipo tiene requerimientos más estrictos o flexibles (por ejemplo `p(95) < 300ms`), edita la sección `thresholds` en el objeto `options`.

---

## Reportes Generados Automáticamente

Al terminar la corrida, las plantillas generarán:
1. **Consola Interactiva**: Tabla resumen con percentiles (p90, p95, p99), tasa de error y checks.
2. **Archivo HTML**: Reporte gráfico autocontenido (`reporte-*.html`) que puedes abrir directamente con doble clic en tu navegador.
3. **JUnit XML** (`junit-results.xml` en la plantilla de CI/CD): Permite que herramientas de integración continua (GitHub Actions, GitLab CI, Jenkins) publiquen los resultados en la pestaña de Tests.
