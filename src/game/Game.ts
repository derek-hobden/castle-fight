import {
  BUILDING_DEFS,
  BUILD_MARGIN,
  CASTLE_MAX_HP,
  MAP_HALF,
  UNIT_DEFS,
  type Building,
  type BuildingKind,
  type Castle,
  type GameSnapshot,
  type Team,
  type Unit,
  type UnitKind,
  type Vec2,
} from './types'

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return Math.hypot(dx, dz)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export class Game {
  status: GameSnapshot['status'] = 'menu'
  gold = 50
  income = 5
  incomeTimer = 0
  selectedBuild: BuildingKind | null = null
  buildings: Building[] = []
  units: Unit[] = []
  playerCastle: Castle = {
    team: 'player',
    position: { x: 0, z: -MAP_HALF },
    hp: CASTLE_MAX_HP,
    maxHp: CASTLE_MAX_HP,
  }
  enemyCastle: Castle = {
    team: 'enemy',
    position: { x: 0, z: MAP_HALF },
    hp: CASTLE_MAX_HP,
    maxHp: CASTLE_MAX_HP,
  }

  private nextId = 1
  private aiTimer = 3
  private aiGold = 50
  private matchTime = 0
  private occupied = new Set<string>()

  start(): void {
    this.status = 'playing'
    this.gold = 50
    this.income = 5
    this.incomeTimer = 0
    this.selectedBuild = null
    this.buildings = []
    this.units = []
    this.playerCastle.hp = CASTLE_MAX_HP
    this.enemyCastle.hp = CASTLE_MAX_HP
    this.nextId = 1
    this.aiTimer = 2.5
    this.aiGold = 55
    this.matchTime = 0
    this.occupied.clear()
  }

  selectBuild(kind: BuildingKind | null): void {
    if (this.status !== 'playing') return
    this.selectedBuild = kind
  }

  tryPlaceBuilding(worldX: number, worldZ: number): { ok: boolean; message: string } {
    if (this.status !== 'playing' || !this.selectedBuild) {
      return { ok: false, message: 'Select a structure from the build menu first.' }
    }
    return this.placeBuilding('player', this.selectedBuild, worldX, worldZ, true)
  }

  private placeBuilding(
    team: Team,
    kind: BuildingKind,
    worldX: number,
    worldZ: number,
    spendGold: boolean,
  ): { ok: boolean; message: string } {
    const def = BUILDING_DEFS[kind]
    const goldPool = team === 'player' ? this.gold : this.aiGold
    if (spendGold && goldPool < def.cost) {
      return { ok: false, message: `Need ${def.cost} gold for a ${def.name}.` }
    }

    const x = clamp(Math.round(worldX / 3) * 3, -18, 18)
    const z =
      team === 'player'
        ? clamp(Math.round(worldZ / 3) * 3, -MAP_HALF + 10, -8)
        : clamp(Math.round(worldZ / 3) * 3, 8, MAP_HALF - 10)

    if (Math.abs(x) < BUILD_MARGIN && Math.abs(z) > MAP_HALF - 8) {
      return { ok: false, message: 'Too close to a castle keep.' }
    }

    const key = `${team}:${x}:${z}`
    if (this.occupied.has(key)) {
      return { ok: false, message: 'That plot is already claimed.' }
    }

    // Keep clear of lane center a bit for towers only? Allow all.
    for (const b of this.buildings) {
      if (dist(b.position, { x, z }) < 3.2) {
        return { ok: false, message: 'Too close to another structure.' }
      }
    }

    if (spendGold) {
      if (team === 'player') this.gold -= def.cost
      else this.aiGold -= def.cost
    }

    this.occupied.add(key)
    this.buildings.push({
      id: this.nextId++,
      team,
      kind,
      position: { x, z },
      hp: def.hp,
      maxHp: def.hp,
      spawnTimer: def.spawnInterval * 0.35,
      attackTimer: 0,
    })

    return { ok: true, message: `${def.name} raised.` }
  }

  update(dt: number): void {
    if (this.status !== 'playing') return
    this.matchTime += dt

    this.incomeTimer += dt
    if (this.incomeTimer >= 2) {
      this.incomeTimer = 0
      this.gold += this.income
      this.aiGold += this.income + 1
      if (this.matchTime > 45 && this.income < 12) {
        this.income += 1
      }
    }

    this.updateBuildings(dt)
    this.updateUnits(dt)
    this.updateAi(dt)
    this.checkVictory()
  }

  private updateBuildings(dt: number): void {
    for (const b of this.buildings) {
      const def = BUILDING_DEFS[b.kind]
      if (def.spawnUnit) {
        b.spawnTimer -= dt
        if (b.spawnTimer <= 0) {
          b.spawnTimer = def.spawnInterval
          this.spawnUnit(b.team, def.spawnUnit, {
            x: b.position.x + (Math.random() - 0.5) * 1.5,
            z: b.position.z + (b.team === 'player' ? 2 : -2),
          })
        }
      }

      if (def.attack && def.range && def.attackInterval) {
        b.attackTimer -= dt
        if (b.attackTimer <= 0) {
          const target = this.findNearestHostile(b.team, b.position, def.range)
          if (target) {
            this.damageTarget(target, def.attack)
            b.attackTimer = def.attackInterval
          }
        }
      }
    }
  }

  private spawnUnit(team: Team, kind: UnitKind, position: Vec2): void {
    const def = UNIT_DEFS[kind]
    this.units.push({
      id: this.nextId++,
      team,
      kind,
      position: { ...position },
      hp: def.hp,
      maxHp: def.hp,
      attackTimer: 0,
      targetId: null,
    })
  }

  private updateUnits(dt: number): void {
    const alive: Unit[] = []

    for (const u of this.units) {
      if (u.hp <= 0) continue
      const def = UNIT_DEFS[u.kind]
      u.attackTimer = Math.max(0, u.attackTimer - dt)

      const enemy = this.findNearestHostile(u.team, u.position, def.range + 8)
      const castle = u.team === 'player' ? this.enemyCastle : this.playerCastle
      const castleDist = dist(u.position, castle.position)

      let targetPos: Vec2 | null = null
      let attacking = false

      if (enemy && dist(u.position, enemy.position) <= def.range + 0.2) {
        attacking = true
        if (u.attackTimer <= 0) {
          this.damageTarget(enemy, def.damage)
          u.attackTimer = def.attackInterval
        }
      } else if (castleDist <= def.range + 3.5) {
        attacking = true
        if (u.attackTimer <= 0) {
          castle.hp -= def.damage
          u.attackTimer = def.attackInterval
        }
      } else if (enemy && dist(u.position, enemy.position) < def.range + 8) {
        targetPos = enemy.position
      } else {
        targetPos = castle.position
      }

      if (!attacking && targetPos) {
        const dx = targetPos.x - u.position.x
        const dz = targetPos.z - u.position.z
        const d = Math.hypot(dx, dz) || 1
        const step = def.speed * dt
        u.position.x += (dx / d) * step
        u.position.z += (dz / d) * step
        // Slight lane centering
        u.position.x += (-u.position.x) * 0.15 * dt
        u.position.x = clamp(u.position.x, -22, 22)
      }

      if (u.hp > 0) alive.push(u)
    }

    this.units = alive
    this.buildings = this.buildings.filter((b) => b.hp > 0)
  }

  private damageTarget(
    target: { hp: number; id?: number; kind?: string },
    amount: number,
  ): void {
    target.hp -= amount
  }

  private findNearestHostile(
    team: Team,
    from: Vec2,
    maxRange: number,
  ): (Unit | Building) | null {
    let best: (Unit | Building) | null = null
    let bestD = maxRange
    for (const u of this.units) {
      if (u.team === team || u.hp <= 0) continue
      const d = dist(from, u.position)
      if (d < bestD) {
        bestD = d
        best = u
      }
    }
    for (const b of this.buildings) {
      if (b.team === team || b.hp <= 0) continue
      const d = dist(from, b.position)
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    return best
  }

  private updateAi(dt: number): void {
    this.aiTimer -= dt
    if (this.aiTimer > 0) return

    const kinds: BuildingKind[] = ['barracks', 'tower', 'archery', 'stables', 'barracks']
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!
    const def = BUILDING_DEFS[kind]
    if (this.aiGold < def.cost) {
      this.aiTimer = 1.5
      return
    }

    const x = (Math.floor(Math.random() * 7) - 3) * 3
    const z = 10 + Math.floor(Math.random() * 8) * 3
    const result = this.placeBuilding('enemy', kind, x, z, true)
    this.aiTimer = result.ok ? 4 + Math.random() * 3 : 1.2
  }

  private checkVictory(): void {
    if (this.enemyCastle.hp <= 0) {
      this.enemyCastle.hp = 0
      this.status = 'victory'
    } else if (this.playerCastle.hp <= 0) {
      this.playerCastle.hp = 0
      this.status = 'defeat'
    }
  }

  surrender(): void {
    if (this.status === 'playing') this.status = 'defeat'
  }

  snapshot(): GameSnapshot {
    return {
      gold: this.gold,
      income: this.income,
      playerCastleHp: this.playerCastle.hp,
      playerCastleMax: this.playerCastle.maxHp,
      enemyCastleHp: this.enemyCastle.hp,
      enemyCastleMax: this.enemyCastle.maxHp,
      status: this.status,
      selectedBuild: this.selectedBuild,
      buildings: this.buildings,
      units: this.units,
    }
  }
}
