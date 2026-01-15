export const CollisionLayers = Object.freeze({
  STATIC: 1 << 0,
  PLAYER: 1 << 1,
  DYNAMIC: 1 << 2,
  INTERACTABLE: 1 << 3,
})

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export class AABB {
  constructor(minX, minY, minZ, maxX, maxY, maxZ) {
    this.minX = minX
    this.minY = minY
    this.minZ = minZ
    this.maxX = maxX
    this.maxY = maxY
    this.maxZ = maxZ
  }

  static fromMinMax(min, max) {
    return new AABB(min.x, min.y, min.z, max.x, max.y, max.z)
  }

  static fromCenterExtents(center, extents) {
    return new AABB(
      center.x - extents.x,
      center.y - extents.y,
      center.z - extents.z,
      center.x + extents.x,
      center.y + extents.y,
      center.z + extents.z,
    )
  }

  intersects(other, epsilon = 0) {
    return !(
      this.maxX <= other.minX + epsilon ||
      this.minX >= other.maxX - epsilon ||
      this.maxY <= other.minY + epsilon ||
      this.minY >= other.maxY - epsilon ||
      this.maxZ <= other.minZ + epsilon ||
      this.minZ >= other.maxZ - epsilon
    )
  }

  containsPoint(p) {
    return p.x >= this.minX && p.x <= this.maxX && p.y >= this.minY && p.y <= this.maxY && p.z >= this.minZ && p.z <= this.maxZ
  }

  expandedByScalar(s) {
    return new AABB(this.minX - s, this.minY - s, this.minZ - s, this.maxX + s, this.maxY + s, this.maxZ + s)
  }
}

export class SpatialHash {
  constructor(cellSize = 8) {
    this.cellSize = cellSize
    this.invCellSize = 1 / cellSize
    this.cells = new Map()
  }

  _key(ix, iy, iz) {
    return `${ix}|${iy}|${iz}`
  }

  _cellCoord(v) {
    return Math.floor(v * this.invCellSize)
  }

  _iterateCellsForAABB(aabb, fn) {
    const minX = this._cellCoord(aabb.minX)
    const minY = this._cellCoord(aabb.minY)
    const minZ = this._cellCoord(aabb.minZ)
    const maxX = this._cellCoord(aabb.maxX)
    const maxY = this._cellCoord(aabb.maxY)
    const maxZ = this._cellCoord(aabb.maxZ)
    for (let ix = minX; ix <= maxX; ix++) {
      for (let iy = minY; iy <= maxY; iy++) {
        for (let iz = minZ; iz <= maxZ; iz++) {
          fn(ix, iy, iz)
        }
      }
    }
  }

  insert(id, aabb) {
    this._iterateCellsForAABB(aabb, (ix, iy, iz) => {
      const k = this._key(ix, iy, iz)
      let set = this.cells.get(k)
      if (!set) {
        set = new Set()
        this.cells.set(k, set)
      }
      set.add(id)
    })
  }

  remove(id, aabb) {
    this._iterateCellsForAABB(aabb, (ix, iy, iz) => {
      const k = this._key(ix, iy, iz)
      const set = this.cells.get(k)
      if (!set) return
      set.delete(id)
      if (set.size === 0) this.cells.delete(k)
    })
  }

  queryAABB(aabb) {
    const result = new Set()
    this._iterateCellsForAABB(aabb, (ix, iy, iz) => {
      const k = this._key(ix, iy, iz)
      const set = this.cells.get(k)
      if (!set) return
      for (const id of set) result.add(id)
    })
    return result
  }
}

const createWireMat = (scene) => {
  const mat = new BABYLON.StandardMaterial('colliderWireMat', scene)
  mat.emissiveColor = BABYLON.Color3.FromHexString('#00ffd5')
  mat.wireframe = true
  mat.alpha = 0.55
  return mat
}

export class PhysicsSystem {
  constructor(scene, options = {}) {
    this.scene = scene
    this.cellSize = options.cellSize ?? 8
    this.nearRadius = options.nearRadius ?? 28
    this.hash = new SpatialHash(this.cellSize)
    this.nextId = 1
    this.colliders = new Map()
    this.enabledNearSet = new Set()
    this.debugEnabled = false
    this.debugMeshes = new Map()
    this.debugMat = createWireMat(scene)
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = enabled
    for (const mesh of this.debugMeshes.values()) mesh.setEnabled(enabled)
  }

  _meshAABB(mesh) {
    mesh.computeWorldMatrix(true)
    const bi = mesh.getBoundingInfo()
    bi.update(mesh.getWorldMatrix())
    const bb = bi.boundingBox
    return AABB.fromMinMax(bb.minimumWorld, bb.maximumWorld)
  }

  registerMesh(mesh, layer, mask, { isStatic = true } = {}) {
    const id = this.nextId++
    const aabb = this._meshAABB(mesh)
    const entry = { id, mesh, aabb, layer, mask, isStatic }
    this.colliders.set(id, entry)
    this.hash.insert(id, aabb)

    mesh.checkCollisions = false
    mesh.isPickable = mesh.isPickable ?? true
    mesh.metadata = { ...(mesh.metadata || {}), collisionLayer: layer, collisionMask: mask, colliderId: id }

    if (this.debugEnabled) this._ensureDebugMesh(entry)
    return id
  }

  unregisterMesh(mesh) {
    const id = mesh?.metadata?.colliderId
    if (!id) return
    const entry = this.colliders.get(id)
    if (!entry) return
    this.hash.remove(id, entry.aabb)
    this.colliders.delete(id)
    const dbg = this.debugMeshes.get(id)
    if (dbg) {
      dbg.dispose()
      this.debugMeshes.delete(id)
    }
  }

  updateDynamic(mesh) {
    const id = mesh?.metadata?.colliderId
    if (!id) return
    const entry = this.colliders.get(id)
    if (!entry) return
    this.hash.remove(id, entry.aabb)
    entry.aabb = this._meshAABB(mesh)
    this.hash.insert(id, entry.aabb)
    if (this.debugEnabled) this._updateDebugMesh(entry)
  }

  queryNear(position, radius = this.nearRadius) {
    const ext = new BABYLON.Vector3(radius, radius, radius)
    const aabb = AABB.fromCenterExtents(position, ext)
    const ids = this.hash.queryAABB(aabb)
    const out = []
    for (const id of ids) {
      const e = this.colliders.get(id)
      if (!e) continue
      if (!e.aabb.intersects(aabb)) continue
      out.push(e)
    }
    return out
  }

  applyBroadphaseToBabylonCollisions(playerPosition) {
    const near = this.queryNear(playerPosition, this.nearRadius)
    const nextEnabled = new Set()
    for (const e of near) {
      if (!(e.layer & CollisionLayers.STATIC)) continue
      nextEnabled.add(e.id)
      e.mesh.checkCollisions = true
    }

    for (const id of this.enabledNearSet) {
      if (nextEnabled.has(id)) continue
      const e = this.colliders.get(id)
      if (e) e.mesh.checkCollisions = false
    }
    this.enabledNearSet = nextEnabled
  }

  validateNoOverlaps(roomEntries, epsilon = 0.0001) {
    const overlaps = []
    for (let i = 0; i < roomEntries.length; i++) {
      for (let j = i + 1; j < roomEntries.length; j++) {
        const a = roomEntries[i]
        const b = roomEntries[j]
        if (a.bounds.intersects(b.bounds, epsilon)) overlaps.push([a.name, b.name])
      }
    }
    return overlaps
  }

  _ensureDebugMesh(entry) {
    if (this.debugMeshes.has(entry.id)) return
    const box = BABYLON.MeshBuilder.CreateBox(`dbg_${entry.id}`, { size: 1 }, this.scene)
    box.isPickable = false
    box.checkCollisions = false
    box.material = this.debugMat
    this.debugMeshes.set(entry.id, box)
    this._updateDebugMesh(entry)
    box.setEnabled(this.debugEnabled)
  }

  _updateDebugMesh(entry) {
    const box = this.debugMeshes.get(entry.id)
    if (!box) return
    const aabb = entry.aabb
    const cx = (aabb.minX + aabb.maxX) * 0.5
    const cy = (aabb.minY + aabb.maxY) * 0.5
    const cz = (aabb.minZ + aabb.maxZ) * 0.5
    const sx = Math.max(0.001, aabb.maxX - aabb.minX)
    const sy = Math.max(0.001, aabb.maxY - aabb.minY)
    const sz = Math.max(0.001, aabb.maxZ - aabb.minZ)
    box.position.set(cx, cy, cz)
    box.scaling.set(sx, sy, sz)
  }

  updateDebugMeshes() {
    if (!this.debugEnabled) return
    for (const e of this.colliders.values()) {
      this._ensureDebugMesh(e)
      this._updateDebugMesh(e)
    }
  }
}

export const resolveCameraObstruction = ({ scene, camera, target, desiredPosition, collisionMaskPredicate }) => {
  const dir = desiredPosition.subtract(target)
  const dist = dir.length()
  if (dist < 0.001) return desiredPosition
  dir.normalize()

  const ray = new BABYLON.Ray(target, dir, dist)
  const hit = scene.pickWithRay(ray, collisionMaskPredicate)
  if (!hit.hit) return desiredPosition
  const safeDist = Math.max(0.2, hit.distance - 0.35)
  return target.add(dir.scale(safeDist))
}

export const buildRoomAABB = ({ name, pos, size }) => {
  const min = new BABYLON.Vector3(pos.x - size.w / 2, pos.y, pos.z - size.d / 2)
  const max = new BABYLON.Vector3(pos.x + size.w / 2, pos.y + size.h, pos.z + size.d / 2)
  return { name, bounds: AABB.fromMinMax(min, max) }
}

export const snapRoom = ({ fromPos, fromSize, toSize, direction }) => {
  const x = fromPos.x
  const y = fromPos.y
  const z = fromPos.z
  if (direction === 'north') return new BABYLON.Vector3(x, y, z + fromSize.d / 2 + toSize.d / 2)
  if (direction === 'south') return new BABYLON.Vector3(x, y, z - fromSize.d / 2 - toSize.d / 2)
  if (direction === 'east') return new BABYLON.Vector3(x + fromSize.w / 2 + toSize.w / 2, y, z)
  if (direction === 'west') return new BABYLON.Vector3(x - fromSize.w / 2 - toSize.w / 2, y, z)
  return new BABYLON.Vector3(x, y, z)
}
