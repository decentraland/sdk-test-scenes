
import { spawn } from 'child_process'

enum FileDescriptorStandardOption {
  SILENT = 1,
  PIPE = 2,
  ONLY_IF_THROW = 3
}

export function runCommand({
  workingDir, command, args, fdStandards
}: {
  workingDir: string
  command: string,
  args: string[],
  fdStandards?: FileDescriptorStandardOption
}): Promise<void> {
  const standarOption = fdStandards || FileDescriptorStandardOption.SILENT
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: true,
      cwd: workingDir,
      env: { ...process.env, NODE_ENV: '' }
    })

    let stdOut: string[] = []
    let stdErr: string[] = []

    if (standarOption === FileDescriptorStandardOption.PIPE) {
      child.stdout.pipe(process.stdout)
      child.stderr.pipe(process.stderr)
    } else if (standarOption === FileDescriptorStandardOption.ONLY_IF_THROW) {
      child.stdout.on('data', (data) => {
        stdOut.push(data.toString())
      });

      child.stderr.on('data', (data) => {
        stdErr.push(data.toString())
      });
    }

    child.on('close', (code) => {
      const errorMessage =
        `Command '${command}' with args '${args.join(' ')}' exited with code ${code}. \n > Working directory: ${workingDir}`

      if (code !== 0) {
        reject(
          new Error(`${errorMessage}\n
          > Standard output: \n ${stdOut.join('\n')} \n
          > Error output: \n ${stdErr.join('\n')} \n`)
        )
      }
      resolve()
    })
  })
}

export function installDependencies(workingDir: string): Promise<void> {
  return runCommand({
    workingDir,
    command: 'npm',
    args: ['install'],
    fdStandards: FileDescriptorStandardOption.SILENT
  })
}

export function installSdkNext(workingDir: string): Promise<void> {
  return runCommand({
    workingDir,
    command: 'npm',
    args: ['install', '@dcl/sdk@next'],
    fdStandards: FileDescriptorStandardOption.SILENT
  })
}

export function runSceneBuild(workingDir: string): Promise<void> {
  return runCommand({
    workingDir,
    command: 'npm',
    args: ['run', 'build', '--', '--skip-install'],
    fdStandards: FileDescriptorStandardOption.ONLY_IF_THROW
  })
}

export function downloadRepo(workingDir: string, url: string, destinationPath: string, branch?: string): Promise<void> {
  const branchParam = branch ? ['-b', branch] : []
  return runCommand({
    workingDir,
    command: 'git',
    args: ['clone', ...branchParam, '--depth', '1', url, destinationPath],
    fdStandards: FileDescriptorStandardOption.PIPE
  })
}
