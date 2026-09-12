import * as THREE from 'three'

const TEAM_COLORS = {
  player: {
    primary: 0x2f6b4f,
    accent: 0xc9a227,
    stone: 0x8a8578,
    roof: 0x3d5c48,
  },
  enemy: {
    primary: 0x8b2e2e,
    accent: 0xb87333,
    stone: 0x6e6660,
    roof: 0x5c2a2a,
  },
} as const

function mat(color: number, opts?: { roughness?: number; metalness?: number }) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.roughness ?? 0.85,
    metalness: opts?.metalness ?? 0.05,
  })
}

function addBox(
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
  opts?: { roughness?: number; metalness?: number },
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addCyl(
  parent: THREE.Group,
  rTop: number,
  rBot: number,
  h: number,
  color: number,
  x: number,
  y: number,
  z: number,
  segments = 8,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), mat(color))
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function createTerrain(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'terrain'

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 100),
    new THREE.MeshStandardMaterial({ color: 0x3a5a3c, roughness: 0.95 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  group.add(ground)

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 88),
    new THREE.MeshStandardMaterial({ color: 0x4a4638, roughness: 1 }),
  )
  lane.rotation.x = -Math.PI / 2
  lane.position.y = 0.02
  lane.receiveShadow = true
  group.add(lane)

  // Soft path edges
  for (const x of [-8, 8]) {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 88),
      new THREE.MeshStandardMaterial({ color: 0x44553a, roughness: 0.98 }),
    )
    edge.rotation.x = -Math.PI / 2
    edge.position.set(x, 0.015, 0)
    group.add(edge)
  }

  // Rocks / props
  const rng = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  for (let i = 0; i < 28; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + rng(i) * 0.7, 0),
      mat(0x6a655c),
    )
    rock.position.set(side * (12 + rng(i + 3) * 18), 0.25, -40 + rng(i + 7) * 80)
    rock.rotation.set(rng(i + 1), rng(i + 2) * Math.PI, rng(i + 4))
    rock.castShadow = true
    rock.receiveShadow = true
    group.add(rock)
  }

  // Trees as simple cones
  for (let i = 0; i < 16; i++) {
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.2, 6), mat(0x5c4030))
    trunk.position.y = 0.6
    trunk.castShadow = true
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 7), mat(0x2d4a32))
    canopy.position.y = 2.1
    canopy.castShadow = true
    tree.add(trunk, canopy)
    const side = i % 2 === 0 ? -1 : 1
    tree.position.set(side * (16 + rng(i + 20) * 12), 0, -35 + rng(i + 30) * 70)
    group.add(tree)
  }

  return group
}

export function createCastle(team: 'player' | 'enemy'): THREE.Group {
  const c = TEAM_COLORS[team]
  const g = new THREE.Group()
  g.name = `castle-${team}`

  addBox(g, 8, 4, 8, c.stone, 0, 2, 0)
  addBox(g, 9, 0.6, 9, c.roof, 0, 4.2, 0)
  addBox(g, 3, 3.2, 2.2, c.primary, 0, 1.6, 4.2)

  for (const [x, z] of [
    [-3.5, -3.5],
    [3.5, -3.5],
    [-3.5, 3.5],
    [3.5, 3.5],
  ] as const) {
    addCyl(g, 1.1, 1.25, 5.5, c.stone, x, 2.75, z, 8)
    addBox(g, 2.4, 0.7, 2.4, c.roof, x, 5.7, z)
    addBox(g, 0.5, 1.1, 0.15, c.accent, x, 6.5, z, { metalness: 0.4 })
  }

  // Banner
  addBox(g, 0.15, 3.5, 0.15, 0x3a342c, 0, 6.5, -1)
  addBox(g, 1.4, 1.8, 0.08, c.primary, 0.75, 6.8, -1)

  return g
}

export function createBuildingMesh(
  kind: 'barracks' | 'archery' | 'stables' | 'tower',
  team: 'player' | 'enemy',
): THREE.Group {
  const c = TEAM_COLORS[team]
  const g = new THREE.Group()
  g.name = `building-${kind}`

  switch (kind) {
    case 'barracks': {
      addBox(g, 3.2, 2.2, 3.6, c.stone, 0, 1.1, 0)
      addBox(g, 3.6, 0.45, 4, c.roof, 0, 2.35, 0)
      addBox(g, 1.1, 1.6, 0.3, c.primary, 0, 0.9, 1.9)
      addCyl(g, 0.35, 0.4, 2.8, c.accent, -1.5, 1.4, -1.4, 6)
      break
    }
    case 'archery': {
      addBox(g, 2.8, 1.8, 2.8, c.stone, 0, 0.9, 0)
      addBox(g, 3.1, 0.35, 3.1, c.roof, 0, 1.95, 0)
      addCyl(g, 0.25, 0.3, 3.4, 0x5c4030, 1.2, 1.7, 1.1, 6)
      addBox(g, 0.15, 1.2, 0.8, c.accent, 1.2, 3.4, 1.1)
      break
    }
    case 'stables': {
      addBox(g, 4.2, 1.6, 3.2, c.stone, 0, 0.8, 0)
      addBox(g, 4.6, 0.4, 3.6, c.roof, 0, 1.8, 0)
      addBox(g, 1.4, 1.2, 0.25, c.primary, -1.2, 0.7, 1.7)
      addBox(g, 1.4, 1.2, 0.25, c.primary, 1.2, 0.7, 1.7)
      break
    }
    case 'tower': {
      addCyl(g, 1.3, 1.5, 4.5, c.stone, 0, 2.25, 0, 8)
      addBox(g, 3.2, 0.5, 3.2, c.roof, 0, 4.6, 0)
      addBox(g, 0.8, 0.9, 0.8, c.primary, 0, 5.2, 0)
      addBox(g, 0.2, 1.4, 0.2, c.accent, 0, 6.1, 0, { metalness: 0.35 })
      break
    }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }

  return g
}

export function createUnitMesh(
  kind: 'footman' | 'archer' | 'knight',
  team: 'player' | 'enemy',
): THREE.Group {
  const c = TEAM_COLORS[team]
  const g = new THREE.Group()
  g.name = `unit-${kind}`

  switch (kind) {
    case 'footman': {
      addCyl(g, 0.35, 0.4, 0.9, c.primary, 0, 0.55, 0, 8)
      addCyl(g, 0.28, 0.28, 0.35, 0xe8d5b5, 0, 1.2, 0, 8)
      addBox(g, 0.12, 1.1, 0.12, 0x888888, 0.45, 0.9, 0, { metalness: 0.5 })
      break
    }
    case 'archer': {
      addCyl(g, 0.28, 0.32, 0.85, c.primary, 0, 0.5, 0, 8)
      addCyl(g, 0.24, 0.24, 0.3, 0xe8d5b5, 0, 1.1, 0, 8)
      addBox(g, 0.08, 0.9, 0.08, 0x5c4030, 0.4, 0.85, 0)
      break
    }
    case 'knight': {
      addCyl(g, 0.45, 0.5, 1.1, c.primary, 0, 0.7, 0, 8)
      addCyl(g, 0.32, 0.32, 0.4, 0xc0c0c0, 0, 1.4, 0, 8)
      addBox(g, 0.18, 1.3, 0.18, 0xaaaaaa, 0.55, 1.0, 0, { metalness: 0.6 })
      addBox(g, 0.7, 0.15, 0.5, c.accent, 0, 1.0, -0.15)
      break
    }
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }

  return g
}

export function createHpBar(): THREE.Group {
  const g = new THREE.Group()
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }),
  )
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.36, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x4caf50, depthTest: false }),
  )
  fill.name = 'hpFill'
  fill.position.z = 0.01
  g.add(bg, fill)
  g.position.y = 2.2
  return g
}
