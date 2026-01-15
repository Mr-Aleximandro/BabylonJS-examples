/**
 * @author Mugen87 / https://github.com/Mugen87
 * @author Examples with Babylon.js were made at https://github.com/eldinor/yuka-babylonjs-examples / roland@babylonjs.xyz
 */


class AssetManager {
  constructor() {
    this.audios = new Map()
    this.models = new Map()
  }

  async init(scene) {
    this.scene = scene

    this._loadAudios()
    await this._loadModels()
  }

  _loadAudios() {
    const audios = this.audios

    const step1 = new BABYLON.Sound('step1', 'audio/step1.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const step2 = new BABYLON.Sound('step2', 'audio/step2.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const shot = new BABYLON.Sound('shot', 'audio/shot.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const shotReload = new BABYLON.Sound('shot_reload', 'audio/shot_reload.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const reload = new BABYLON.Sound('reload', 'audio/reload.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const impact1 = new BABYLON.Sound('impact1', 'audio/impact1.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const impact2 = new BABYLON.Sound('impact2', 'audio/impact1.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const impact3 = new BABYLON.Sound('impact3', 'audio/impact1.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const impact4 = new BABYLON.Sound('impact4', 'audio/impact1.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const impact5 = new BABYLON.Sound('impact5', 'audio/impact1.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const empty = new BABYLON.Sound('empty', 'audio/empty.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })
    const ambience = new BABYLON.Sound('ambience', 'audio/empty.ogg', this.scene, null, {
      loop: true,
      autoplay: false,
    })
    const dead = new BABYLON.Sound('empty', 'audio/dead.ogg', this.scene, null, {
      loop: false,
      autoplay: false,
    })

    shot.setVolume(1.8)
    reload.setVolume(0.1)
    empty.setVolume(0.3)
    ambience.setVolume(0.08)
    impact1.setVolume(0.3)
    impact2.setVolume(0.3)
    impact3.setVolume(0.3)
    impact4.setVolume(0.3)
    impact5.setVolume(0.3)

    audios.set('step1', step1)
    audios.set('step2', step2)
    audios.set('shot', shot)
    audios.set('shot_reload', shotReload)
    audios.set('reload', reload)
    audios.set('impact1', impact1)
    audios.set('impact2', impact2)
    audios.set('impact3', impact3)
    audios.set('impact4', impact4)
    audios.set('impact5', impact5)
    audios.set('empty', empty)
    audios.set('dead', dead)
    audios.set('ambience', ambience)
  }

  async _loadModels() {
    const models = this.models

    /*
    // weapon
    const gunContainer = await BABYLON.SceneLoader.ImportMeshAsync(null, 'model/', 'shotgun.glb', this.scene)
    const gunMeshes = gunContainer.meshes
    gunMeshes[0].name = 'shotgun'
    const gunMesh = gunMeshes.find((m) => m.name === 'node3')
    // const gunMesh = gunMeshes[0]

    gunMeshes[0].scaling = new BABYLON.Vector3(0.0008, 0.0008, 0.0008)
    gunMeshes[0].position = new BABYLON.Vector3(0.3, -0.1, -0.2)
    gunMeshes[0].rotation = new BABYLON.Vector3(0, -1.6, 0)
    gunMesh.bakeCurrentTransformIntoVertices()
    gunMesh.renderingGroupId = 2
    gunMesh.freezeWorldMatrix()
    gunMesh.alwaysSelectAsActiveMesh = true
    // gunMesh.parent = null

    models.set('weapon', gunMesh)

    const spritemanager = new BABYLON.SpriteManager('sprite-manager', 'model/muzzle.png', 1, 128, this.scene)
    spritemanager.renderingGroupId = 1
    const sprite = new BABYLON.Sprite('muzzle', spritemanager)
    sprite.position = new BABYLON.Vector3(0, 0.13, -0.4)
    sprite.scaling = new BABYLON.Vector3(0.3, 0.3, 0.3)
    sprite.isVisible = false

    models.set('muzzle', sprite)

    // bullet hole
    const texture = new BABYLON.Texture('model/bulletHole.png', this.scene)
    texture.hasAlpha = true
    const bulletHoleMesh = BABYLON.MeshBuilder.CreatePlane('bullet-hole', { size: 0.5 }, this.scene)
    bulletHoleMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0)
    const bulletHoleMaterial = new BABYLON.StandardMaterial('bullet-hole', this.scene)
    bulletHoleMaterial.diffuseTexture = texture
    bulletHoleMaterial.backFaceCulling = false
    // bulletHoleMaterial.disableDepthWrite = false
    bulletHoleMesh.material = bulletHoleMaterial
    bulletHoleMesh.renderingGroupId = 1
    bulletHoleMesh.bakeCurrentTransformIntoVertices()
    bulletHoleMesh.setEnabled(false)
    models.set('bulletHole', bulletHoleMesh)

    // bullet line
    const options = {
      points: [new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 10)],
    }
    const bulletLine = BABYLON.MeshBuilder.CreateLines('bullet-line', options, this.scene)
    bulletLine.color = new BABYLON.Color3.FromHexString('#fbf8e6')
    bulletLine.setEnabled(false)
    bulletLine.renderingGroupId = 3
    bulletLine.freezeWorldMatrix()
    models.set('bulletLine', bulletLine)
    */

    // ground
    /*
    const groundMesh = BABYLON.MeshBuilder.CreatePlane('ground', { width: 40, height: 80 }, this.scene)
    const groundMaterial = new BABYLON.PBRMaterial('groundPBR', this.scene)
    groundMaterial.metallic = 1
    groundMaterial.roughness = 0.3
    groundMaterial.albedoColor = BABYLON.Color3.FromHexString('#0e0e12')
    groundMaterial.reflectivityColor = BABYLON.Color3.FromHexString('#7aa8ff')
    groundMesh.receiveShadows = true
    groundMesh.material = groundMaterial
    groundMesh.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI, 0)
    groundMesh.bakeCurrentTransformIntoVertices()

    models.set('ground', groundMesh)
    */

    // obstacles

    const obstacleMesh = BABYLON.MeshBuilder.CreateBox('obstacle', {
      width: 4,
      height: 8,
      depth: 4,
    })
    obstacleMesh.position.y = 4

    const obstacleMaterial = new BABYLON.StandardMaterial('obstacle', this.scene)
    obstacleMaterial.emissiveColor = BABYLON.Color3.FromHexString('#444444')
    obstacleMaterial.diffuseColor = BABYLON.Color3.FromHexString('#222222')
    obstacleMesh.material = obstacleMaterial
    obstacleMesh.renderingGroupId = 1
    obstacleMesh.bakeCurrentTransformIntoVertices()
    obstacleMesh.freezeWorldMatrix()
    obstacleMesh.setEnabled(false)

    const obstacleCage = obstacleMesh.clone('obstacle-cage')
    obstacleCage.makeGeometryUnique()
    const indices = obstacleCage.getIndices()
    const newIndices = indices.reverse()
    obstacleCage.updateIndices(newIndices)
    obstacleCage.scaling.scaleInPlace(1.001)
    obstacleCage.material = null
    obstacleCage.visibility = 0
    obstacleCage.bakeCurrentTransformIntoVertices()

    models.set('obstacle', obstacleMesh)
    models.set('obstacle-cage', obstacleCage)
  }
}

export { AssetManager }
