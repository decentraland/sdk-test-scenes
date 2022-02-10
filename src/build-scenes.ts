
import * as path from 'path'
import * as fs from 'fs-extra'
import glob from 'glob'
import { installDependencies, runDclBuild } from './utils/shellCommands'
import { SCENE_FACTORY_FOLDER, TEST_SCENE_FOLDER, TSCONFIG_EXAMPLE_PATH, workspaceJsonFileName } from './utils/consts'


function getRemovableFilesFromSceneFolder() {
  const baseFiles =
    ['package.json', 'README.md', 'tsconfig.example.json', '.dclignore']

  return glob.sync('**/*', {
    cwd: path.resolve(process.cwd(), SCENE_FACTORY_FOLDER),
    dot: true,
    absolute: false
  })
    .filter(filePath => !baseFiles.includes(filePath))
    .filter(filePath => !filePath.startsWith('node_modules'))
    .map(filePath => path.resolve(process.cwd(), SCENE_FACTORY_FOLDER, filePath))
}

async function removeFilesFromSceneFolder() {
  const files = getRemovableFilesFromSceneFolder()
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

async function copyScene(folder: string) {
  const files = getFiles(folder)
  for (const filePath of files) {
    const dstPath = path.resolve(SCENE_FACTORY_FOLDER, filePath)
    const srcPath = path.resolve(folder, filePath)

    if ((await fs.lstat(srcPath)).isDirectory()) {
      await fs.ensureDir(dstPath)
    } else {
      await fs.ensureDir(path.dirname(dstPath))
      await fs.copyFile(srcPath, dstPath)
    }
  }
}

async function buildScene({ sceneFolder, sceneFactoryFolder }: { sceneFolder: string, sceneFactoryFolder: string }) {
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

    await copyScene(sceneFolder)

    const tsConfigPath = path.resolve(sceneFactoryFolder, "tsconfig.json")

    await fs.copyFile(path.resolve(sceneFactoryFolder, TSCONFIG_EXAMPLE_PATH), path.resolve(sceneFactoryFolder, "tsconfig.json"))

    const tsConfigJson = await fs.readJson(tsConfigPath)

    tsConfigJson.compilerOptions.outFile = sceneJson.main
    await fs.writeJson(tsConfigPath, tsConfigJson, { spaces: 2 })

    await runDclBuild(sceneFactoryFolder)

    const gameJsPath = path.resolve(sceneFactoryFolder, sceneJson.main)
    const gameJsLibPath = path.resolve(sceneFactoryFolder, `${sceneJson.main}.lib`)

    await fs.copyFile(gameJsPath, path.resolve(sceneFolder, sceneJson.main))
    await fs.copyFile(gameJsLibPath, path.resolve(sceneFolder, `${sceneJson.main}.lib`))

    await removeFilesFromSceneFolder()
  }
}


export async function buildScenes() {
  await removeFilesFromSceneFolder()

  await installDependencies(path.resolve(SCENE_FACTORY_FOLDER))

  const allTestScenes = await getAllTestScene(true)
  for (const sceneFolder of allTestScenes) {
    try {
      await buildScene({ sceneFolder, sceneFactoryFolder: SCENE_FACTORY_FOLDER })
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  const testSceneFolderPath = path.resolve(process.cwd(), TEST_SCENE_FOLDER)
  const packageJsonPath = path.resolve(SCENE_FACTORY_FOLDER, "package.json")
  const workspaceObject =
  {
    "folders": (await getAllTestScene(false)).map(sceneFolder => ({
      path: sceneFolder
    })),
    "settings": {}
  }
  await fs.writeJson(path.resolve(testSceneFolderPath, workspaceJsonFileName), workspaceObject, { spaces: 2 })
  await fs.copyFile(packageJsonPath, path.resolve(testSceneFolderPath, "package.json"))

  await installDependencies(path.resolve(testSceneFolderPath))

}