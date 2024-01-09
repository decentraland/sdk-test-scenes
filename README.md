# SDK Test Scenes
Welcome to the SDK Test Scene repository! The goal of this repo is to build all scenes listed in `test-scenes` and to fetch and build the scenes repo listed in `src/scenes-repository-list.json`.

## Step to add a local scene
1. Just create a new directory with the content of the scene 

## Step to add a remote scene (a repository)
1. Add a new item to the json file `src/scenes-repository-list.json`, the schema must be:
  ```typescript
    url: string
    base?: string
  ```

  The base param is optional, and always must be defined in the `scene.json`. This param is useful when it's neccesary to move the parcel to another coords. The relocation is defined by the relative `base` coords. For example if you have a scene with `"base": "0,0"` in the `scene.json`, and here you specify `"base": "3,3"`, the scene will be in 3,3 and all parcels move relative to there.

.
