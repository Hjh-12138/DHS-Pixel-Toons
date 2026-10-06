import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {delimiter, join, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

const json = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
const versionParts = value => {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error(`Unsupported stable version: ${value}`)
  return value.split('.').map(Number)
}
const older = (candidate, installed) => {
  const a = versionParts(candidate), b = versionParts(installed)
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

/** Presence/version guards and installation share DSH's own profile lock. */
export async function installDesktopPackage(request, {withFileLock, runProfilePnpm, options}) {
  const {profileDirectory, packagePath, candidateVersion, backupDirectory, installAnchor} = request
  return withFileLock(join(profileDirectory, 'package.json'), async () => {
    const selected = await json(join(profileDirectory, 'package.json'))
    const manifestPath = join(profileDirectory, 'node_modules', 'dsh-toons', 'package.json')
    if (!selected.dependencies?.['dsh-toons'] || !existsSync(manifestPath)) return {status: 'plugin-removed'}
    const installed = await json(manifestPath)
    if (older(candidateVersion, installed.version)) return {status: 'skipped-newer-version', installedVersion: installed.version}
    await mkdir(backupDirectory, {recursive: true})
    for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml', 'cordis.yml']) {
      const source = join(profileDirectory, name)
      if (existsSync(source)) await copyFile(source, join(backupDirectory, name))
    }
    const result = await runProfilePnpm({profile: 'desktop', dir: profileDirectory, installAnchor, cwd: process.cwd()}, ['add', packagePath], options)
    if (result.exitCode !== 0) throw new Error(`DSH installation failed with exit code ${result.exitCode}; diagnostics: ${result.logPath}`)
    const verified = await json(manifestPath), profile = await json(join(profileDirectory, 'package.json'))
    if (verified.name !== 'dsh-toons' || verified.version !== candidateVersion) throw new Error('DSH did not install the expected plugin version.')
    if (profile.dependencies?.['dsh-toons'] !== `file:${packagePath.replaceAll('\\', '/')}`) throw new Error('DSH did not select the prepared package.')
    return {status: 'installed', installedVersion: verified.version}
  }, {waitMs: 120_000})
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 6) throw new Error('Expected installation root, profile directory, package path, version, backup directory and result path.')
  const [installationRoot, profileDirectory, packagePath, candidateVersion, backupDirectory, resultPath] = args
  const dshRoot = join(installationRoot, 'resources', 'app.asar', 'dsh')
  const runtime = join(installationRoot, 'resources', 'runtime')
  const cli = join(dshRoot, 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js')
  const require = createRequire(cli)
  const {withFileLock} = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-atomic-write')).href)
  const {runProfilePnpm} = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-plugin-manager/operations')).href)
  const result = await installDesktopPackage({profileDirectory, packagePath, candidateVersion, backupDirectory,
    installAnchor: join(dshRoot, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')}, {
    withFileLock,
    runProfilePnpm,
    options: {
      command: process.execPath,
      args: ['--expose-internals', join(runtime, 'pnpm', 'bin', 'pnpm.mjs')],
      env: {ELECTRON_RUN_AS_NODE: '1', DSH_DESKTOP_NODE_EXECUTABLE: process.execPath, PATH: join(runtime, 'bin') + delimiter + process.env.PATH},
      execution: 'cli', outputBytes: 16_384, lookupTimeoutMs: 120_000,
      onOutput: (text, stream) => process[stream].write(text),
    },
  })
  await writeFile(resultPath, JSON.stringify(result), 'utf8')
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
