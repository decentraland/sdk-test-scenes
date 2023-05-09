@Component('WaveCube', 10001)
class WaveCube {}

function createCube(x: number, y: number, z: number, size = 1.0) {
  const myEntity = new Entity()
  myEntity.addComponent(
    new Transform({
      position: new Vector3(x, y, z),
      scale: new Vector3(size, 1, size)
    })
  )
  myEntity.addComponent(new BoxShape())
  engine.addEntity(myEntity)
  return myEntity
}

class CubeWaveSystem {
  cubeList: Entity[] = []
  group = engine.getComponentGroup(Transform, WaveCube)
  hoverState: number = 0

  update(dt: number) {
    this.hoverState += Math.PI * dt * 0.5
    for (const entity of this.group.entities) {
      const transform = entity.getComponent(Transform)

      transform.position.y =
        Math.cos(
          this.hoverState +
            Math.sqrt(Math.pow(transform.position.x - 6, 2) + Math.pow(transform.position.z - 6, 2)) / Math.PI
        ) *
          2 +
        2
      transform.rotate(Vector3.Up(), dt * 10)
    }
  }

  refreshAmount(amount: number) {
    let toRemove: Entity | undefined
    while ((toRemove = this.cubeList.pop())) {
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
        cube.addComponent(new WaveCube())
        this.cubeList.push(cube)
      }
    }
  }
}

export function main() {
  let cubeRowAmount = 8

  const cubeWave = new CubeWaveSystem()
  cubeWave.refreshAmount(cubeRowAmount)
  engine.addSystem(cubeWave)

  const spawnerCube = createCube(15, 1, 15)
  spawnerCube.addComponent(
    new OnPointerDown(
      (event) => {
        if (event.buttonId === 1) {
          cubeRowAmount++
          cubeWave.refreshAmount(cubeRowAmount)
        } else if (event.buttonId === 2) {
          cubeRowAmount--
          cubeWave.refreshAmount(cubeRowAmount)
        }
        spawnerCube.getComponent(OnPointerDown).hoverText = 'E to increase, F to decrease. Current ' + cubeRowAmount
      },
      {
        showFeedback: true,
        hoverText: 'E to increase, F to decrease. Current ' + cubeRowAmount
      }
    )
  )
  spawnerCube.addComponent(new Material()).albedoColor = Color4.Magenta()
}

main()
