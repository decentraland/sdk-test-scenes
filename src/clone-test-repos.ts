import fs from "fs-extra"
import path from "path"
import { TEST_SCENE_FOLDER } from "./utils/consts"
import { downloadRepo } from "./utils/shellCommands"

type RepositoryItem = {
  url: string
  base?: string
  isPortableExperience: boolean
}

type RepositoryFile = {
  repositories: RepositoryItem[]
}

const Vector2 = {
  fromString(str: string) {
    return { x: parseInt(str.split(',')[0]), y: parseInt(str.split(',')[1]) }
  },
  toString(vector: { x: number, y: number }) {
    return `${vector.x},${vector.y}`
  }
}

function relocateScene(workingDir: string, newBaseParcel: string) {
  const sceneJsonPath = path.resolve(workingDir, "scene.json")
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

export async function cloneTestRepos() {
  const currentWorkingDir = path.resolve(process.cwd(), TEST_SCENE_FOLDER)
  const repositoryFilePath = path.resolve(process.cwd(), 'src', 'scenes-repository-list.json')
  const repos = fs.readJSONSync(repositoryFilePath) as RepositoryFile

  for (const repo of repos.repositories) {
    if (!repo.url.startsWith('https://')) {
      throw new Error(`Repo ${repo.url} is not safe.`)
    }

    const dirName = repo.url.replace('https://', '').replace(/\//g, '_')
    const repoPath = path.resolve(currentWorkingDir, dirName)

    fs.removeSync(repoPath);
    fs.mkdirSync(repoPath, { recursive: true })

    await downloadRepo(currentWorkingDir, repo.url, repoPath)
    if (repo.base) {
      await relocateScene(repoPath, repo.base)
    }
  }

}