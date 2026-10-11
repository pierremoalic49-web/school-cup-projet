// Le personnage du joueur (Microsoft Rocketbox, licence MIT, voir public/joueurs/LICENSE-rocketbox.txt) :
// chargement, tenue School Cup, visage effacé, animations.
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { paintKit, type KitOptions } from './kit'

const DIR = '/joueurs/'
// Les textures d'origine (TGA) ne sont pas fournies : on remplace leur chargement par un pixel vide.
const EMPTY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

const manager = new THREE.LoadingManager()
manager.setURLModifier((url) => (/\.tga$/i.test(url) ? EMPTY : url))
const fbx = new FBXLoader(manager)
const tl = new THREE.TextureLoader()
const img = (u: string) =>
  new Promise<HTMLImageElement>((ok, ko) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ko(new Error(`Image introuvable : ${u}`))
    i.src = u
  })
const tex = (u: string, srgb: boolean) =>
  tl.loadAsync(u).then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  })

/** Couleur du visage : une ombre profonde, sans aucune lumière, sous tous les angles. */
const FACE_SHADOW = new THREE.Color(0.004, 0.006, 0.012)

/** Masque du visage dans l'espace UV de la tête (yeux, dents et langue compris). */
function faceMask() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const x = c.getContext('2d')!
  x.fillStyle = '#000'
  x.fillRect(0, 0, 256, 256)
  const k = 256 / 2048
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.8, '#fff')
  g.addColorStop(1, '#000')
  x.save()
  x.translate(1000 * k, 630 * k)
  x.scale(300 * k, 430 * k)
  x.fillStyle = g
  x.beginPath()
  x.arc(0, 0, 1, 0, Math.PI * 2)
  x.fill()
  x.restore()
  x.fillStyle = '#fff'
  x.fillRect(0, 1160 * k, 700 * k, 888 * k)
  return new THREE.CanvasTexture(c)
}

export interface Character {
  root: THREE.Group
  mixer: THREE.AnimationMixer
  clips: Record<'idle' | 'walkStart' | 'walkStop' | 'cheer', THREE.AnimationClip>
  setKit(o: KitOptions): void
  head: THREE.Bone
}

let cache: Promise<Omit<Character, 'setKit'> & { bodyMat: THREE.MeshStandardMaterial; base: HTMLImageElement; crest: HTMLImageElement }> | null = null

async function loadClip(name: string) {
  const a = await fbx.loadAsync(DIR + name + '.fbx')
  const clip = a.animations[0]
  // Piste technique du logiciel d'origine, inutile ici.
  clip.tracks = clip.tracks.filter((t) => !t.name.startsWith('MotionExtractionHelper'))
  return clip
}

/** Charge le garçon (une seule fois, puis on réutilise). */
export async function loadCharacter(): Promise<Character> {
  cache ??= (async () => {
    await document.fonts?.load('400 64px Anton').catch(() => {})
    const [model, base, crest, bodyNormal, head, headNormal, idle, walkStart, walkStop, cheer] = await Promise.all([
      fbx.loadAsync(DIR + 'g.fbx'),
      img(DIR + 'kit-g.webp'),
      img('/logo/ecusson-plat.webp'),
      tex(DIR + 'g-body-normal.webp', false),
      tex(DIR + 'g-head.webp', true),
      tex(DIR + 'g-head-normal.webp', false),
      loadClip('m_idle_breathe_01'),
      loadClip('m_walk_start'),
      loadClip('m_walk_stop'),
      loadClip('m_cheer_04'),
    ])
    model.scale.setScalar(0.01) // centimètres → mètres
    const mask = faceMask()
    const bodyMat = new THREE.MeshStandardMaterial({ name: 'corps', normalMap: bodyNormal, roughness: 0.72 })
    const headMat = new THREE.MeshStandardMaterial({ name: 'tete', map: head, normalMap: headNormal, roughness: 0.6 })
    headMat.onBeforeCompile = (sh) => {
      sh.uniforms.uFaceMask = { value: mask }
      sh.uniforms.uFaceShadow = { value: FACE_SHADOW }
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uFaceMask;\nuniform vec3 uFaceShadow;')
        // Remplacement complet (pas une simple atténuation) : le visage ne renvoie aucune lumière.
        .replace(
          '#include <opaque_fragment>',
          `outgoingLight = mix(outgoingLight, uFaceShadow, texture2D(uFaceMask, vMapUv).r);
          #include <opaque_fragment>`,
        )
    }
    let headBone: THREE.Bone | null = null
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (m.isMesh) {
        const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[]
        const next = mats.map((x) => (/head/i.test(x.name) ? headMat : bodyMat))
        m.material = Array.isArray(m.material) ? next : next[0]
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
      }
      if ((o as THREE.Bone).isBone && o.name === 'Bip01_Head') headBone = o as THREE.Bone
    })
    const root = new THREE.Group()
    root.add(model)
    return { root, mixer: new THREE.AnimationMixer(model), clips: { idle, walkStart, walkStop, cheer }, head: headBone!, bodyMat, base, crest }
  })()
  const c = await cache
  return {
    root: c.root,
    mixer: c.mixer,
    clips: c.clips,
    head: c.head,
    setKit(o) {
      c.bodyMat.map?.dispose()
      const t = new THREE.CanvasTexture(paintKit(c.base, c.crest, o))
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      c.bodyMat.map = t
      c.bodyMat.needsUpdate = true
    },
  }
}
