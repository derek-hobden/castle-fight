export type Team = 'player' | 'enemy'

export type BuildingKind = 'barracks' | 'archery' | 'stables' | 'tower'

export type UnitKind = 'footman' | 'archer' | 'knight'

export interface BuildingDef {
  kind: BuildingKind
  name: string
  cost: number
  description: string
  spawnUnit?: UnitKind
  spawnInterval: number
  hp: number
  attack?: number
  range?: number
  attackInterval?: number
}

export interface UnitDef {
  kind: UnitKind
  name: string
  hp: number
  damage: number
  speed: number
  range: number
  attackInterval: number
  radius: number
}

export interface Vec2 {
  x: number
  z: number
}

export interface Building {
  id: number
  team: Team
  kind: BuildingKind
  position: Vec2
  hp: number
  maxHp: number
  spawnTimer: number
  attackTimer: number
}

export interface Unit {
  id: number
  team: Team
  kind: UnitKind
  position: Vec2
  hp: number
  maxHp: number
  attackTimer: number
  targetId: number | null
}

export interface Castle {
  team: Team
  position: Vec2
  hp: number
  maxHp: number
}

export interface GameSnapshot {
  gold: number
  income: number
  playerCastleHp: number
  playerCastleMax: number
  enemyCastleHp: number
  enemyCastleMax: number
  status: 'menu' | 'playing' | 'victory' | 'defeat'
  selectedBuild: BuildingKind | null
  buildings: Building[]
  units: Unit[]
}

export const BUILDING_DEFS: Record<BuildingKind, BuildingDef> = {
  barracks: {
    kind: 'barracks',
    name: 'Barracks',
    cost: 100,
    description: 'Musters footmen every 7s.',
    spawnUnit: 'footman',
    spawnInterval: 7,
    hp: 400,
  },
  archery: {
    kind: 'archery',
    name: 'Archer Range',
    cost: 140,
    description: 'Looses archers every 9s.',
    spawnUnit: 'archer',
    spawnInterval: 9,
    hp: 350,
  },
  stables: {
    kind: 'stables',
    name: 'War Stables',
    cost: 200,
    description: 'Charges knights every 12s.',
    spawnUnit: 'knight',
    spawnInterval: 12,
    hp: 450,
  },
  tower: {
    kind: 'tower',
    name: 'Watchtower',
    cost: 120,
    description: 'Static defense — bolts nearby foes.',
    spawnInterval: 0,
    hp: 500,
    attack: 18,
    range: 10,
    attackInterval: 1.2,
  },
}

export const UNIT_DEFS: Record<UnitKind, UnitDef> = {
  footman: {
    kind: 'footman',
    name: 'Footman',
    hp: 90,
    damage: 12,
    speed: 4.2,
    range: 1.4,
    attackInterval: 0.9,
    radius: 0.55,
  },
  archer: {
    kind: 'archer',
    name: 'Archer',
    hp: 55,
    damage: 14,
    speed: 4.6,
    range: 7,
    attackInterval: 1.1,
    radius: 0.45,
  },
  knight: {
    kind: 'knight',
    name: 'Knight',
    hp: 160,
    damage: 22,
    speed: 5.4,
    range: 1.6,
    attackInterval: 1.0,
    radius: 0.7,
  },
}

export const CASTLE_MAX_HP = 2000
export const MAP_HALF = 42
export const BUILD_MARGIN = 6
