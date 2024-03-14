import { buildScenes } from "./build-scenes";
import { VERBOSE } from "./utils/consts";

async function main() {
  if (VERBOSE) console.log('main> Building scenes')
  await buildScenes()
}

main().catch(err => {
  console.log('Error')
  console.error(err)
  process.exit(1)
})