// Tout ce qui entoure le stade : le ciel de nuit, la ville éclairée, les routes et les voitures,
// le parvis, les arbres, le parking. C'est ce qu'on voit depuis le ciel au début.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvas, GLSL_NOISE, glowTexture, type Tier } from './util'

export const worldUniforms = { uTime: { value: 0 } }

/* -------------------------------- Ciel -------------------------------- */

export function buildSky(scene: THREE.Scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: worldUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        // Dégradé : orange pâle de la ville à l'horizon, bleu nuit au zénith.
        vec3 zenith = vec3(0.006, 0.010, 0.028);
        vec3 mid = vec3(0.020, 0.032, 0.075);
        vec3 horizon = vec3(0.055, 0.045, 0.05);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, zenith, smoothstep(0.18, 0.75, h));
        // Nuages fins, éclairés par en dessous par la ville et le stade.
        vec2 cp = d.xz / max(d.y, 0.06) * 1.4 + vec2(uTime * 0.004, uTime * 0.002);
        float cl = smoothstep(0.48, 0.85, sc_fbm(cp * 0.8));
        col = mix(col, vec3(0.09, 0.085, 0.11) + horizon * 0.4, cl * 0.55 * smoothstep(0.02, 0.25, h));
        // Étoiles (cachées derrière les nuages et près de l'horizon).
        vec2 sp = vec2(atan(d.z, d.x) * 180.0, d.y * 220.0);
        vec2 cell = floor(sp);
        float rnd = sc_hash(cell);
        vec2 off = vec2(sc_hash(cell + 3.1), sc_hash(cell + 7.7)) - 0.5;
        float star = (1.0 - smoothstep(0.0, 0.12, length(fract(sp) - 0.5 - off * 0.6))) * step(0.985, rnd);
        star *= 0.6 + 0.4 * sin(uTime * (1.0 + rnd * 4.0) + rnd * 40.0);
        col += vec3(0.85, 0.9, 1.0) * star * smoothstep(0.08, 0.35, h) * (1.0 - cl);
        // Lune, avec son halo.
        vec3 moonDir = normalize(vec3(-0.55, 0.42, -0.72));
        float md = distance(d, moonDir);
        col += vec3(0.95, 0.93, 0.85) * (1.0 - smoothstep(0.019, 0.022, md)) * 1.6;
        col += vec3(0.25, 0.28, 0.4) * exp(-md * 14.0) * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), mat)
  sky.renderOrder = -10
  sky.frustumCulled = false
  scene.add(sky)
}

/* -------------------------------- Ville -------------------------------- */

const CITY_SIZE = 3000

/** Les lumières de la ville vue du ciel : rues en quadrillage, carrefours, fenêtres éparses. */
function cityLightsTexture(rand: () => number, tier: Tier) {
  const S = tier === 'high' ? 4096 : 2048
  const [c, x] = canvas(S, S)
  x.fillStyle = '#000'
  x.fillRect(0, 0, S, S)
  const m = S / CITY_SIZE // pixels par mètre
  const toPx = (v: number) => (v + CITY_SIZE / 2) * m
  const keep = (wx: number, wz: number) => {
    const r = Math.hypot(wx / 1.2, wz)
    // Pas de lumière sur le parvis du stade ; la ville s'éteint doucement vers l'horizon.
    if (Math.abs(wx) < 125 && Math.abs(wz) < 110) return 0
    return Math.max(0, 1 - r / 1450) * (r < 160 ? 0.4 : 1)
  }
  // Quadrillage de rues, légèrement tourné par quartier.
  for (let q = 0; q < 9; q++) {
    const cx = (rand() - 0.5) * 2200
    const cz = (rand() - 0.5) * 2200
    const rot = (rand() - 0.5) * 0.6
    const step = 55 + rand() * 40
    const half = 260 + rand() * 260
    x.save()
    x.translate(toPx(cx), toPx(cz))
    x.rotate(rot)
    for (let k = -half; k <= half; k += step) {
      for (const horizontal of [true, false]) {
        for (let s = -half; s < half; s += 14) {
          const wx = horizontal ? s : k
          const wz = horizontal ? k : s
          const gx = cx + wx * Math.cos(rot) - wz * Math.sin(rot)
          const gz = cz + wx * Math.sin(rot) + wz * Math.cos(rot)
          const a = keep(gx, gz)
          if (a <= 0 || rand() < 0.25) continue
          x.fillStyle = `rgba(255,${150 + Math.floor(rand() * 40)},60,${0.55 * a})`
          x.fillRect(wx * m - 1, wz * m - 1, 2.2, 2.2)
        }
      }
    }
    x.restore()
  }
  // Fenêtres, enseignes, phares : des milliers de petits points chauds ou froids.
  const dots = tier === 'high' ? 26000 : 12000
  for (let i = 0; i < dots; i++) {
    const wx = (rand() - 0.5) * CITY_SIZE * 0.95
    const wz = (rand() - 0.5) * CITY_SIZE * 0.95
    const a = keep(wx, wz)
    if (a <= 0 || rand() > a) continue
    const cool = rand() < 0.25
    x.fillStyle = cool ? `rgba(190,215,255,${0.5 * a})` : `rgba(255,${190 + Math.floor(rand() * 50)},120,${0.6 * a})`
    const sz = rand() < 0.05 ? 3 : 1.4
    x.fillRect(toPx(wx), toPx(wz), sz, sz)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function buildCity(scene: THREE.Scene, tier: Tier, rand: () => number) {
  const count = tier === 'high' ? 1100 : tier === 'mid' ? 650 : 380

  // Sol : asphalte sombre loin, parvis en béton autour du stade. Les lumières de la ville vue d'avion
  // (rues orangées, fenêtres, enseignes) sont peintes dans une image posée au sol.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1, emissive: 0xffffff, emissiveMap: cityLightsTexture(rand, tier), emissiveIntensity: 1.4 }),
  )
  ground.position.y = -0.05
  ground.receiveShadow = true
  scene.add(ground)
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(220, 190).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d2028, roughness: 0.85 }))
  plaza.position.y = -0.02
  plaza.receiveShadow = true
  scene.add(plaza)

  // La Maine : une rivière sombre qui reflète un peu le ciel.
  const river = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 70).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x050a14, roughness: 0.12, metalness: 0.9 }),
  )
  river.rotation.y = 1.15
  river.position.set(-330, 0.01, 120)
  scene.add(river)
  const riverDir = new THREE.Vector2(Math.cos(-1.15), Math.sin(-1.15))
  const distToRiver = (x: number, z: number) => {
    const px = x + 330
    const pz = z - 120
    return Math.abs(px * riverDir.y - pz * riverDir.x)
  }

  // Routes (droites) : utilisées pour les lampadaires et les voitures.
  const roads: { a: THREE.Vector3; b: THREE.Vector3 }[] = [
    { a: new THREE.Vector3(-1400, 0, -125), b: new THREE.Vector3(1400, 0, -125) },
    { a: new THREE.Vector3(-1400, 0, 140), b: new THREE.Vector3(1400, 0, 140) },
    { a: new THREE.Vector3(140, 0, -1400), b: new THREE.Vector3(140, 0, 1400) },
    { a: new THREE.Vector3(-150, 0, -1400), b: new THREE.Vector3(-150, 0, 1400) },
    { a: new THREE.Vector3(-1200, 0, -900), b: new THREE.Vector3(1200, 0, 700) },
  ]
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.7 })
  const roadGeos: THREE.BufferGeometry[] = []
  for (const r of roads) {
    const len = r.a.distanceTo(r.b)
    const g = new THREE.PlaneGeometry(len, 14).rotateX(-Math.PI / 2)
    g.rotateY(-Math.atan2(r.b.z - r.a.z, r.b.x - r.a.x))
    g.translate((r.a.x + r.b.x) / 2, 0.0, (r.a.z + r.b.z) / 2)
    roadGeos.push(g)
  }
  scene.add(new THREE.Mesh(mergeGeometries(roadGeos)!, roadMat))
  const nearRoad = (x: number, z: number) =>
    roads.some((r) => {
      const ab = r.b.clone().sub(r.a)
      const t = THREE.MathUtils.clamp(new THREE.Vector3(x, 0, z).sub(r.a).dot(ab) / ab.lengthSq(), 0, 1)
      return r.a.clone().addScaledVector(ab, t).distanceTo(new THREE.Vector3(x, 0, z)) < 22
    })

  // Immeubles : une boîte par bâtiment, les fenêtres sont « dessinées » par le shader.
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const mat = new THREE.MeshLambertMaterial({ color: 0x0d1018 })
  const mesh = new THREE.InstancedMesh(box, mat, count)
  const seeds = new Float32Array(count)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  let placed = 0
  let guard = 0
  while (placed < count && guard++ < count * 20) {
    const ang = rand() * Math.PI * 2
    const r = 150 + Math.pow(rand(), 0.7) * 950
    const x = Math.cos(ang) * r * 1.2
    const z = Math.sin(ang) * r
    if (Math.abs(x) < 120 && Math.abs(z) < 105) continue
    if (distToRiver(x, z) < 60 || nearRoad(x, z)) continue
    const far = r > 650
    const w = 12 + rand() * 26
    const d = 10 + rand() * 22
    let h = 6 + rand() * (r < 300 ? 16 : 30)
    if (far && rand() < 0.12) h = 45 + rand() * 50
    const grid = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), grid + (rand() - 0.5) * 0.15)
    m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d))
    mesh.setMatrixAt(placed, m4)
    seeds[placed] = rand()
    placed++
  }
  mesh.count = placed
  box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSeed; varying vec3 vLocal; varying vec3 vScale; varying vec3 vNrm; varying float vSeed;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLocal = position * vScale; vNrm = normal; vSeed = aSeed;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLocal; varying vec3 vScale; varying vec3 vNrm; varying float vSeed;\n${GLSL_NOISE}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (abs(vNrm.y) < 0.5) {
          float along = abs(vNrm.x) > 0.5 ? vLocal.z : vLocal.x;
          vec2 cell = floor(vec2(along / 3.2, vLocal.y / 3.1));
          vec2 f = fract(vec2(along / 3.2, vLocal.y / 3.1));
          float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.78);
          float r = sc_hash(cell + vSeed * 91.7);
          float lit = step(0.56 - vSeed * 0.3, r) * step(1.2, vLocal.y);
          vec3 wc = mix(vec3(1.0, 0.72, 0.38), vec3(0.75, 0.85, 1.0), step(0.8, sc_hash(cell + 4.0)));
          totalEmissiveRadiance += wc * win * lit * (1.1 + 1.4 * r);
          totalEmissiveRadiance += vec3(0.02, 0.025, 0.04) * win;
        }`,
      )
  }
  scene.add(mesh)

  // Lampadaires le long des routes + feux des voitures qui circulent.
  const lampPos: number[] = []
  for (const r of roads) {
    const len = r.a.distanceTo(r.b)
    for (let s = 0; s < len; s += 32) {
      const p = r.a.clone().lerp(r.b, s / len)
      if (Math.abs(p.x) < 115 && Math.abs(p.z) < 100) continue
      lampPos.push(p.x, 7, p.z)
    }
  }
  // Parvis : lampadaires le long des allées (bords du parvis + deux allées d'accès), pas en cercle parfait.
  for (let x = -100; x <= 100; x += 12.5) {
    lampPos.push(x + (rand() - 0.5) * 2, 5, -92, x + (rand() - 0.5) * 2, 5, 92)
  }
  for (let z = -80; z <= 80; z += 12.5) lampPos.push(-108, 5, z, 108, 5, z)
  for (let z = 95; z < 140; z += 10) lampPos.push(-6, 5, z, 6, 5, z)
  const lampGeo = new THREE.BufferGeometry()
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPos, 3))
  scene.add(
    new THREE.Points(
      lampGeo,
      new THREE.PointsMaterial({ map: glowTexture(), color: new THREE.Color(2.6, 1.7, 0.85), size: 2.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    ),
  )
  // Flaques de lumière orangée au sol sous les lampadaires.
  const poolGeo = new THREE.CircleGeometry(7, 20).rotateX(-Math.PI / 2)
  const poolTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.5)')
  const pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: poolTex, color: 0x5a3410, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), lampPos.length / 3)
  for (let i = 0; i < lampPos.length / 3; i++) {
    m4.makeTranslation(lampPos[i * 3], 0.05, lampPos[i * 3 + 2])
    pools.setMatrixAt(i, m4)
  }
  scene.add(pools)

  const nCars = tier === 'high' ? 420 : tier === 'mid' ? 220 : 120
  const carA = new Float32Array(nCars * 3)
  const carB = new Float32Array(nCars * 3)
  const carS = new Float32Array(nCars)
  const carPos = new Float32Array(nCars * 3)
  for (let i = 0; i < nCars; i++) {
    const r = roads[i % roads.length]
    const dir = rand() < 0.5 ? 1 : -1
    const side = dir * 3
    const ab = r.b.clone().sub(r.a).normalize()
    const nrm = new THREE.Vector3(-ab.z, 0, ab.x).multiplyScalar(side)
    const a = (dir > 0 ? r.a : r.b).clone().add(nrm)
    const b = (dir > 0 ? r.b : r.a).clone().add(nrm)
    carA.set([a.x, 1, a.z], i * 3)
    carB.set([b.x, 1, b.z], i * 3)
    carS[i] = rand()
  }
  const carGeo = new THREE.BufferGeometry()
  carGeo.setAttribute('position', new THREE.BufferAttribute(carPos, 3))
  carGeo.setAttribute('aA', new THREE.BufferAttribute(carA, 3))
  carGeo.setAttribute('aB', new THREE.BufferAttribute(carB, 3))
  carGeo.setAttribute('aSeed', new THREE.BufferAttribute(carS, 1))
  const cars = new THREE.Points(
    carGeo,
    new THREE.ShaderMaterial({
      uniforms: worldUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aA; attribute vec3 aB; attribute float aSeed; uniform float uTime; varying vec3 vC;
        void main(){
          float t = fract(aSeed * 7.3 + uTime * (0.006 + aSeed * 0.006));
          vec3 p = mix(aA, aB, t);
          // Phares blancs d'un côté, feux rouges de l'autre (selon le sens de circulation).
          vC = fract(aSeed * 13.0) > 0.5 ? vec3(3.0, 2.6, 2.0) : vec3(2.6, 0.25, 0.15);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 900.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = (1.0 - smoothstep(0.0, 0.5, d)); gl_FragColor = vec4(vC * a, a); }`,
    }),
  )
  cars.frustumCulled = false
  scene.add(cars)

  // Arbres autour du parvis.
  const nTrees = tier === 'low' ? 90 : 220
  const treeGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.25, 0.35, 3, 5).translate(0, 1.5, 0).toNonIndexed(),
    new THREE.IcosahedronGeometry(2.6, 0).translate(0, 4.6, 0),
  ])!
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ color: 0x0f1d12 }), nTrees)
  let tp = 0
  for (let i = 0; i < nTrees * 4 && tp < nTrees; i++) {
    const a = rand() * Math.PI * 2
    const r = 112 + rand() * 30
    const x = Math.cos(a) * r * 1.05
    const z = Math.sin(a) * r * 0.92
    if (nearRoad(x, z)) continue
    const s = 0.8 + rand() * 0.6
    m4.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6), new THREE.Vector3(s, s, s))
    trees.setMatrixAt(tp++, m4)
  }
  trees.count = tp
  scene.add(trees)

  // Parking avec des voitures garées (couleurs variées).
  const nParked = tier === 'low' ? 120 : 260
  const parked = new THREE.InstancedMesh(
    mergeGeometries([new THREE.BoxGeometry(4.3, 0.8, 1.8).translate(0, 0.55, 0), new THREE.BoxGeometry(2.4, 0.6, 1.6).translate(-0.2, 1.2, 0)])!,
    new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 }),
    nParked,
  )
  const carCols = ['#c9ccd3', '#1a1c22', '#2c3e66', '#7a1f25', '#e6e6e6', '#555a63', '#30343c']
  for (let i = 0; i < nParked; i++) {
    const row = Math.floor(i / 26)
    const col = i % 26
    m4.compose(new THREE.Vector3(-70 + col * 2.6 + rand() * 0.2, 0, -150 - row * 7), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2 + (rand() - 0.5) * 0.06), new THREE.Vector3(1, 1, 1))
    parked.setMatrixAt(i, m4)
    parked.setColorAt(i, new THREE.Color(carCols[Math.floor(rand() * carCols.length)]))
  }
  scene.add(parked)
}

/** Une petite « image d'environnement » pour que les métaux reflètent les projecteurs. */
export function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  const bg = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'varying vec3 vD; void main(){ float h = vD.y; vec3 c = mix(vec3(0.05,0.045,0.04), vec3(0.01,0.015,0.035), smoothstep(-0.1,0.6,h)); c = mix(c, vec3(0.03,0.06,0.03), (1.0 - smoothstep(-0.5,0.0,h))); gl_FragColor = vec4(c,1.0); }',
    }),
  )
  env.add(bg)
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 13, 11) })
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5), lamp)
    m.position.set(x * 26, 20, z * 20)
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  const pmrem = new THREE.PMREMGenerator(renderer)
  const tex = pmrem.fromScene(env, 0.02).texture
  pmrem.dispose()
  return tex
}
