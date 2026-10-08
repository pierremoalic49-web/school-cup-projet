// L'éclairage d'un soir de match : 4 mâts de projecteurs (vraies lumières + ombres),
// faisceaux visibles dans la brume, halos, reflets « caméra TV », lumière d'ambiance.
import * as THREE from 'three'
import { GLSL_NOISE, glowTexture, streakTexture, type Tier } from './util'

export const MASTS: [number, number][] = [
  [-74, -57],
  [74, -57],
  [-74, 57],
  [74, 57],
]
export const MAST_H = 52

export const beamUniforms = { uTime: { value: 0 }, uBoost: { value: 1 } }

function beamMaterial(strength: number) {
  return new THREE.ShaderMaterial({
    uniforms: { ...beamUniforms, uStrength: { value: strength } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vAlong = -position.y; // 0 au projecteur, 1 au sol (géométrie normalisée)
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uStrength; uniform float uBoost;
      varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        // Plus épais au centre du cône vu de face, fondu sur les bords et vers le sol.
        float facing = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float fall = pow(1.0 - vAlong, 1.35) * smoothstep(0.0, 0.06, vAlong);
        float dust = 0.6 + 0.4 * sc_fbm(vW.xz * 0.05 + vW.y * 0.04 + vec2(uTime * 0.03, -uTime * 0.02));
        // Quand la caméra est dans le faisceau (au sol), on l'efface : sinon toute l'image devient laiteuse.
        float near = smoothstep(25.0, 90.0, distance(cameraPosition, vW));
        float a = facing * fall * dust * near * uStrength * uBoost;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.86) * a, a);
      }`,
  })
}

export function buildLights(scene: THREE.Scene, tier: Tier) {
  // Lumière ambiante : ciel bleu nuit au-dessus, rebond vert de la pelouse en dessous.
  scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x10200f, 0.25))
  scene.add(new THREE.AmbientLight(0x1a2240, 0.35))
  const moon = new THREE.DirectionalLight(0x8fa6ff, 0.25)
  moon.position.set(-300, 400, -200)
  scene.add(moon)

  const glow = glowTexture()
  const streak = streakTexture()
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8.6, 7.6), toneMapped: false })
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b303b, roughness: 0.5, metalness: 0.7 })
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.5, metalness: 0.6 })
  const shadowMasts = tier === 'high' ? 4 : tier === 'mid' ? 2 : 0
  const halos: THREE.Sprite[] = []

  MASTS.forEach(([mx, mz], i) => {
    // Le mât : un treillis effilé.
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.2, MAST_H, 6), mastMat)
    mast.position.set(mx, MAST_H / 2, mz)
    mast.castShadow = false
    scene.add(mast)

    // La tête : un cadre incliné vers le terrain avec une grille de lampes.
    const head = new THREE.Group()
    head.position.set(mx, MAST_H + 2, mz)
    head.lookAt(0, 0, 0)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 0.6), frameMat)
    head.add(frame)
    const lampGeo = new THREE.CircleGeometry(0.42, 14)
    const cols = 7
    const rows = 4
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, cols * rows)
    const m4 = new THREE.Matrix4()
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        m4.makeTranslation(-4.8 + c * 1.6, -2.4 + r * 1.6, 0.32)
        lamps.setMatrixAt(r * cols + c, m4)
      }
    head.add(lamps)
    scene.add(head)

    // Halo + reflet horizontal, centrés sur la tête du mât.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff1d6, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }))
    halo.scale.set(26, 26, 1)
    halo.position.copy(head.position)
    scene.add(halo)
    halos.push(halo)
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: streak, color: 0x9fc0ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }))
    st.scale.set(48, 1.6, 1)
    st.position.copy(head.position)
    scene.add(st)

    // La vraie lumière : un spot visé un peu au-delà du centre pour une pelouse plus claire au milieu.
    const spot = new THREE.SpotLight(0xfff3e2, 22000, 0, 0.62, 0.75, 2)
    spot.position.copy(head.position)
    spot.target.position.set(-mx * 0.12, 0, -mz * 0.12)
    if (i < shadowMasts) {
      spot.castShadow = true
      spot.shadow.mapSize.set(tier === 'high' ? 2048 : 1024, tier === 'high' ? 2048 : 1024)
      spot.shadow.camera.near = 20
      spot.shadow.camera.far = 220
      spot.shadow.bias = -0.0004
      spot.shadow.normalBias = 0.05
      spot.shadow.radius = 4
    }
    scene.add(spot, spot.target)

    // Faisceaux : un large et diffus, un étroit plus intense.
    const target = new THREE.Vector3(-mx * 0.1, 0, -mz * 0.1)
    const dist = head.position.distanceTo(target)
    for (const [radius, strength] of [
      [30, 0.03],
      [15, 0.045],
    ] as const) {
      const geo = new THREE.ConeGeometry(radius, 1, 40, 1, true)
      geo.translate(0, -0.5, 0) // sommet en 0, base en -1
      const beam = new THREE.Mesh(geo, beamMaterial(strength))
      beam.scale.set(1, dist, 1)
      beam.position.copy(head.position)
      // On oriente l'axe -y du cône vers la cible.
      const dir = target.clone().sub(head.position).normalize()
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
      beam.renderOrder = 5
      scene.add(beam)
    }
  })

  return { halos }
}
