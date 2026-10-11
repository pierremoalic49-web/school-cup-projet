// Atelier (développement uniquement) : charge un personnage Rocketbox, applique les textures converties,
// teste l'effacement du visage, joue une animation. Paramètres : ?p=m|f&anim=walk_start&t=1.2&face=0|1&yaw=30
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { paintKit } from '../src/reveal/kit'

declare const __ASSETS_DIR__: string
const SRC = '/@fs/' + __ASSETS_DIR__ + 'joueur-3d/rocketbox/'
const q = new URLSearchParams(location.search)
const who = q.get('p') === 'f' ? 'f' : 'm'
const animName = q.get('anim') ?? 'idle_breathe_01'
const seekT = q.has('t') ? +q.get('t')! : null
const hideFace = q.get('face') !== '0'
const info = document.getElementById('info')!
const log = (s: string) => (info.textContent += '\n' + s)

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1d26)
scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.0))
const key = new THREE.DirectionalLight(0xffffff, 2.4)
key.position.set(1.5, 3, 3)
scene.add(key)
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 100)
camera.position.set(0, 1.15, 5.2)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1, 0)
scene.add(new THREE.GridHelper(6, 12, 0x444444, 0x2a2a2a))

// Les textures TGA sont remplacées par nos PNG convertis : on empêche le FBX de les charger.
const manager = new THREE.LoadingManager()
manager.setURLModifier((url) => (/\.tga$/i.test(url) ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' : url))
const tl = new THREE.TextureLoader()
const tex = (n: string, srgb = true) => {
  const t = tl.load(SRC + 'tex/' + n + '.png')
  t.flipY = true
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

const model = who === 'm' ? 'Sports_Male_02' : 'Sports_Female_02'
const pre = who === 'm' ? 'm301' : 'f013'
const fbx = await new FBXLoader(manager).loadAsync(SRC + model + '.fbx')
const size = new THREE.Box3().setFromObject(fbx).getSize(new THREE.Vector3())
fbx.scale.setScalar(0.01) // centimètres → mètres
log(`${model} : hauteur ${(size.y / 100).toFixed(2)} m`)
scene.add(fbx)

// Masque du visage dans l'espace UV de la tête : ellipse au centre (+ yeux, dents, langue en bas à gauche).
function faceMaskCanvas() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')!
  x.fillStyle = '#000'
  x.fillRect(0, 0, 512, 512)
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, '#fff')
  g.addColorStop(0.78, '#fff')
  g.addColorStop(1, '#000')
  x.save()
  x.translate(512 * (1000 / 2048), 512 * (630 / 2048))
  x.scale(512 * (300 / 2048), 512 * (430 / 2048))
  x.fillStyle = g
  x.beginPath()
  x.arc(0, 0, 1, 0, Math.PI * 2)
  x.fill()
  x.restore()
  x.fillStyle = '#fff'
  x.fillRect(0, 512 * (1160 / 2048), 512 * (700 / 2048), 512 * (888 / 2048)) // yeux, dents, langue
  return new THREE.CanvasTexture(c)
}

// Tenue School Cup (garçon) : texture repeinte + numéro et prénom imprimés.
let kitTex: THREE.Texture | null = null
if (who === 'm' && q.get('kit') !== '0') {
  await document.fonts.load('400 64px Anton')
  const load = (u: string) => new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = u })
  const [base, crest] = await Promise.all([load('/joueurs/kit-g.webp'), load('/logo/ecusson-plat.webp')])
  kitTex = new THREE.CanvasTexture(paintKit(base, crest, { number: +(q.get('n') ?? 10), name: q.get('nom') ?? 'Théo' }))
  kitTex.colorSpace = THREE.SRGBColorSpace
  kitTex.anisotropy = 8
}

let faceMaskData: ImageData | null = null
fbx.traverse((o) => {
  const m = o as THREE.SkinnedMesh
  if (!m.isMesh) return
  const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[]
  const out = mats.map((old) => {
    const isHead = /head/i.test(old.name)
    const part = isHead ? 'head' : 'body'
    const mat = new THREE.MeshStandardMaterial({
      name: old.name,
      map: !isHead && kitTex ? kitTex : tex(`${pre}_${part}_color`),
      normalMap: tex(`${pre}_${part}_normal`, false),
      roughness: isHead ? 0.6 : 0.75,
    })
    if (isHead && hideFace) {
      const mask = faceMaskCanvas()
      faceMaskData = (mask.image as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, 512, 512)
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uFaceMask = { value: mask }
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D uFaceMask;')
          // Le visage ne reçoit AUCUNE lumière : on remplace la couleur finale par une ombre constante.
          .replace(
            '#include <opaque_fragment>',
            `float faceK = texture2D(uFaceMask, vMapUv).r;
            outgoingLight = mix(outgoingLight, vec3(0.006, 0.008, 0.016), faceK);
            #include <opaque_fragment>`,
          )
      }
    }
    return mat
  })
  m.material = Array.isArray(m.material) ? out : out[0]
  m.castShadow = true

  // Aplatir le relief du visage (nez, lèvres, arcades) : lissage des sommets dont l'UV est dans le masque.
  if (hideFace && faceMaskData) {
    const g = m.geometry
    const uv = g.attributes.uv as THREE.BufferAttribute
    const pos = g.attributes.position as THREE.BufferAttribute
    const groups = g.groups
    const headGroup = groups.find((gr) => mats[gr.materialIndex ?? 0] && /head/i.test(mats[gr.materialIndex ?? 0].name))
    log(`Groupes : ${groups.length}, tête : ${headGroup ? 'oui' : 'non'}`)
    const sample = (i: number) => {
      const u = uv.getX(i)
      const v = 1 - uv.getY(i)
      const px = Math.min(511, Math.max(0, Math.floor(u * 512)))
      const py = Math.min(511, Math.max(0, Math.floor(v * 512)))
      return faceMaskData!.data[(py * 512 + px) * 4] / 255
    }
    if (headGroup && g.index) {
      const idx = g.index
      const headVerts = new Set<number>()
      for (let k = headGroup.start; k < headGroup.start + headGroup.count; k++) headVerts.add(idx.getX(k))
      const masked = [...headVerts].filter((i) => sample(i) > 0.5)
      log(`Sommets de tête : ${headVerts.size}, dans le masque visage : ${masked.length}`)
      ;(window as unknown as { faceVerts: number[] }).faceVerts = masked
      void pos
    }
  }
})

const mixer = new THREE.AnimationMixer(fbx)
try {
  const anim = await new FBXLoader(manager).loadAsync(SRC + `${who}_${animName}.max.fbx`)
  const clip = anim.animations[0]
  clip.tracks = clip.tracks.filter((t) => !t.name.startsWith('MotionExtractionHelper'))
  log(`Animation ${animName} : ${clip.duration.toFixed(2)} s`)
  const action = mixer.clipAction(clip)
  action.play()
  if (seekT != null) {
    mixer.setTime(seekT)
    action.paused = true
  }
} catch (e) {
  log(`Animation : ÉCHEC ${e}`)
}
if (q.has('yaw')) fbx.rotation.y = (+q.get('yaw')! * Math.PI) / 180

const clock = new THREE.Timer()
renderer.setAnimationLoop(() => {
  clock.update()
  mixer.update(seekT == null ? clock.getDelta() : 0)
  controls.update()
  renderer.render(scene, camera)
})
;(window as unknown as { atelier: unknown }).atelier = { scene, fbx, mixer, camera, renderer, controls }
