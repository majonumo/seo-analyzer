# 🧠 Contexto y Plan: Extracción de disparidad de precios desde Google Hotels (para Claude)

## 🎯 Objetivo específico

El objetivo NO es construir un sistema completo, sino una **integración puntual** que permita:

1. Buscar un hotel en Google (ej: "hotel mahekal playa del carmen")
2. Acceder al módulo de comparación de precios (Google Hotels)
3. Expandir la sección de precios ("Ver más" / "All options")
4. Capturar screenshots únicamente de:
   - Bloque de precios patrocinados
   - Listado completo de plataformas (Booking, Expedia, etc.)
5. Enviar esas imágenes a Claude
6. Obtener un JSON limpio para analizar **disparidad de precios**

---

## ❗ Alcance (muy importante)

### ✔️ INCLUIR
- Comparador de precios
- Plataformas (OTAs)
- Precios visibles
- Elementos patrocinados

### ❌ EXCLUIR
- "Hoteles similares"
- Recomendaciones
- Reviews
- Fotos
- Mapas

👉 Solo interesa el BLOQUE de precios

---

## 🧠 Flujo esperado

```
Playwright
   ↓
Google Search
   ↓
Click en resultado (Google Hotels)
   ↓
Abrir sección "Ver más precios"
   ↓
Screenshot (zona de precios)
   ↓
Claude (visión)
   ↓
JSON estructurado
```

---

## 🤖 Paso 1: Navegación automatizada

### Acción
Buscar en Google:

```
hotel mahekal playa del carmen
```

### Luego:
- Detectar el módulo de Google Hotels
- Hacer click en el hotel

---

## 🔎 Paso 2: Acceso a precios

### Objetivo
Entrar al comparador de precios

### Acciones
- Buscar botón:
  - "Ver precios"
  - "Ver más"
  - "All options"
- Hacer click

---

## 📸 Paso 3: Captura de pantalla

### IMPORTANTE
Capturar SOLO:

1. Sección de precios patrocinados
2. Listado de OTAs con precios

### NO capturar:
- hoteles similares
- contenido inferior irrelevante

### Resultado esperado

Archivo(s):
- `prices_main.png`
- `prices_expanded.png`

---

## 🧠 Paso 4: Procesamiento con Claude

Claude recibe imágenes y debe extraer datos.

---

## ✍️ Prompt para Claude

```
Analiza esta captura de pantalla de Google Hotels enfocada en la sección de comparación de precios.

Tu tarea es:

1. Identificar todas las plataformas (Booking, Expedia, Despegar, etc.)
2. Extraer cada precio visible
3. Asociar correctamente cada precio con su plataforma
4. Detectar si un resultado es patrocinado
5. Identificar tipo de habitación si es visible

Devuelve SOLO JSON válido en este formato:

[
  {
    "platform": "",
    "price": number,
    "currency": "",
    "room_type": "",
    "sponsored": true/false
  }
]

Reglas:
- No inventar datos
- Si no estás seguro, omitir el campo
- No agregar texto fuera del JSON
```

---

## 📊 Paso 5: Objetivo final (disparidad de precios)

Con el JSON obtenido se busca:

- Detectar el precio más bajo
- Detectar el precio más alto
- Calcular diferencia porcentual
- Identificar si hay disparidad significativa

---

## ⚠️ Consideraciones clave

### 1. UI dinámica
Google cambia constantemente:
- textos
- botones
- estructura

👉 La automatización debe ser flexible

---

### 2. Bloqueos
Google puede bloquear:
- scraping repetitivo

---

### 3. Precisión IA
Claude puede:
- confundir precios
- omitir datos

👉 Mejorar con:
- screenshots más precisos

---

## 🧩 Contexto clave para Claude

Claude NO debe:
- navegar
- buscar

Claude SOLO:
- analiza imágenes
- devuelve JSON

---

## ✅ Resultado esperado

Un JSON limpio con precios por plataforma que permita detectar disparidad entre OTAs.

---

## 🧠 Insight final

Este flujo replica parcialmente el comportamiento de Google Hotels, enfocándose únicamente en la comparación de precios para detectar oportunidades o inconsistencias.

---

