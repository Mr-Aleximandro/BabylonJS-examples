# Sistema de Colisiones y Optimización (Museo)

## Objetivos
- Colisiones estables y predecibles para el jugador.
- Escalabilidad para muchos objetos estáticos (paredes/suelos/decoración).
- Filtrado por capas (collision layers + masks).
- Broadphase rápido con spatial hashing y narrowphase delegado a Babylon (moveWithCollisions).
- Herramientas de depuración y validación de niveles (snapping + overlap checking).

## Resumen de Arquitectura

### 1) Broadphase (Spatial Hash)
Se implementa una grilla 3D de celdas (`SpatialHash`) con `cellSize` configurable.

- Inserta AABB de cada colisionador.
- Consulta por AABB alrededor del jugador para obtener candidatos.

Esto evita que el motor evalúe colisiones contra todos los meshes del mundo en cada frame.

### 2) Capas y máscaras
Cada colisionador tiene:
- `collisionLayer`: capa a la que pertenece.
- `collisionMask`: con qué capas colisiona/consulta.

En esta versión:
- `STATIC` se usa para geometría del nivel.
- `PLAYER` y `DYNAMIC` quedan listos para expansiones (NPCs, props móviles).

### 3) Narrowphase y resolución (tiempo real)
El sistema activa/desactiva `mesh.checkCollisions` solo para los candidatos cercanos al jugador (broadphase).
Luego el movimiento del jugador usa el sistema probado de Babylon:
- `mesh.moveWithCollisions(...)`

Esto da respuesta robusta sin reimplementar SAT/GJK completo, pero mantiene el rendimiento con hashing.

## Construcción de Niveles (Snapping y Validación)

### Snapping
`snapRoom()` calcula posiciones exactas para que dos habitaciones se conecten sin huecos:
- Norte/Sur: usa sumas de `depth/2`
- Este/Oeste: usa sumas de `width/2`

### Overlap Checking
Antes de instanciar geometría, se construyen AABB de cada habitación (`buildRoomAABB()`).
Luego se valida que no existan intersecciones 3D (`validateNoOverlaps()`).

Si se detecta overlap, se lanza error y se detiene el build del nivel.

## Depuración Visual
Con `F2` se activa el modo debug:
- Se crean cajas wireframe para cada AABB colisionable.
- Útil para verificar “boundaries precisas” y encontrar colisiones invisibles.

## Pruebas Unitarias
`src/UnitTests.js` ejecuta pruebas mínimas en consola:
- Intersección AABB
- Inserción/consulta/remoción de SpatialHash
- Validación básica de bitmasks de capas

Se ejecutan al cargar la app (`index.js`).

## Parámetros Ajustables
- `World.gravity`: gravedad global.
- `PhysicsSystem.nearRadius`: radio de activación de colisionadores cercanos.
- `PhysicsSystem.cellSize`: tamaño de celda del spatial hash.

## Extensiones Recomendadas (Siguiente nivel)
- Implementar capsule-vs-AABB propio para jugador (swept collisions + solver iterativo) para independencia total de Babylon.
- Introducir Octree/BSP para static geometry compleja si el nivel crece mucho.
- Agregar “triggers” (AABB sin colisión física) para eventos: audio, cinemáticas, descubrimientos.

