import * as path from 'path'
import * as fs from 'fs-extra'
import glob from 'glob'
import pQueue from 'p-queue'

import { installDependencies, installSdkNext, runSceneBuild } from './utils/shellCommands'
import {
  BUILD_CONCURRENCY,
  ECS6_BOILERPLATE,
  GENERATED_FOLDER,
  SCENE_FACTORY_FOLDER,
  TEST_SCENE_FOLDER,
  TSCONFIG_EXAMPLE_PATH,
  VERBOSE,
  workspaceJsonFileName
} from './utils/consts'
import { EcsVersion } from './utils/types'
import { readFile } from 'fs/promises'


function getRemovableFilesFromSceneFolder(folder: string) {
  const baseFiles =
    ['package.json', 'README.md', 'tsconfig.example.json', '.dclignore']

  return glob.sync('**/*', {
    cwd: path.resolve(process.cwd(), folder),
    dot: true,
    absolute: false
  })
    .filter(filePath => !baseFiles.includes(filePath))
    .filter(filePath => !filePath.startsWith('node_modules'))
    .map(filePath => path.resolve(process.cwd(), folder, filePath))
}

async function removeFilesFromSceneFolder(folder: string) {
  const files = getRemovableFilesFromSceneFolder(folder)
  for (const filePath of files) {
    try {
      if ((await fs.lstat(filePath)).isDirectory()) {
        await fs.rmdir(filePath, {})
      } else {
        await fs.remove(filePath)
      }
    } catch (err) {

    }
  }
}

async function getAllTestScene(absolute?: boolean) {
  const currentWorkingDir = path.resolve(process.cwd(), TEST_SCENE_FOLDER)
  const allFiles = glob.sync('*', {
    cwd: currentWorkingDir,
    dot: true,
    absolute: absolute || false
  })

  if (!allFiles) {
    return []
  }

  const allDirectory = []

  for (const item of allFiles) {
    const sceneFolderPath = absolute ? item : path.resolve(currentWorkingDir, item)
    if ((await fs.lstat(sceneFolderPath)).isDirectory()) {
      const sceneJsonPath = path.resolve(sceneFolderPath, 'scene.json')
      if ((await fs.pathExists(sceneJsonPath))) {
        const sceneJson = await fs.readJSON(sceneJsonPath)
        const scene: { path: string, version: EcsVersion } = {
          path: item,
          version: sceneJson?.runtimeVersion === '7' ? 'ecs7' : 'ecs6'
        }
        allDirectory.push(scene)
      }
    }
  }

  return allDirectory
}

function getFiles(folder: string) {
  return glob.sync('**/*', {
    cwd: path.resolve(process.cwd(), folder),
    dot: true,
    absolute: false
  })
}

async function copyFactoryScene(folder: string) {
  const boilerPlatePath = ECS6_BOILERPLATE
  const files = getFiles(boilerPlatePath)

  for (const filePath of files) {
    const srcPath = path.resolve(boilerPlatePath, filePath)
    const dstPath = path.resolve(folder, filePath)

    if ((await fs.lstat(srcPath)).isDirectory()) {
      await fs.ensureDir(dstPath)
    } else {
      await fs.ensureDir(path.dirname(dstPath))
      await fs.copyFile(srcPath, dstPath)
    }
  }
}

async function copyScene(folder: string, factoryFolder: string) {
  const files = getFiles(folder)
  for (const filePath of files) {
    const dstPath = path.resolve(factoryFolder, filePath)
    const srcPath = path.resolve(folder, filePath)

    if ((await fs.lstat(srcPath)).isDirectory()) {
      await fs.ensureDir(dstPath)
    } else {
      await fs.ensureDir(path.dirname(dstPath))
      await fs.copyFile(srcPath, dstPath)
    }
  }
}

async function buildScene(sceneFolder: string, factoryFolder: string) {
  const sceneName = sceneFolder.replace(path.resolve(process.cwd(), TEST_SCENE_FOLDER), '')
  const sceneJsonPath = path.resolve(sceneFolder, "scene.json")
  const originalPackageJsonPath = path.resolve(sceneFolder, "package.json")
  const useOriginalPackageJson = await fs.pathExists(originalPackageJsonPath)

  const sceneJson = await fs.readJSON(sceneJsonPath)
  if (!sceneJson.main) {
    throw new Error(`Scene ${sceneName} has corrupt scene.json, main is not defined.`)
  }

  if (await fs.pathExists(path.resolve(sceneFolder, sceneJson.main))) {
    if (VERBOSE) console.log(`buildScene> Skipping ${sceneFolder}`)
    // The scene has already compiled
    return
  }

  console.log(`Building scene '${sceneName}'`)

  if (useOriginalPackageJson) {
    if (VERBOSE) console.log(`buildScene> ${sceneFolder} use its own package json > installing dependencies scene`)
    await installDependencies(sceneFolder)

    // scenes from goerli-plaza do not have any @dcl/sdk or decentraland-ecs dependencies
    // so we need to install them manually
    const packageJson = await readFile(originalPackageJsonPath, 'utf8')
    if (!packageJson.includes('@dcl/sdk') || !packageJson.includes('decentraland-ecs')) {
      await installSdkNext(sceneFolder)
    }

    if (VERBOSE) console.log(`buildScene> ${sceneFolder} running dcl build`)
    await runSceneBuild(sceneFolder)

    const nodeModulesPath = path.resolve(sceneFolder, 'node_modules')
    if (fs.pathExistsSync(nodeModulesPath)) {
      fs.removeSync(nodeModulesPath)
    }
  } else {
    if (VERBOSE) console.log(`buildScene> ${sceneFolder} use generic package json > copying scene`)
    await copyScene(sceneFolder, factoryFolder)

    if (VERBOSE) console.log(`buildScene> ${sceneFolder} copying tsconfig.json`)
    const tsConfigPath = path.resolve(factoryFolder, "tsconfig.json")
    await fs.copyFile(path.resolve(factoryFolder, TSCONFIG_EXAMPLE_PATH), path.resolve(factoryFolder, "tsconfig.json"))

    if (VERBOSE) console.log(`buildScene> ${sceneFolder} updating tsconfig.json`)

    if (sceneJson.runtimeVersion === undefined || sceneJson.runtimeVersion !== '7') {
      const tsConfigJson = await fs.readJson(tsConfigPath)
      tsConfigJson.compilerOptions.outFile = sceneJson.main
      await fs.writeJson(tsConfigPath, tsConfigJson, { spaces: 2 })
    }

    if (VERBOSE) console.log(`buildScene> ${sceneFolder} running dcl build`)

    await runSceneBuild(factoryFolder)

    const gameJsPath = path.resolve(factoryFolder, sceneJson.main)
    const gameJsLibPath = path.resolve(factoryFolder, `${sceneJson.main}.lib`)

    if (VERBOSE) console.log(`buildScene> ${sceneFolder} finish copying index.js`)
    await fs.copyFile(gameJsPath, path.resolve(sceneFolder, sceneJson.main))

    if (fs.existsSync(gameJsLibPath)) {
      await fs.copyFile(gameJsLibPath, path.resolve(sceneFolder, `${sceneJson.main}.lib`))
    }

    if (VERBOSE) console.log(`buildScene> ${sceneFolder} cleaning `)
    await removeFilesFromSceneFolder(factoryFolder)

  }

  if (VERBOSE) console.log(`buildScene> ${sceneFolder} finished`)

  const gameJsPath = path.resolve(sceneFolder, sceneJson.main)
  if (!fs.existsSync(gameJsPath)) {
    throw new Error(`The file ${gameJsPath} doesn't exits. Please verify the compilation is going well.`)
  }
}


async function createFactoryFolder(ecsVersion: EcsVersion) {
  const sceneFactoryFolder = `${SCENE_FACTORY_FOLDER}-${ecsVersion}`

  const folderPaths = await Promise.all(
    Array.from({ length: BUILD_CONCURRENCY }).map(async (_, index) => {
      const folderPath = `${sceneFactoryFolder}-${index}`
      await fs.ensureDir(folderPath)
      await copyFactoryScene(folderPath)

      await installDependencies(path.resolve(process.cwd(), folderPath))
      return folderPath
    })
  )

  function getFactoryFolder() {
    return folderPaths.pop()!
  }

  function restoreFactoryFolder(folder: string) {
    folderPaths.push(folder)
  }

  return {
    getFactoryFolder,
    restoreFactoryFolder
  }
}

export async function buildScenes() {
  const allTestScenes = await getAllTestScene(true)

  const listOfFactories: Record<EcsVersion, Awaited<ReturnType<typeof createFactoryFolder>>> = {
    ecs6: await createFactoryFolder('ecs6'),
    ecs7: await createFactoryFolder('ecs7')
  }

  for (const [key, currentFactory] of Object.entries(listOfFactories)) {
    const ecsVersion = key as EcsVersion
    const queue = new pQueue({ concurrency: BUILD_CONCURRENCY })
    await Promise.all(
      allTestScenes.map(scene => queue.add(
        async () => {
          if (ecsVersion !== scene.version) return
          const folder = currentFactory.getFactoryFolder()
          try {
            await buildScene(scene.path, folder)
          } catch (err) {
            console.log({ scene })
            console.error(err)
            process.exit(1)
          }
          currentFactory.restoreFactoryFolder(folder)
        })
      )
    )

  }

  await fs.rm(path.resolve(process.cwd(), GENERATED_FOLDER), { recursive: true, force: true })

  const testSceneFolderPath = path.resolve(process.cwd(), TEST_SCENE_FOLDER)
  const workspaceObject = {
    folders: (await getAllTestScene(false)).map(sceneFolder => ({ path: sceneFolder.path })),
    settings: {}
  }
  await fs.writeJson(path.resolve(testSceneFolderPath, workspaceJsonFileName), workspaceObject, { spaces: 2 })

  await installDependencies(path.resolve(testSceneFolderPath))
}