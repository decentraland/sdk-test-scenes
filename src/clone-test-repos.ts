import fs from 'fs-extra'
import path from 'path'
import PQueue from 'p-queue/dist'

import repositoryListJson from './scenes-repository-list.json'
import { TEST_SCENE_FOLDER, VERBOSE } from './utils/consts'
import { downloadRepo } from './utils/shellCommands'
import glob from 'glob'

const Vector2 = {
  fromString(str: string) {
    const [x, y] = str.split(',').map(val => parseInt(val))
    return { x, y }
  },
  toString(vector: { x: number, y: number }) {
    return `${vector.x},${vector.y}`
  }
}

function relocateScene(workingDir: string, newBaseParcel: string) {
  const sceneJsonPath = path.resolve(workingDir, 'scene.json')
  const sceneJson = fs.readJSONSync(sceneJsonPath)

  const newBaseCoords = Vector2.fromString(newBaseParcel)
  const currentBaseCoords = Vector2.fromString(sceneJson.scene.base as string)
  const coordDif = { x: newBaseCoords.x - currentBaseCoords.x, y: newBaseCoords.y - currentBaseCoords.y }
  const newParcelCoords = []

  for (const parcelCoord of sceneJson.scene.parcels) {
    const currentParcelCoord = Vector2.fromString(parcelCoord)
    const newParcelCoord = { x: currentParcelCoord.x + coordDif.x, y: currentParcelCoord.y + coordDif.y }
    newParcelCoords.push(Vector2.toString(newParcelCoord))
  }

  sceneJson.scene.base = Vector2.toString(newBaseCoords)
  sceneJson.scene.parcels = [...newParcelCoords]

  fs.writeJsonSync(sceneJsonPath, sceneJson, { spaces: 2 })
}


function deleteOldRepos() {
  const currentWorkingDir = path.resolve(process.cwd(), TEST_SCENE_FOLDER)
  const allFiles = glob.sync('*', {
    cwd: currentWorkingDir,
    dot: true,
    absolute: false
  })

  for (const directory of allFiles) {
    if (directory.startsWith('github')) {
      fs.removeSync(path.resolve(currentWorkingDir, directory));
    }
  }

}


export async function cloneTestRepos() {
  const queue = new PQueue({ concurrency: 10 })
  const currentWorkingDir = path.resolve(process.cwd(), TEST_SCENE_FOLDER)

  if (VERBOSE) console.log('cloneTestRepos> deleting old repos')
  deleteOldRepos()

  if (VERBOSE) console.log('cloneTestRepos> making repos promises')
  const promises = repositoryListJson.repositories.map(repo => queue.add(
    async () => {

      if (!repo.url.startsWith('https://')) {
        throw new Error(`Repo ${repo.url} is not safe.`)
      }

      const id = new Date().getTime()
      const dirName = repo.url.replace('https://', '').replace(/\//g, '_')
      const repoPath = `${path.resolve(currentWorkingDir, dirName)}-${id}`

      if (VERBOSE) console.log(`cloneTestRepos> Start cloning repo ${repo.url} ; ${repo.base} ; ${repo.branch ?? 'default'} => ${repoPath}, delete if exists`)
      fs.removeSync(repoPath);

      if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} mkding dir`)
      fs.mkdirSync(repoPath, { recursive: true })

      if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} download repo`)
      await downloadRepo(currentWorkingDir, repo.url, repoPath, repo.branch)


      if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} downloaded, check if it's workspace`)
      const worskpaceFilePath = path.resolve(repoPath, "dcl-workspace.json")
      if (fs.existsSync(worskpaceFilePath)) {
        if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} it's workspace, getting workspace json`)

        const workspace: { folders: { path: string }[] } = fs.readJsonSync(worskpaceFilePath)
        for (const project of workspace.folders) {
          const projectPath = path.resolve(repoPath, project.path)

          if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} it's workspace, getting project ${project.path} and moving `)
          fs.moveSync(projectPath, `${repoPath}-${project.path}`)
        }

        if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} it's workspace, clean folder`)
        fs.removeSync(repoPath)
      } else {
        if (repo.base) {
          if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} relocating scene`)
          relocateScene(repoPath, repo.base)
        }

        if (VERBOSE) console.log(`cloneTestRepos> ${repoPath} remove .git`)
        fs.removeSync(path.resolve(repoPath, '.git'))
      }
    })
  )
  await Promise.all(promises)
}