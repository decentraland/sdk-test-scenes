import { buildScenes } from "./build-scenes";
import { cloneTestRepos } from "./clone-test-repos";


async function main() {
  // await cloneTestRepos()
  await buildScenes()
}

main()