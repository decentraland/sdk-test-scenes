import { engine, InputAction, PointerEvents, pointerEventsSystem, PointerEventType } from '@dcl/sdk/ecs'
import { circularSystem } from './systems'

import { createCube } from './factory'
import { spawn, kill, SpawnResponse } from '~system/PortableExperiences'

// Defining behavior. See `src/systems.ts` file.
engine.addSystem(circularSystem)
let pxId: SpawnResponse

export function main() {
  // fetch cube from Inspector
  const cube = createCube(1, 1, 1)

  PointerEvents.createOrReplace(cube, {
    pointerEvents: [
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_PRIMARY,
          hoverText: 'Spawn PX'
        }
      },
      {
        eventType: PointerEventType.PET_DOWN,
        eventInfo: {
          button: InputAction.IA_SECONDARY,
          hoverText: 'Kill PX'
        }
      }
    ]
  })
  // Add a click behavior to the cube, spawning new cubes in random places, and adding a bouncy effect for feedback
  pointerEventsSystem.onPointerDown(
    { entity: cube, opts: { button: InputAction.IA_ANY } },
    (event) => {
      createCube(1 + Math.random() * 8, Math.random() * 8, 1 + Math.random() * 8, false)

      if (event.button === InputAction.IA_PRIMARY) {
        spawn({ ens: 'boedo.dcl.eth' }).then((e) => {
          pxId = e
          console.log(e)
        })
      }

      if (event.button === InputAction.IA_SECONDARY && !!pxId?.pid) {
        kill({ pid: pxId.pid }).then(console.log).catch(console.error)
      }
    }
  )
}
