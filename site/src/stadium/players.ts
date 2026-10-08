// Les deux équipes alignées au milieu du terrain, comme juste avant le coup d'envoi d'une finale.
// Leurs maillots prennent les couleurs des équipes du match mis en avant.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { crowdUniforms } from './crowd'

function part(g: THREE.BufferGeometry, id: number) {
  g.deleteAttribute('uv')
  const ng = g.index ? g.toNonIndexed() : g
  ng.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count).fill(id), 1))
  return ng
}

// 0 maillot, 1 peau, 2 short, 3 chaussettes, 4 chaussures
function playerGeometry() {
  const leg = (x: number) => [
    part(new THREE.CylinderGeometry(0.075, 0.06, 0.42, 6).translate(x, 0.62, 0), 1),
    part(new THREE.CylinderGeometry(0.06, 0.05, 0.4, 6).translate(x, 0.24, 0), 3),
    part(new THREE.BoxGeometry(0.11, 0.07, 0.26).translate(x, 0.035, 0.05), 4),
  ]
  return mergeGeometries([
    ...leg(-0.1),
    ...leg(0.1),
    part(new THREE.BoxGeometry(0.36, 0.22, 0.22).translate(0, 0.9, 0), 2),
    part(new THREE.CylinderGeometry(0.2, 0.16, 0.56, 8).translate(0, 1.27, 0), 0),
    part(new THREE.CylinderGeometry(0.055, 0.05, 0.3, 5).translate(-0.25, 1.38, 0), 0),
    part(new THREE.CylinderGeometry(0.055, 0.05, 0.3, 5).translate(0.25, 1.38, 0), 0),
    part(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 5).translate(-0.27, 1.07, 0), 1),
    part(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 5).translate(0.27, 1.07, 0), 1),
    part(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 6).translate(0, 1.6, 0), 1),
    part(new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1.12, 1).translate(0, 1.73, 0), 1),
  ])!
}

export function buildLineup(scene: THREE.Scene) {
  const perTeam = 11
  const n = perTeam * 2 + 3
  const geo = playerGeometry()
  const shirt = new Float32Array(n * 3)
  const shorts = new Float32Array(n * 3)
  const socks = new Float32Array(n * 3)
  const skin = new Float32Array(n * 3)
  const seed = new Float32Array(n)
  const tones = ['#f1c7a5', '#c68c63', '#8a5a3c', '#e0ac85', '#5e3f2a', '#f5d3b8']
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.7 })
  const mesh = new THREE.InstancedMesh(geo, mat, n)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  for (let i = 0; i < n; i++) {
    let x: number
    if (i < perTeam) x = -2.2 - i * 1.15
    else if (i < perTeam * 2) x = 2.2 + (i - perTeam) * 1.15
    else x = (i - perTeam * 2 - 1) * 0.95
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.12)
    const s = 0.94 + Math.random() * 0.1
    m4.compose(new THREE.Vector3(x, 0, -1.2), q, new THREE.Vector3(s, s, s))
    mesh.setMatrixAt(i, m4)
    const c = new THREE.Color(tones[Math.floor(Math.random() * tones.length)])
    skin.set([c.r, c.g, c.b], i * 3)
    seed[i] = Math.random()
  }
  geo.setAttribute('aShirt', new THREE.InstancedBufferAttribute(shirt, 3))
  geo.setAttribute('aShorts', new THREE.InstancedBufferAttribute(shorts, 3))
  geo.setAttribute('aSocks', new THREE.InstancedBufferAttribute(socks, 3))
  geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3))
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, crowdUniforms)
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPart; attribute vec3 aShirt; attribute vec3 aShorts; attribute vec3 aSocks; attribute vec3 aSkin; attribute float aSeed;
        uniform float uTime, uJump; varying vec3 vCol;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Petit balancement d'attente, et un saut de joie sur les buts.
        float sway = sin(uTime * 1.3 + aSeed * 12.0) * 0.025;
        transformed.x += sway * transformed.y;
        transformed.y += max(0.0, sin(uTime * 6.0 + aSeed * 20.0)) * 0.25 * uJump;
        vCol = aPart < 0.5 ? aShirt : aPart < 1.5 ? aSkin : aPart < 2.5 ? aShorts : aPart < 3.5 ? aSocks : vec3(0.04);`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCol;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * vCol, opacity );')
  }
  mesh.castShadow = true
  mesh.computeBoundingSphere()
  scene.add(mesh)

  function setTeams(a: [string, string], b: [string, string]) {
    const set = (i: number, sh: string, so: string, sk: string) => {
      const c1 = new THREE.Color(sh)
      const c2 = new THREE.Color(so)
      const c3 = new THREE.Color(sk)
      shirt.set([c1.r, c1.g, c1.b], i * 3)
      shorts.set([c2.r, c2.g, c2.b], i * 3)
      socks.set([c3.r, c3.g, c3.b], i * 3)
    }
    for (let i = 0; i < perTeam; i++) {
      // Le gardien porte une autre couleur.
      if (i === perTeam - 1) set(i, '#2fd06a', '#111111', '#2fd06a')
      else set(i, a[0], a[1], a[0])
      if (i === perTeam - 1) set(perTeam + i, '#ff8a3d', '#111111', '#ff8a3d')
      else set(perTeam + i, b[0], b[1], b[0])
    }
    for (let i = perTeam * 2; i < n; i++) set(i, '#141414', '#141414', '#141414')
    geo.attributes.aShirt.needsUpdate = true
    geo.attributes.aShorts.needsUpdate = true
    geo.attributes.aSocks.needsUpdate = true
  }
  setTeams(['#FFC63D', '#1A1200'], ['#3FE3FF', '#03202B'])
  return { setTeams }
}
