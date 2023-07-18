import {
  engine,
  Transform,
} from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiComponent)
}

const uiComponent = () => {
  return <UiEntity
    uiTransform={{
      width: 400,
      height: 230,
      margin: '16px 0 8px 270px',
      padding: 4,
    }}
    uiBackground={{ color: Color4.create(0.5, 0.8, 0.1, 0.6) }}
  >
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
      uiBackground={{ color: Color4.fromHexString("#70ac76ff") }}
    >
      <UiEntity
        uiTransform={{
          width: '100%',
          height: 100,
          margin: '8px 0'
        }}
        uiText={{ value: 'Scene with PX but with hidden UI', fontSize: 18 }}
      />
     </UiEntity>
  </UiEntity>
}
