import { AABB, SpatialHash, CollisionLayers } from './PhysicsSystem.js'

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

const testAABB = () => {
  const a = new AABB(0, 0, 0, 2, 2, 2)
  const b = new AABB(1, 1, 1, 3, 3, 3)
  const c = new AABB(2, 2, 2, 4, 4, 4)
  assert(a.intersects(b), 'AABB debería intersectar')
  assert(!a.intersects(c, 0), 'AABB no debería intersectar')
}

const testSpatialHash = () => {
  const sh = new SpatialHash(4)
  const box = new AABB(0, 0, 0, 1, 1, 1)
  sh.insert(1, box)
  const hits = sh.queryAABB(new AABB(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5))
  assert(hits.has(1), 'SpatialHash debería devolver el id insertado')
  sh.remove(1, box)
  const hits2 = sh.queryAABB(new AABB(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5))
  assert(!hits2.has(1), 'SpatialHash no debería devolver id removido')
}

const testLayers = () => {
  const layer = CollisionLayers.STATIC
  const mask = CollisionLayers.PLAYER | CollisionLayers.DYNAMIC
  assert((mask & CollisionLayers.PLAYER) !== 0, 'Máscara debería incluir PLAYER')
  assert((mask & CollisionLayers.INTERACTABLE) === 0, 'Máscara no debería incluir INTERACTABLE')
  assert((layer & CollisionLayers.STATIC) !== 0, 'Capa debería ser STATIC')
}

export const runUnitTests = () => {
  const tests = [
    ['AABB', testAABB],
    ['SpatialHash', testSpatialHash],
    ['CollisionLayers', testLayers],
  ]
  const results = { passed: 0, failed: 0 }
  for (const [name, fn] of tests) {
    try {
      fn()
      results.passed++
      console.log(`[TEST PASS] ${name}`)
    } catch (e) {
      results.failed++
      console.error(`[TEST FAIL] ${name}`, e)
    }
  }
  console.log(`[TEST SUMMARY] passed=${results.passed} failed=${results.failed}`)
  return results
}
