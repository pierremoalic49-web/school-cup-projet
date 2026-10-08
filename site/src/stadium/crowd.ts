// La foule. Chaque supporter est une petite figurine (jambes, buste, tête, bras, pancarte de tifo).
// Il y en a des milliers : on les dessine tous d'un coup (« instancing ») et c'est la carte graphique
// qui les anime (ola, bras levés, sauts sur un but). Le processeur du téléphone n'a presque rien à faire.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export interface Fan {
  x: number
  y: number
  z: number
  shirt: THREE.Color
  mode: 0 | 1 // 1 = tient une pancarte de tifo
}

export const crowdUniforms = {
  uTime: { value: 0 },
  uHype: { value: 0.3 }, // excitation générale
  uJump: { value: 0 }, // 1 = tout le monde saute (but !)
  uOla: { value: 1 },
}

function part(g: THREE.BufferGeometry, id: number) {
  g.deleteAttribute('uv')
  const ng = g.index ? g.toNonIndexed() : g
  ng.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count).fill(id), 1))
  return ng
}

function fanGeometry(detail: boolean) {
  const parts: THREE.BufferGeometry[] = [
    part(new THREE.BoxGeometry(0.34, 0.5, 0.24).translate(0, 0.25, 0), 4),
    part(new THREE.CylinderGeometry(0.21, 0.17, 0.58, detail ? 7 : 5).translate(0, 0.79, 0), 0),
    part(new THREE.SphereGeometry(0.115, detail ? 8 : 6, detail ? 6 : 4).translate(0, 1.22, 0), 1),
  ]
  if (detail) {
    parts.push(part(new THREE.BoxGeometry(0.085, 0.56, 0.1).translate(-0.255, 0.76, 0), 2))
    parts.push(part(new THREE.BoxGeometry(0.085, 0.56, 0.1).translate(0.255, 0.76, 0), 3))
  }
  parts.push(part(new THREE.PlaneGeometry(0.62, 0.5).rotateY(Math.PI).translate(0, 1.62, -0.12), 5))
  return mergeGeometries(parts)!
}

const skinTones = ['#f1c7a5', '#e0ac85', '#c68c63', '#9b6a45', '#6e4a30', '#f5d3b8', '#d9a07a'].map((c) => new THREE.Color(c))

export function buildCrowd(fans: Fan[], parent: THREE.Object3D, detail: boolean, rand: () => number) {
  const ig = fanGeometry(detail)
  const n = fans.length
  const shirt = new Float32Array(n * 3)
  const skin = new Float32Array(n * 3)
  const seed = new Float32Array(n)
  const mode = new Float32Array(n)

  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
  const mesh = new THREE.InstancedMesh(ig, mat, n)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const one = new THREE.Vector3(1, 1, 1)
  fans.forEach((f, i) => {
    q.setFromAxisAngle(up, (rand() - 0.5) * 0.5)
    m4.compose(new THREE.Vector3(f.x, f.y, f.z), q, one)
    mesh.setMatrixAt(i, m4)
    const s = skinTones[Math.floor(rand() * skinTones.length)]
    const b = 0.75 + rand() * 0.35
    shirt.set([f.shirt.r * b, f.shirt.g * b, f.shirt.b * b], i * 3)
    skin.set([s.r, s.g, s.b], i * 3)
    seed[i] = rand()
    mode[i] = f.mode
  })
  ig.setAttribute('aShirt', new THREE.InstancedBufferAttribute(shirt, 3))
  ig.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3))
  ig.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
  ig.setAttribute('aMode', new THREE.InstancedBufferAttribute(mode, 1))
  mesh.computeBoundingSphere()

  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, crowdUniforms)
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPart; attribute vec3 aShirt; attribute vec3 aSkin; attribute float aSeed; attribute float aMode;
        uniform float uTime, uHype, uJump, uOla;
        varying vec3 vCol;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 wpos = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
        // Ola : une vague qui fait le tour du stade.
        float ang = atan(wpos.z, wpos.x * 0.62);
        float d = cos(ang - uTime * 0.75);
        float ola = smoothstep(0.92, 1.0, d) * uOla;
        float jump = max(0.0, sin(uTime * (5.0 + aSeed * 3.0) + aSeed * 31.0)) * uJump;
        float idle = sin(uTime * (0.8 + aSeed) + aSeed * 20.0) * 0.5 + 0.5;
        // Morphologies variées.
        transformed.xz *= 0.88 + 0.24 * fract(aSeed * 5.31);
        transformed.y *= 0.9 + 0.16 * fract(aSeed * 3.17);
        float armUp = clamp(ola * 1.4 + uJump * step(0.35, aSeed) + step(0.9, fract(aSeed * 13.7)) * uHype + aMode * 0.62, 0.0, 1.0);
        if (aPart > 1.5 && aPart < 3.5) {
          float side = aPart < 2.5 ? -1.0 : 1.0;
          vec2 sh = vec2(side * 0.25, 1.03);
          vec2 p = transformed.xy - sh;
          float a = side * armUp * (2.55 + 0.25 * sin(uTime * 9.0 + aSeed * 9.0) * uJump);
          float c = cos(a), s = sin(a);
          transformed.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + sh;
        }
        if (aPart > 4.5) transformed *= aMode;
        transformed.y += ola * 0.32 + jump * 0.3 + idle * 0.035 * uHype;
        vCol = aPart < 0.5 ? aShirt : aPart < 1.5 ? aSkin : aPart < 3.5 ? aShirt : aPart < 4.5 ? vec3(0.05, 0.05, 0.07) : aShirt * 1.25;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCol;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vCol, opacity );')
  }
  parent.add(mesh)
  return mesh
}

/* ------------------------- Drapeaux dans la foule ------------------------- */

export function buildFlags(spots: THREE.Vector3[], scene: THREE.Scene, rand: () => number) {
  const n = spots.length
  const ig = new THREE.PlaneGeometry(1.6, 1.05, 10, 3).translate(0.8, 0, 0)
  const pairs: [string, string][] = [
    ['#ffc63d', '#141a3a'],
    ['#ffffff', '#ffc63d'],
    ['#3fe3ff', '#0b1230'],
    ['#ff6fb0', '#ffffff'],
    ['#ffc63d', '#ffffff'],
    ['#14183a', '#ffc63d'],
  ]
  const c1 = new Float32Array(n * 3)
  const c2 = new Float32Array(n * 3)
  const sd = new Float32Array(n)
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
  const mesh = new THREE.InstancedMesh(ig, mat, n)
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 4).translate(0, 1.3, 0), new THREE.MeshLambertMaterial({ color: 0x777777 }), n)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  spots.forEach((p, i) => {
    const [a, b] = pairs[Math.floor(rand() * pairs.length)]
    const ca = new THREE.Color(a)
    const cb = new THREE.Color(b)
    c1.set([ca.r, ca.g, ca.b], i * 3)
    c2.set([cb.r, cb.g, cb.b], i * 3)
    sd[i] = rand()
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2)
    m4.compose(new THREE.Vector3(p.x, p.y + 2.05, p.z), q, new THREE.Vector3(1, 1, 1))
    mesh.setMatrixAt(i, m4)
    m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(1, 1, 1))
    poles.setMatrixAt(i, m4)
  })
  ig.setAttribute('aC1', new THREE.InstancedBufferAttribute(c1, 3))
  ig.setAttribute('aC2', new THREE.InstancedBufferAttribute(c2, 3))
  ig.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1))
  mesh.frustumCulled = false
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, crowdUniforms)
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aC1; attribute vec3 aC2; attribute float aSeed;
        uniform float uTime, uJump;
        varying vec3 vC1; varying vec3 vC2; varying vec2 vUv2;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float k = position.x / 1.6;
        float speed = 3.0 + aSeed * 2.0 + uJump * 4.0;
        transformed.z += sin(uTime * speed - position.x * 3.2 + aSeed * 20.0) * 0.22 * k;
        transformed.y += sin(uTime * speed * 0.7 - position.x * 2.0) * 0.06 * k;
        vC1 = aC1; vC2 = aC2; vUv2 = uv;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vC1; varying vec3 vC2; varying vec2 vUv2;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse * (abs(vUv2.y - 0.5) < 0.17 ? vC2 : vC1), opacity );',
      )
  }
  scene.add(mesh, poles)
  return mesh
}

/* ---------------- Flashs de téléphones (petits éclairs dans les tribunes) ---------------- */

export const flashUniforms = { uPhase: { value: 0 }, uScale: { value: 300 } }

export function buildPhoneFlashes(spots: THREE.Vector3[], scene: THREE.Scene, rand: () => number) {
  const n = spots.length
  const pos = new Float32Array(n * 3)
  const seed = new Float32Array(n)
  spots.forEach((p, i) => {
    pos.set([p.x, p.y + 1.45, p.z], i * 3)
    seed[i] = rand()
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: flashUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uPhase; uniform float uScale; varying float vOn;
      void main(){
        float f = fract(uPhase * (0.08 + aSeed * 0.12) + aSeed * 57.0);
        vOn = smoothstep(0.0, 0.004, f) * (1.0 - smoothstep(0.004, 0.03, f));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = vOn * uScale * 0.9 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vOn;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * 3.0 * a * vOn, a * vOn);
      }`,
  })
  const pts = new THREE.Points(g, mat)
  pts.frustumCulled = false
  scene.add(pts)
  return pts
}
