import './style.css'
import { Game } from './game/Game'
import { WorldRenderer } from './game/WorldRenderer'
import { BUILDING_DEFS, type BuildingKind } from './game/types'

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const hud = document.querySelector<HTMLElement>('#hud')!
const menuOverlay = document.querySelector<HTMLElement>('#menu-overlay')!
const endOverlay = document.querySelector<HTMLElement>('#end-overlay')!
const endTitle = document.querySelector<HTMLElement>('#end-title')!
const endCopy = document.querySelector<HTMLElement>('#end-copy')!
const goldValue = document.querySelector<HTMLElement>('#gold-value')!
const incomeValue = document.querySelector<HTMLElement>('#income-value')!
const playerHp = document.querySelector<HTMLElement>('#player-hp')!
const enemyHp = document.querySelector<HTMLElement>('#enemy-hp')!
const buildButtons = document.querySelector<HTMLElement>('#build-buttons')!
const buildStatus = document.querySelector<HTMLElement>('#build-status')!
const howto = document.querySelector<HTMLElement>('#howto')!

const game = new Game()
let world: WorldRenderer | null = null
let worldError: string | null = null

function ensureWorld(): WorldRenderer {
  if (world) return world
  try {
    world = new WorldRenderer(canvas)
    worldError = null
    return world
  } catch (err) {
    worldError = err instanceof Error ? err.message : 'WebGL is unavailable in this browser.'
    throw err
  }
}

try {
  ensureWorld()
} catch {
  buildStatus.textContent =
    '3D view could not start (WebGL). Try Chrome/Edge with hardware acceleration, then refresh.'
}

const BUILD_ORDER: BuildingKind[] = ['barracks', 'archery', 'stables', 'tower']

function mountBuildMenu(): void {
  buildButtons.innerHTML = ''
  for (const kind of BUILD_ORDER) {
    const def = BUILDING_DEFS[kind]
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'build-btn'
    btn.dataset.kind = kind
    btn.innerHTML = `
      <span class="build-name">${def.name}</span>
      <span class="build-cost">${def.cost}g</span>
      <span class="build-desc">${def.description}</span>
    `
    btn.addEventListener('click', () => {
      const next = game.selectedBuild === kind ? null : kind
      game.selectBuild(next)
      world?.setGhost(next)
      refreshBuildSelection()
      buildStatus.textContent = next
        ? `Placing ${BUILDING_DEFS[next].name} — click your half of the field.`
        : 'Choose a structure, then click open ground.'
    })
    buildButtons.appendChild(btn)
  }
}

function refreshBuildSelection(): void {
  for (const btn of Array.from(buildButtons.querySelectorAll<HTMLButtonElement>('.build-btn'))) {
    const kind = btn.dataset.kind as BuildingKind
    btn.classList.toggle('selected', game.selectedBuild === kind)
    btn.disabled = game.status !== 'playing'
    const def = BUILDING_DEFS[kind]
    btn.classList.toggle('unaffordable', game.gold < def.cost)
  }
}

function setPlayingUi(playing: boolean): void {
  hud.classList.toggle('hidden', !playing)
  menuOverlay.classList.toggle('hidden', playing || game.status !== 'menu')
  endOverlay.classList.toggle('hidden', game.status === 'playing' || game.status === 'menu')
}

function showEnd(): void {
  const victory = game.status === 'victory'
  endTitle.textContent = victory ? 'Victory' : 'Defeat'
  endCopy.textContent = victory
    ? 'The enemy keep cracks under your banners. The lane is yours.'
    : 'Your castle falls in ash and splinters. Raise a new host and try again.'
  endOverlay.classList.remove('hidden')
  hud.classList.add('hidden')
  world?.setGhost(null)
}

function syncHud(): void {
  const snap = game.snapshot()
  goldValue.textContent = String(Math.floor(snap.gold))
  incomeValue.textContent = `+${snap.income}`
  playerHp.style.width = `${(snap.playerCastleHp / snap.playerCastleMax) * 100}%`
  enemyHp.style.width = `${(snap.enemyCastleHp / snap.enemyCastleMax) * 100}%`
  refreshBuildSelection()
}

function startMatch(): void {
  let scene: WorldRenderer
  try {
    scene = ensureWorld()
  } catch {
    buildStatus.textContent =
      worldError ?? 'Cannot start: WebGL failed. Refresh after enabling graphics acceleration.'
    howto.classList.remove('hidden')
    howto.textContent =
      'Castle Fight needs WebGL for the battlefield. Enable hardware acceleration or open this page in a desktop browser, then click Enter the Field again.'
    return
  }
  scene.reset()
  game.start()
  menuOverlay.classList.add('hidden')
  endOverlay.classList.add('hidden')
  hud.classList.remove('hidden')
  buildStatus.textContent = 'Gold is ticking. Raise your first barracks.'
  scene.setGhost(null)
  syncHud()
}

document.querySelector('#btn-start')!.addEventListener('click', startMatch)
document.querySelector('#btn-again')!.addEventListener('click', startMatch)
document.querySelector('#btn-surrender')!.addEventListener('click', () => {
  game.surrender()
  showEnd()
})
document.querySelector('#btn-howto')!.addEventListener('click', () => {
  howto.classList.toggle('hidden')
})

canvas.addEventListener('pointermove', (e) => {
  if (game.selectedBuild && world) world.updateGhost(e.clientX, e.clientY)
})

canvas.addEventListener('pointerdown', (e) => {
  if (game.status !== 'playing' || !game.selectedBuild || !world) return
  const ground = world.screenToGround(e.clientX, e.clientY)
  if (!ground) return
  const result = game.tryPlaceBuilding(ground.x, ground.z)
  buildStatus.textContent = result.message
  if (result.ok) {
    // Keep selection for rapid builds
    syncHud()
  }
})

mountBuildMenu()
setPlayingUi(false)

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now

  const prev = game.status
  game.update(dt)
  if (world) {
    world.sync(game)
    world.render(now)
  }

  if (game.status === 'playing') {
    syncHud()
  } else if (prev === 'playing' && (game.status === 'victory' || game.status === 'defeat')) {
    showEnd()
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
