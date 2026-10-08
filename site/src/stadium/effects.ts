// Effets de fête : confettis (petits papiers qui tournoient) et fumigènes dorés.
import * as THREE from 'three'
import { canvas, type Tier } from './util'

export function buildConfetti(scene: THREE.Scene, tier: Tier) {
  const n = tier === 'high' ? 1800 : tier === 'mid' ? 1000 : 500
  const geo = new THREE.PlaneGeometry(0.11, 0.07)
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false })
  const mesh = new THREE.InstancedMesh(geo, mat, n)
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const cols = ['#ffc63d', '#ffe7a3', '#ffffff', '#ffc63d', '#d9a21b', '#3fe3ff', '#ff6fb0'].map((c) => new THREE.Color(c).multiplyScalar(1.3))
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  const rot = new Float32Array(n * 3)
  const spin = new Float32Array(n * 3)
  const life = new Float32Array(n)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const one = new THREE.Vector3(1, 1, 1)
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < n; i++) {
    mesh.setColorAt(i, cols[i % cols.length])
    mesh.setMatrixAt(i, hidden)
  }
  scene.add(mesh)
  let next = 0
  let active = false

  return {
    burst(x: number, y: number, z: number, count: number, power: number) {
      for (let k = 0; k < Math.min(count, n); k++) {
        const i = next
        next = (next + 1) % n
        pos.set([x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2], i * 3)
        const a = Math.random() * Math.PI * 2
        const s = (0.25 + Math.random() * 0.75) * power
        vel.set([Math.cos(a) * s * 0.5, (0.7 + Math.random() * 0.6) * power, Math.sin(a) * s * 0.5], i * 3)
        rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3)
        spin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3)
        life[i] = 4 + Math.random() * 4
      }
      active = true
    },
    update(t: number, dt: number) {
      if (!active) return
      let any = false
      for (let i = 0; i < n; i++) {
        if (life[i] <= 0) continue
        any = true
        life[i] -= dt
        const j = i * 3
        vel[j + 1] -= 9.8 * dt * 0.6
        // Freinage par l'air : les papiers finissent par flotter en tombant doucement.
        vel[j] *= 1 - dt * 1.2
        vel[j + 2] *= 1 - dt * 1.2
        if (vel[j + 1] < -1.6) vel[j + 1] = -1.6 + Math.sin(t * 3 + i) * 0.3
        pos[j] += (vel[j] + Math.sin(t * 1.7 + i) * 0.4) * dt
        pos[j + 1] += vel[j + 1] * dt
        pos[j + 2] += (vel[j + 2] + Math.cos(t * 1.3 + i) * 0.4) * dt
        rot[j] += spin[j] * dt
        rot[j + 1] += spin[j + 1] * dt
        rot[j + 2] += spin[j + 2] * dt
        if (life[i] <= 0 || pos[j + 1] < 0.02) {
          life[i] = 0
          mesh.setMatrixAt(i, hidden)
          continue
        }
        q.setFromEuler(e.set(rot[j], rot[j + 1], rot[j + 2]))
        m4.compose(v.set(pos[j], pos[j + 1], pos[j + 2]), q, one)
        mesh.setMatrixAt(i, m4)
      }
      mesh.instanceMatrix.needsUpdate = true
      active = any
    },
  }
}

function smokeTexture() {
  const [c, x] = canvas(128, 128)
  for (let i = 0; i < 26; i++) {
    const px = 30 + Math.random() * 68
    const py = 30 + Math.random() * 68
    const r = 18 + Math.random() * 28
    const g = x.createRadialGradient(px, py, 0, px, py, r)
    g.addColorStop(0, 'rgba(255,255,255,0.22)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 128, 128)
  }
  return new THREE.CanvasTexture(c)
}

/** Fumigènes dorés : allumés quelques secondes à l'arrivée et sur chaque but. */
export function buildSmoke(scene: THREE.Scene, tier: Tier) {
  const n = tier === 'high' ? 260 : tier === 'mid' ? 140 : 60
  const emitters = [
    new THREE.Vector3(61, 3, -20),
    new THREE.Vector3(61, 3, 18),
    new THREE.Vector3(-61, 3, -20),
    new THREE.Vector3(-61, 3, 18),
  ]
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(n * 3).fill(-999)
  const age = new Float32Array(n).fill(99)
  const seed = new Float32Array(n)
  for (let i = 0; i < n; i++) seed[i] = Math.random()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: smokeTexture() }, uScale: { value: 400 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aAge; attribute float aSeed; uniform float uScale; varying float vA; varying float vSeed;
      void main(){
        vA = aAge < 7.0 ? smoothstep(0.0, 0.6, aAge) * (1.0 - aAge / 7.0) : 0.0;
        vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (2.5 + aAge * 2.2) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; varying float vA; varying float vSeed;
      void main(){
        vec2 p = gl_PointCoord - 0.5;
        float s = sin(vSeed * 6.28), c = cos(vSeed * 6.28);
        p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
        float a = texture2D(uTex, p).a * vA * 0.5;
        vec3 col = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.75, 0.35), vSeed);
        gl_FragColor = vec4(col, a);
      }`,
  })
  const pts = new THREE.Points(geo, mat)
  pts.frustumCulled = false
  scene.add(pts)
  let emitT = 0
  let next = 0
  let acc = 0
  return {
    ignite(seconds: number) {
      emitT = Math.max(emitT, seconds)
    },
    update(_t: number, dt: number) {
      if (emitT > 0) {
        emitT -= dt
        acc += dt * n * 0.11
        while (acc > 1) {
          acc -= 1
          const e = emitters[next % emitters.length]
          pos.set([e.x + (Math.random() - 0.5) * 3, e.y, e.z + (Math.random() - 0.5) * 3], next * 3)
          age[next] = 0
          next = (next + 1) % n
        }
      }
      for (let i = 0; i < n; i++) {
        if (age[i] > 8) continue
        age[i] += dt
        pos[i * 3 + 1] += dt * (1.6 + seed[i])
        pos[i * 3] += dt * (0.8 + seed[i] * 0.6) * (pos[i * 3] > 0 ? -0.6 : 0.6)
        pos[i * 3 + 2] += dt * (seed[i] - 0.5)
      }
      geo.attributes.position.needsUpdate = true
      geo.attributes.aAge.needsUpdate = true
    },
  }
}
