import world from './src/World.js?v=5'
import { runUnitTests } from './src/UnitTests.js'
import { loadSettings, saveSettings, applySettingsToLandingScene, clamp01 } from './src/Settings.js'

let landingEngine = null
let landingScene = null
let landingAnimationId = null
let landingPipeline = null
let settings = loadSettings()

initLandingScene()
runUnitTests()
initSettingsUI()

document.getElementById('enter-btn').addEventListener('click', () => {
  if (BABYLON?.Engine?.audioEngine?.unlock) {
    BABYLON.Engine.audioEngine.unlock()
  }
  // Hide Main Menu
  document.getElementById('main-menu').style.display = 'none';

  // Show Loading Screen
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.style.display = 'flex';

  // No Pointer Lock needed for Isometric View
  // We use mouse for interaction now

  // Dispose landing scene before starting the world
  if (landingAnimationId) cancelAnimationFrame(landingAnimationId)
  if (landingEngine) {
    landingEngine.stopRenderLoop()
    landingScene && landingScene.dispose()
    landingEngine.dispose()
    landingEngine = null
    landingScene = null
  }

  // Start World
  init();
});

function init() {
  void world.init().then(() => {
    world.applySettings(settings)
  })
}

function initLandingScene() {
  const canvas = document.getElementById('renderCanvas')
  if (!canvas || typeof BABYLON === 'undefined') return
  const ls = document.getElementById('loading-screen')
  if (ls) ls.style.display = 'none'

  landingEngine = new BABYLON.Engine(canvas, true)
  if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) {
    landingEngine.setHardwareScalingLevel(1.25)
  }
  landingScene = new BABYLON.Scene(landingEngine)
  const scene = landingScene

  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1)
  scene.imageProcessingConfiguration.exposure = settings.brightness
  scene.imageProcessingConfiguration.contrast = 1.1

  const camera = new BABYLON.ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2.5, 22, new BABYLON.Vector3(0, 2, 0), scene)
  camera.attachControl(canvas, false)

  const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene)
  hemi.intensity = 0.8
  const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-0.5, -1, -0.2), scene)
  dir.intensity = 0.6

  const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene, [camera])
  landingPipeline = pipeline
  pipeline.bloomEnabled = true
  pipeline.bloomThreshold = 0.7
  pipeline.bloomWeight = 0.6
  pipeline.bloomKernel = 64
  pipeline.glowLayerEnabled = true
  pipeline.imageProcessingEnabled = true
  pipeline.chromaticAberrationEnabled = true
  pipeline.chromaticAberration.aberrationAmount = 0.1
  applySettingsToLandingScene({ scene, pipeline, settings })

  const glow = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 16 })
  glow.intensity = 0.6

  const ground = BABYLON.MeshBuilder.CreatePlane('ground', { width: 100, height: 100 }, scene)
  ground.rotation.x = Math.PI / 2
  const groundMat = new BABYLON.PBRMaterial('gmat', scene)
  groundMat.metallic = 1
  groundMat.roughness = 0.25
  groundMat.reflectivityColor = new BABYLON.Color3(0.8, 0.9, 1.0)
  groundMat.albedoColor = new BABYLON.Color3(0.05, 0.08, 0.12)
  ground.material = groundMat

  const rings = []
  for (let i = 0; i < 6; i++) {
    const torus = BABYLON.MeshBuilder.CreateTorus('ring' + i, { diameter: 6 + i * 2, thickness: 0.15 }, scene)
    const mat = new BABYLON.PBRMaterial('ringmat' + i, scene)
    mat.metallic = 1
    mat.roughness = 0.2
    mat.albedoColor = BABYLON.Color3.FromHexString(i % 2 ? '#3ac5ff' : '#ff7bf7')
    mat.emissiveColor = BABYLON.Color3.FromHexString(i % 2 ? '#0f9ad6' : '#c34dcc')
    torus.material = mat
    torus.position.y = 2 + i * 0.2
    rings.push(torus)
  }

  const emitter = BABYLON.MeshBuilder.CreateSphere('emit', { diameter: 0.1 }, scene)
  emitter.position.y = 2
  const ps = new BABYLON.ParticleSystem('particles', 600, scene)
  // Use a generated texture to avoid 404 errors if external texture fails
  const particleTexture = new BABYLON.DynamicTexture("particleTex", 64, scene, true);
  const ctx = particleTexture.getContext();
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
  particleTexture.update();
  ps.particleTexture = particleTexture; 
  
  ps.emitter = emitter
  ps.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1)
  ps.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1)
  ps.color1 = new BABYLON.Color4(0.2, 0.7, 1.0, 1.0)
  ps.color2 = new BABYLON.Color4(1.0, 0.5, 0.9, 1.0)
  ps.minSize = 0.05
  ps.maxSize = 0.2
  ps.minLifeTime = 0.5
  ps.maxLifeTime = 2.0
  ps.emitRate = 300
  ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD
  ps.gravity = new BABYLON.Vector3(0, -0.2, 0)
  ps.direction1 = new BABYLON.Vector3(-1, 1, -1)
  ps.direction2 = new BABYLON.Vector3(1, 1, 1)
  ps.minAngularSpeed = 0
  ps.maxAngularSpeed = 1
  ps.minEmitPower = 0.2
  ps.maxEmitPower = 2
  ps.updateSpeed = 0.01
  ps.start()

  if (window.gsap) {
    // Landing Scene Animations
    gsap.fromTo('.museum-title', { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out', delay: 0.5 })
    // gsap.fromTo('.museum-subtitle', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out', delay: 0.8 })
    gsap.fromTo('.menu-card', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: 'back.out(1.7)', delay: 1.2 })
  }

  let t = 0
  landingEngine.runRenderLoop(() => {
    t += scene.getAnimationRatio() * 0.005
    rings.forEach((r, i) => {
      r.rotation.y += 0.002 + i * 0.0005
      r.rotation.x = Math.sin(t + i * 0.2) * 0.2
    })
    emitter.position.x = Math.sin(t) * 1.5
    emitter.position.z = Math.cos(t) * 1.5
    scene.render()
  })

  window.addEventListener('resize', () => {
    landingEngine && landingEngine.resize()
  })
}

function initSettingsUI() {
  const brightness = document.getElementById('brightness-slider')
  const master = document.getElementById('master-slider')
  const sfx = document.getElementById('sfx-slider')
  const music = document.getElementById('music-slider')

  if (brightness) brightness.value = String(settings.brightness)
  if (master) master.value = String(settings.masterVolume)
  if (sfx) sfx.value = String(settings.sfxVolume)
  if (music) music.value = String(settings.musicVolume)

  const applyAll = () => {
    if (brightness) settings.brightness = Number(brightness.value)
    if (master) settings.masterVolume = clamp01(Number(master.value))
    if (sfx) settings.sfxVolume = clamp01(Number(sfx.value))
    if (music) settings.musicVolume = clamp01(Number(music.value))
    saveSettings(settings)
    applySettingsToLandingScene({ scene: landingScene, pipeline: landingPipeline, settings })
    if (world && world.applySettings) world.applySettings(settings)
  }

  ;[brightness, master, sfx, music].forEach((el) => {
    if (!el) return
    el.addEventListener('input', applyAll)
  })
}

const orientationWarning = document.getElementById('orientation-warning')
if (orientationWarning) {
  const applyOrientationWarning = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    const portrait = window.matchMedia('(orientation: portrait)').matches
    orientationWarning.style.display = isMobile && portrait ? 'flex' : 'none'
  }
  applyOrientationWarning()
  window.addEventListener('orientationchange', applyOrientationWarning)
  window.addEventListener('resize', applyOrientationWarning)
}
