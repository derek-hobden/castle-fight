import * as THREE from 'three'
import { Game } from './Game'
import {
  createBuildingMesh,
  createCastle,
  createHpBar,
  createTerrain,
  createUnitMesh,
} from './meshes'
import type { Building, BuildingKind, Team, Unit } from './types'

interface Tracked {
  mesh: THREE.Group
  hpBar: THREE.Group
}

export class WorldRenderer {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  private readonly root = new THREE.Group()
  private readonly entities = new Map<number, Tracked>()
  private readonly castles: Record<Team, THREE.Group>
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly hitPoint = new THREE.Vector3()
  private ghost: THREE.Group | null = null
  private ghostKind: BuildingKind | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)
    this.camera.position.set(0, 48, -62)
    this.camera.lookAt(0, 0, -6)

    const context =
      canvas.getContext('webgl2', {
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      }) ||
      canvas.getContext('webgl', {
        antialias: true,
        alpha: false,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
      })
    if (!context) {
      throw new Error('WebGL is not available in this browser.')
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: context as WebGLRenderingContext,
      antialias: true,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene.background = new THREE.Color(0x1a2430)
    this.scene.fog = new THREE.Fog(0x1a2430, 55, 120)

    const hemi = new THREE.HemisphereLight(0xc8d6e5, 0x3a4a32, 0.75)
    this.scene.add(hemi)

    const sun = new THREE.DirectionalLight(0xffd6a0, 1.15)
    sun.position.set(-30, 50, -20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -50
    sun.shadow.camera.right = 50
    sun.shadow.camera.top = 60
    sun.shadow.camera.bottom = -60
    this.scene.add(sun)

    const rim = new THREE.DirectionalLight(0x6a8cae, 0.35)
    rim.position.set(20, 20, 40)
    this.scene.add(rim)

    this.scene.add(this.root)
    this.root.add(createTerrain())

    this.castles = {
      player: createCastle('player'),
      enemy: createCastle('enemy'),
    }
    this.castles.player.position.set(0, 0, -42)
    this.castles.enemy.position.set(0, 0, 42)
    this.root.add(this.castles.player, this.castles.enemy)

    this.onResize()
    window.addEventListener('resize', () => this.onResize())
  }

  onResize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  screenToGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) {
      return { x: this.hitPoint.x, z: this.hitPoint.z }
    }
    return null
  }

  setGhost(kind: BuildingKind | null): void {
    if (this.ghost) {
      this.root.remove(this.ghost)
      this.ghost = null
    }
    this.ghostKind = kind
    if (!kind) return
    this.ghost = createBuildingMesh(kind, 'player')
    this.ghost.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = (obj.material as THREE.Material).clone()
        const m = obj.material as THREE.MeshStandardMaterial
        m.transparent = true
        m.opacity = 0.45
        m.depthWrite = false
      }
    })
    this.ghost.visible = false
    this.root.add(this.ghost)
  }

  updateGhost(clientX: number, clientY: number): void {
    if (!this.ghost || !this.ghostKind) return
    const p = this.screenToGround(clientX, clientY)
    if (!p) {
      this.ghost.visible = false
      return
    }
    this.ghost.visible = true
    this.ghost.position.set(Math.round(p.x / 3) * 3, 0, Math.round(p.z / 3) * 3)
  }

  sync(game: Game): void {
    const live = new Set<number>()

    for (const b of game.buildings) {
      live.add(b.id)
      this.ensureBuilding(b)
      const t = this.entities.get(b.id)!
      t.mesh.position.set(b.position.x, 0, b.position.z)
      this.updateHpBar(t.hpBar, b.hp / b.maxHp, 2.8)
    }

    for (const u of game.units) {
      live.add(u.id)
      this.ensureUnit(u)
      const t = this.entities.get(u.id)!
      t.mesh.position.set(u.position.x, 0, u.position.z)
      const facing = u.team === 'player' ? 0 : Math.PI
      t.mesh.rotation.y = facing
      this.updateHpBar(t.hpBar, u.hp / u.maxHp, u.kind === 'knight' ? 2.4 : 1.9)
    }

    for (const [id, tracked] of this.entities) {
      if (!live.has(id)) {
        this.root.remove(tracked.mesh)
        this.entities.delete(id)
      }
    }

    this.pulseCastle(this.castles.player, game.playerCastle.hp / game.playerCastle.maxHp)
    this.pulseCastle(this.castles.enemy, game.enemyCastle.hp / game.enemyCastle.maxHp)
  }

  private ensureBuilding(b: Building): void {
    if (this.entities.has(b.id)) return
    const mesh = createBuildingMesh(b.kind, b.team)
    const hpBar = createHpBar()
    mesh.add(hpBar)
    this.root.add(mesh)
    this.entities.set(b.id, { mesh, hpBar })
  }

  private ensureUnit(u: Unit): void {
    if (this.entities.has(u.id)) return
    const mesh = createUnitMesh(u.kind, u.team)
    const hpBar = createHpBar()
    mesh.add(hpBar)
    this.root.add(mesh)
    this.entities.set(u.id, { mesh, hpBar })
  }

  private updateHpBar(bar: THREE.Group, ratio: number, y: number): void {
    bar.position.y = y
    bar.quaternion.copy(this.camera.quaternion)
    const fill = bar.getObjectByName('hpFill') as THREE.Mesh
    fill.scale.x = Math.max(0.01, ratio)
    fill.position.x = -0.68 * (1 - ratio)
    const mat = fill.material as THREE.MeshBasicMaterial
    mat.color.setHex(ratio > 0.5 ? 0x4caf50 : ratio > 0.25 ? 0xd4a017 : 0xc62828)
  }

  private pulseCastle(mesh: THREE.Group, ratio: number): void {
    const s = 1 + (1 - ratio) * 0.04
    mesh.scale.setScalar(s)
  }

  render(time: number): void {
    // Gentle camera sway for presence
    this.camera.position.x = Math.sin(time * 0.00015) * 1.5
    this.camera.lookAt(0, 0, -4)
    this.renderer.render(this.scene, this.camera)
  }

  reset(): void {
    for (const [, tracked] of this.entities) {
      this.root.remove(tracked.mesh)
    }
    this.entities.clear()
    this.setGhost(null)
    this.castles.player.scale.setScalar(1)
    this.castles.enemy.scale.setScalar(1)
  }
}
