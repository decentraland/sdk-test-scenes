
let models = new Entity()
models.addComponent(new GLTFShape('models/MaterialsScene.glb'))
models.addComponent(
  new Transform({
    position: new Vector3(4, 0, 8),
    scale: new Vector3(0.5, 0.5, 0.5),
    rotation: Quaternion.Euler(-90, 180, 0)
  })
)

engine.addEntity(models)
