import { argv } from "process";

export const ECS6_BOILERPLATE = 'src/ecs6-boilerplate'

export const GENERATED_FOLDER = 'generated/scene'
export const SCENE_FACTORY_FOLDER = `${GENERATED_FOLDER}/scene`
export const TEST_SCENE_FOLDER = 'test-scenes'
export const TSCONFIG_EXAMPLE_PATH = "tsconfig.example.json"
export const workspaceJsonFileName = 'dcl-workspace.json'

export const BUILD_CONCURRENCY = 3

export const VERBOSE: boolean = (argv.find(item => ['-v', '--verbose'].includes(item)) !== undefined) || false
