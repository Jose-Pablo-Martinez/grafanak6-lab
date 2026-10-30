# 📦 Plantillas de Rendimiento Grafana k6 para Equipos

Esta carpeta contiene **plantillas profesionales de pruebas de rendimiento listas para producción**. Han sido diseñadas para que los demás equipos del curso puedan integrarlas en sus respectivos microservicios sin tener que programar los scripts de k6 desde cero.

Cubren los **4 Tipos Canónicos de Pruebas No Funcionales de Rendimiento** (según el Modelo en V de Verificación y Validación de Software), más plantillas complementarias para flujos transaccionales y pipelines CI/CD.

---

## 📑 Catálogo de los 4 Casos Esenciales de Prueba

| # | Tipo de Prueba | Archivo de Plantilla | Carga & Duración Típica | Objetivo Principal |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Smoke Test** *(Prueba de Humo)* | `smoke-test.template.js` | 1 - 5 VUs / 30s | **Sanity Check:** Verificar que el microservicio está vivo, bien configurado y que los endpoints responden antes de correr pruebas mayores. |
| **2** | **Load Test** *(Prueba de Carga Nominal)* | `load-test.template.js` | 50 VUs / 3 - 5 min | **Cumplimiento de SLAs:** Evaluar el microservicio bajo el volumen de usuarios esperado en producción ($p95 < 500\text{ms}$, error $<1\%$). |
| **3** | **Stress / Spike Test** *(Estrés y Picos)* | `stress-spike-profile.template.js` | 100 - 200+ VUs / Picos | **Punto de Ruptura (Breaking Point):** Descubrir los límites máximos del sistema, contención de base de datos y capacidad de auto-recuperación. |
| **4** | **Soak Test** *(Resistencia / Endurance)* | `soak-test.template.js` | 25 - 35 VUs / 15m - 4h | **Estabilidad en el Tiempo:** Detectar fugas de memoria (*memory leaks*), fugas de conexiones en el pool (*connection leaks*) y degradación paulatina. |

### 🛠️ Plantillas Complementarias
- **`microservice-sla-gate.template.js`**: Plantilla especializada para **Quality Gate en CI/CD** con exportación triple (Terminal stdout + HTML visual + **JUnit XML** para GitHub Actions / GitLab).
- **`api-crud-flow.template.js`**: Plantilla de **Flujo Transaccional Encadenado** (POST $\rightarrow$ GET $\rightarrow$ PUT $\rightarrow$ DELETE) usando `group()` y métricas personalizadas `Trend`.

---

## 🚀 ¿Cómo usar estas plantillas en tu microservicio?

### Paso 1: Copia la plantilla que necesites a tu repositorio
Copia el script a la carpeta de pruebas de tu proyecto (por ejemplo `tests/performance/`):

```bash
# Ejemplo: Copiar la prueba de carga
mkdir -p tests/performance
cp templates-equipos/load-test.template.js tests/performance/load-test.js
```

### Paso 2: Ejecución parametrizada (100% configurable)
Todas las plantillas están parametrizadas con variables de entorno de k6 (`__ENV` o bandera `-e`). No necesitas modificar el código para cambiar URLs, usuarios o tiempos:

#### 1. Ejecutar Smoke Test (Prueba de Humo)
```bash
# Básico
k6 run -e BASE_URL=http://localhost:8080 smoke-test.template.js

# Con ruta de salud personalizada y token
k6 run -e BASE_URL=http://localhost:8080 -e HEALTH_PATH=/health -e AUTH_TOKEN="Bearer xyz" smoke-test.template.js
```

#### 2. Ejecutar Load Test (Prueba de Carga con SLAs)
```bash
# Con 50 VUs nominales (por defecto)
k6 run -e BASE_URL=http://localhost:8080 -e ENDPOINT_PATH=/api/v1/productos load-test.template.js

# Ajustando a 80 VUs
k6 run -e BASE_URL=http://localhost:8080 -e TARGET_VUS=80 load-test.template.js
```

#### 3. Ejecutar Stress & Spike Test (Estrés y Picos)
```bash
k6 run -e BASE_URL=http://localhost:8080 -e TARGET_PATH=/api/v1/ordenes stress-spike-profile.template.js
```

#### 4. Ejecutar Soak Test (Prueba de Resistencia / Endurance)
```bash
# Corrida rápida de resistencia (15 minutos por defecto para demos de laboratorio)
k6 run -e BASE_URL=http://localhost:8080 -e ENDPOINT_PATH=/api/v1/ordenes soak-test.template.js

# Corrida de larga duración (ej. 1 hora con 35 VUs)
k6 run -e BASE_URL=http://localhost:8080 -e SOAK_DURATION=1h -e TARGET_VUS=35 soak-test.template.js
```

---

## ⚙️ Paso 3: Personalización Opcional del Contrato (Body y Headers)
Abre el archivo copiado en tu editor y personaliza las siguientes secciones según el contrato de tu microservicio:

1. **Campos del JSON en peticiones POST/PUT**:
   Modifica el objeto enviado en `JSON.stringify({...})` para que coincida con el esquema esperado por tu endpoint.
2. **Camino de extracción de identificadores**:
   En flujos encadenados (`api-crud-flow.template.js`), ajusta si tu API responde con `body.id`, `body._id` o `body.data.id`.
3. **Thresholds y SLAs**:
   Si tu equipo tiene acuerdos más estrictos (por ejemplo $p95 < 250\text{ms}$ o tasa de fallo $< 0.5\%$), edita el objeto `thresholds` en `options`.

---

## 📊 Reportes Generados Automáticamente

Al terminar la corrida, cada plantilla generará:
1. **Consola Interactiva (`stdout`)**: Tabla resumen con percentiles ($p90, p95, p99$), tasa de error y checks.
2. **Archivo HTML Autocontenido (`reporte-*.html`)**: Reporte interactivo con gráficos que puedes abrir directamente con doble clic en tu navegador.
3. **JUnit XML** (`junit-*.xml` en las plantillas de Load y CI/CD): Permite que pipelines como GitHub Actions, GitLab CI o Jenkins publiquen los resultados en la pestaña de pruebas.
