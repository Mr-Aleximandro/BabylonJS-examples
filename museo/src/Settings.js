const STORAGE_KEY = 'museo_settings_v1'

export const defaultSettings = Object.freeze({
  brightness: 1.15,
  masterVolume: 0.8,
  sfxVolume: 0.85,
  musicVolume: 0.35,
})

export const loadSettings = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw)
    return {
      brightness: typeof parsed.brightness === 'number' ? parsed.brightness : defaultSettings.brightness,
      masterVolume: typeof parsed.masterVolume === 'number' ? parsed.masterVolume : defaultSettings.masterVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : defaultSettings.sfxVolume,
      musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : defaultSettings.musicVolume,
    }
  } catch {
    return { ...defaultSettings }
  }
}

export const saveSettings = (settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export const clamp01 = (v) => Math.max(0, Math.min(1, v))

export const applySettingsToLandingScene = ({ scene, pipeline, settings }) => {
  if (scene?.imageProcessingConfiguration) {
    scene.imageProcessingConfiguration.exposure = settings.brightness
  }
  if (pipeline?.imageProcessing) {
    pipeline.imageProcessing.exposure = settings.brightness
  }
}

