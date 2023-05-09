import { Entity, InputAction, Material, MeshCollider, MeshRenderer, PointerEvents, Transform, engine, pointerEventsSystem } from '@dcl/sdk/ecs'
import { Color4, Vector3, Quaternion } from '@dcl/sdk/math'

const WaveCube = engine.defineComponent('WaveCube', {})

function createCube(x: number, y: number, z: number, size = 1.0) {
  const myEntity = engine.addEntity()
  Transform.create(myEntity,{
      position: Vector3.create(x, y, z),
      scale: Vector3.create(size, 1, size)
    })
  MeshRenderer.setBox(myEntity)
  MeshCollider.setBox(myEntity)
  
  return myEntity
}

function createCubeWaveSystem() {
  const cubeList: Entity[] = []
  let hoverState: number = 0

  return {
    update(dt: number) {
      hoverState += Math.PI * dt * 0.5
      for (const [entity] of engine.getEntitiesWith(WaveCube, Transform)) {
        const transform = Transform.getMutable(entity)
        transform.position.y =
          Math.cos(
            hoverState +
              Math.sqrt(Math.pow(transform.position.x - 6, 2) + Math.pow(transform.position.z - 6, 2)) / Math.PI
          ) *
            2 +
          2
    
        transform.rotation = Quaternion.multiply(
            transform.rotation,
            Quaternion.fromAngleAxis(dt * 10, Vector3.Up())
        )
      }
    },

    refreshAmount(amount: number) {
      let toRemove: Entity | undefined
      while ((toRemove = cubeList.pop())) {
        engine.removeEntity(toRemove)
      }

      const cubeSize = 12 / amount
      for (let x = 0; x < amount; x += 1) {
        for (let y = 0; y < amount; y += 1) {
          const pos = {
            x: 0.5 + cubeSize * x,
            z: 0.5 + cubeSize * y
          }
          const cube = createCube(pos.x, 0, pos.z, cubeSize)
          WaveCube.create(cube)
          cubeList.push(cube)
        }
      }
    }
  }
}

export function main() {
  let cubeRowAmount = 8

  const cubeWave = createCubeWaveSystem()
  cubeWave.refreshAmount(cubeRowAmount)
  engine.addSystem(cubeWave.update)

  const spawnerCube = createCube(15, 1, 15)

  pointerEventsSystem.onPointerDown(spawnerCube, 
      (event) => {
        if (event.button === InputAction.IA_PRIMARY) {
          cubeRowAmount++
          cubeWave.refreshAmount(cubeRowAmount)
        } else if (event.button === InputAction.IA_SECONDARY) {
          cubeRowAmount--
          cubeWave.refreshAmount(cubeRowAmount)
        }
        PointerEvents.getMutable(spawnerCube).pointerEvents[0].eventInfo!.hoverText = `(${cubeRowAmount}) E to add, F to remove`
      },
      {
        button: InputAction.IA_ANY,
        showFeedback: true,
        hoverText: `(${cubeRowAmount}) E to add, F to remove` 
      }
    )
  
  Material.setPbrMaterial(spawnerCube, {
    albedoColor:Color4.Magenta()})
}

main()

export * from '@dcl/sdk'
