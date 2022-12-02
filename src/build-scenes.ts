
import * as path from 'path'
import * as fs from 'fs-extra'
import glob from 'glob'
import pQueue from 'p-queue'

import { installDependencies, runDclBuild } from './utils/shellCommands'
import {
  BUILD_CONCURRENCY,
  ECS6_BOILERPLATE,
  ECS7_BOILERPLATE,
  GENERATED_FOLDER,
  SCENE_FACTORY_FOLDER,
  TEST_SCENE_FOLDER,
  TSCONFIG_EXAMPLE_PATH,
  workspaceJsonFileName
} from './utils/consts'
import { EcsVersion } from './utils/types'


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
        allDirectory.push(item)
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

function getBoilerPlatePath(ecsVersion: EcsVersion) {
  return ecsVersion === 'ecs7' ? ECS7_BOILERPLATE : ECS6_BOILERPLATE
}

async function copyFactoryScene(folder: string, ecsVersion: EcsVersion = 'ecs6') {
  const boilerPlatePath = getBoilerPlatePath(ecsVersion)
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

  if (await fs.pathExists(path.resolve(sceneFolder, 'game.js'))) {
    // The scene has already compiled
    return
  }

  console.log(`Building scene '${sceneName}'`)

  if (useOriginalPackageJson) {
    await installDependencies(sceneFolder)
    await runDclBuild(sceneFolder)
  } else {

    await copyScene(sceneFolder, factoryFolder)

    const tsConfigPath = path.resolve(factoryFolder, "tsconfig.json")
    await fs.copyFile(path.resolve(factoryFolder, TSCONFIG_EXAMPLE_PATH), path.resolve(factoryFolder, "tsconfig.json"))

    const tsConfigJson = await fs.readJson(tsConfigPath)

    tsConfigJson.compilerOptions.outFile = sceneJson.main
    await fs.writeJson(tsConfigPath, tsConfigJson, { spaces: 2 })

    await runDclBuild(factoryFolder)

    const gameJsPath = path.resolve(factoryFolder, sceneJson.main)
    const gameJsLibPath = path.resolve(factoryFolder, `${sceneJson.main}.lib`)

    await fs.copyFile(gameJsPath, path.resolve(sceneFolder, sceneJson.main))
    await fs.copyFile(gameJsLibPath, path.resolve(sceneFolder, `${sceneJson.main}.lib`))

    await removeFilesFromSceneFolder(factoryFolder)
  }
}


async function createFactoryFolder(ecsVersion: EcsVersion) {
  const boilerPlatePath = getBoilerPlatePath(ecsVersion)
  const sceneFactoryFolder = `${SCENE_FACTORY_FOLDER}-${ecsVersion}`

  const folderPaths = await Promise.all(
    Array.from({ length: BUILD_CONCURRENCY }).map(async (_, index) => {
      const folderPath = `${sceneFactoryFolder}-${index}`
      await fs.ensureDir(folderPath)
      await copyFactoryScene(folderPath, ecsVersion)

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
      allTestScenes.map(sceneFolder => queue.add(
        async () => {
          // Disable for now
          if (ecsVersion === 'ecs7') return

          const folder = currentFactory.getFactoryFolder()
          try {
            await buildScene(sceneFolder, folder)
          } catch (err) {
            console.log({ sceneFolder })
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
  const packageJsonPath = path.resolve(ECS7_BOILERPLATE, "package.json")
  const workspaceObject = {
    folders: (await getAllTestScene(false)).map(sceneFolder => ({ path: sceneFolder })),
    settings: {}
  }
  await fs.writeJson(path.resolve(testSceneFolderPath, workspaceJsonFileName), workspaceObject, { spaces: 2 })
  await fs.copyFile(packageJsonPath, path.resolve(testSceneFolderPath, "package.json"))

  await installDependencies(path.resolve(testSceneFolderPath))
}