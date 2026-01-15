# Esquema de Base de Datos Propuesto (Museo Interactivo)

## Principios
- Normalización moderada (3FN) con campos JSON para configuraciones flexibles.
- Auditoría básica (created_at, updated_at, created_by).
- Soporte multiespacio, multihabitación, multi-item y efectos configurables.
- Preparado para internacionalización (i18n) y versionado de contenido.

## Tablas Núcleo

- usuario
  - id (PK, int)
  - email (varchar 120, único)
  - password_hash (varchar 255)
  - name (varchar 60)
  - lastname (varchar 60)
  - birth (date, null)
  - sex (enum: male,female,other, null)
  - level (int, default 1)
  - first_session (datetime, null)
  - last_session (datetime, null)
  - id_status (FK -> status.id)
  - id_role (FK -> role.id)
  - created_at (datetime)
  - updated_at (datetime)

- user_settings
  - id (PK, int)
  - id_usuario (FK -> usuario.id)
  - settings (json)  // brillo, volumen, sensibilidad, cámara, idioma, etc.
  - created_at (datetime)
  - updated_at (datetime)

- role
  - id (PK, int)
  - name (varchar 30) // admin, editor, viewer
  - description (varchar 200, null)

- type
  - id (PK, int)
  - type (varchar 30, único)
  - description (varchar 200, null)
  - parent_type_id (FK -> type.id, null) // jerarquía opcional

- status
  - id (PK, int)
  - status (varchar 30)
  - description (varchar 200, null)
  - id_type (FK -> type.id) // estados por tipo (e.g., item: draft, published)

## Espacios y Salas

- space
  - id (PK, int)
  - name (varchar 80)
  - slug (varchar 100, único) // test, museo-central
  - description (text)
  - img (varchar 200, null)  // portada
  - id_type (FK -> type.id)  // e.g., 'space'
  - id_usuario (FK -> usuario.id) // propietario/creador
  - id_status (FK -> status.id)
  - meta (json, null) // tags, ambientación, reglas globales
  - created_at (datetime)
  - updated_at (datetime)

- room
  - id (PK, int)
  - id_space (FK -> space.id)
  - name (varchar 80)
  - slug (varchar 100, único por espacio)
  - description (text, null)
  - floor (int) // niveles: 0 = PB, -1 sótano, 1 planta alta
  - dimensions (json) // {w,h,d}
  - position (json) // {x,y,z} relativo al space
  - doors (json) // [{side:'north', offset:0, width:8, height:7}]
  - materials (json) // {wall:'asphalt_06_', floor:'floor_onyx', ceiling:'plaster'}
  - lighting (json) // configuración luz por sala
  - id_status (FK -> status.id)
  - created_at (datetime)
  - updated_at (datetime)

- room_connection
  - id (PK, int)
  - id_room_a (FK -> room.id)
  - id_room_b (FK -> room.id)
  - type (varchar 30) // door, stairs, corridor
  - meta (json, null) // detalles (dirección, restricciones)

## Items y Efectos

- item
  - id (PK, int)
  - id_room (FK -> room.id)
  - name (varchar 100)
  - description (text, null)
  - id_type (FK -> type.id) // image, video, model3d, pdf, audio, gif...
  - source_uri (varchar 300) // ruta/URL del archivo
  - thumbnail_uri (varchar 300, null)
  - order (int, default 0)
  - transform (json) // {position:{x,y,z}, rotation:{x,y,z}, scale:{x,y,z}}
  - behavior (json, null) // interactivo: triggerRadius, prompts
  - id_status (FK -> status.id)
  - created_at (datetime)
  - updated_at (datetime)

- effect
  - id (PK, int)
  - effect (varchar 30) // rotate, bounce, particles, glow, spin-left, spin-right
  - description (varchar 200, null)
  - id_type (FK -> type.id, null) // restringir por tipo aplicable
  - default_params (json, null) // {speed:1.0, axis:'y', intensity:0.5}

- item_effect
  - id (PK, int)
  - id_item (FK -> item.id)
  - id_effect (FK -> effect.id)
  - params (json, null) // override de parámetros
  - order (int, default 0)
  - enabled (bool, default true)

## Internacionalización (Opcional)

- i18n_string
  - id (PK, int)
  - key (varchar 150, único)
  - default_text (text)

- i18n_translation
  - id (PK, int)
  - id_string (FK -> i18n_string.id)
  - locale (varchar 10) // es-MX, en-US
  - text (text)

## Versionado (Opcional)

- item_version
  - id (PK, int)
  - id_item (FK -> item.id)
  - version (int)
  - change_log (text, null)
  - data_snapshot (json) // copia completa del item
  - created_at (datetime)
  - created_by (FK -> usuario.id)

## Valores Iniciales Sugeridos

- type
  - image, video, audio, pdf, gif, model3d, item, space, room, effect, status

- status por tipo (ejemplos)
  - item: draft, published, archived, hidden
  - space: draft, published, maintenance, archived
  - room: draft, published, locked
  - usuario: active, banned, pending

## Índices Clave
- usuario.email (único)
- space.slug (único)
- room.slug + id_space (único compuesto)
- item.id_room (índice)
- item_effect.id_item (índice)
- status.id_type (índice)
- type.type (único)

## Notas de Seguridad
- Guardar passwords como hash (bcrypt/argon2).
- Limitar permisos por rol (role) + ACL por ownership (id_usuario en space).
- Validar MIME y extensión de archivos en item.source_uri.

## Integración con el Proyecto Actual
- world layout puede mapearse desde room.dimensions/position/doors/materials.
- artworks en World.js corresponden a item de tipo image/model3d con behavior.triggerRadius.
- efectos (effect + item_effect) pueden alimentar el sistema de animación/aplicación de efectos en runtime.

## Extensiones Futuras
- tagging (tags globales por space/room/item).
- schedules (horarios de exhibición de items/rooms).
- analytics (visitas, tiempo frente a obras).
- multiplayer (sesiones, presencia, permisos en tiempo real).
