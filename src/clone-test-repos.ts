import fs from 'fs-extra'
import path from 'path'
import PQueue from 'p-queue/dist'

import repositoryListJson from './scenes-repository-list.json'
import { TEST_SCENE_FOLDER } from './utils/consts'
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

  deleteOldRepos()

  const promises = repositoryListJson.repositories.map(repo => queue.add(
    async () => {
      if (!repo.url.startsWith('https://')) {
        throw new Error(`Repo ${repo.url} is not safe.`)
      }

      const dirName = repo.url.replace('https://', '').replace(/\//g, '_')
      const repoPath = path.resolve(currentWorkingDir, dirName) + Math.random()

      fs.removeSync(repoPath);
      fs.mkdirSync(repoPath, { recursive: true })

      await downloadRepo(currentWorkingDir, repo.url, repoPath)
      if (repo.base) {
        relocateScene(repoPath, repo.base)
      }
    })
  )
  await Promise.all(promises)
}