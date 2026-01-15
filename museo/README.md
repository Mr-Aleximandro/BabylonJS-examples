# Museo 3D Interactivo (Babylon.js) - Plantilla Optimizada

Este proyecto es una plantilla profesional para crear experiencias de museos virtuales o recorridos interactivos en 3D. Está diseñado para ser **portátil**, **offline** (tras la configuración inicial) y altamente **optimizado** para alcanzar 120 FPS.

## 🚀 Características Principales

### 🎮 Control y Navegación
- **Controles Unificados**: Misma lógica de movimiento suave (inercia y aceleración) para Primera y Tercera Persona.
- **Interpolación Suave**: Movimientos de cámara y personaje fluidos con curvas de aceleración/desaceleración personalizables.
- **Vista Dual**: Alterna entre Primera y Tercera Persona con la tecla `Flecha Izquierda`.
- **Interacción**: Sistema de proximidad para interactuar con obras de arte (`Flecha Derecha`).

### 🌟 Gráficos y Efectos
- **Partículas Avanzadas**: Exhibidores en el Lobby con 10 efectos únicos (Fuego, Espiral Mágica, Lluvia Digital, Nieve, etc.).
- **Iluminación PBR**: Materiales realistas y sombras dinámicas optimizadas.
- **Modo Offline**: Si la API falla, carga automáticamente datos locales de respaldo.

### ⚡ Rendimiento
- **Room Culling**: Sistema inteligente que solo renderiza la habitación actual y sus vecinas.
- **Physics Throttling**: Cálculos de colisiones distribuidos entre frames para reducir carga de CPU.
- **Optimizaciones de Motor**: Ajustes de `skipPointerMovePicking`, `autoClear` y sombras ajustadas para máximo rendimiento.

---

## 📂 Estructura del Proyecto

```
/
├── audio/          # Efectos de sonido (pasos, ambiente)
├── css/            # Estilos de la interfaz (menús, HUD)
├── lib/            # Librerías de Babylon.js (Core, Loaders, GUI)
├── model/          # Modelos 3D (GLB, OBJ)
├── src/            # Código fuente
│   ├── World.js                # [CORE] Gestión de escena, optimización y efectos.
│   ├── Player.js               # Configuración del avatar.
│   ├── FirstPersonControls.js  # Lógica de movimiento unificada e interpolada.
│   ├── PhysicsSystem.js        # Sistema de colisiones espaciales (Spatial Hash).
│   └── AssetManager.js         # Carga de recursos.
├── textures/       # Texturas locales
├── index.html      # Punto de entrada
└── README.md       # Documentación
```

---

## 🛠️ Cómo Usar

### 1. Ejecución
Necesitas un servidor local para cargar las texturas y modelos correctamente (evitar bloqueo CORS).

**Recomendado:**
```bash
npx http-server -c-1
```
Abre `http://localhost:8080/museo/index.html`.

### 2. Controles
- **WASD**: Moverse.
- **Shift**: Correr.
- **Flecha Izquierda**: Cambiar Cámara (1ª / 3ª Persona).
- **Flecha Derecha**: Interactuar con obra cercana.
- **Flechas Arriba/Abajo**: Mirar arriba/abajo (1ª Persona).

### 3. Personalización
- **Ajustar Movimiento**: En `src/FirstPersonControls.js`, modifica `movementConfig` (acceleration, deceleration).
- **Añadir Habitaciones**: En `src/World.js` (array `FALLBACK_DATA` o vía API).

---

## 🐛 Solución de Problemas Comunes
- **Pantalla Negra**: Asegúrate de usar un servidor local (`http-server`, `live-server`) y no abrir el archivo directamente.
- **Cámara "Flip"**: Solucionado mediante lógica de actualización directa en `World.js` para 1ª persona.
- **Errores de Partículas**: Se han corregido los métodos de vectores (`copyFromFloats` -> `.set`) para compatibilidad.
