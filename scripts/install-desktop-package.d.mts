export type InstallRequest = {
  profileDirectory: string
  packagePath: string
  candidateVersion: string
  backupDirectory: string
  installAnchor: string
}
export type InstallResult = {
  status: 'installed' | 'skipped-newer-version' | 'plugin-removed'
  installedVersion?: string
}
type Dependencies = {
  withFileLock: <T>(path: string, body: () => Promise<T>, options: {waitMs: number}) => Promise<T>
  runProfilePnpm: (context: {profile: string; dir: string; installAnchor: string; cwd: string}, args: string[], options: Record<string, unknown>) => Promise<{exitCode: number; logPath?: string}>
  options: Record<string, unknown>
}
export function installDesktopPackage(request: InstallRequest, dependencies: Dependencies): Promise<InstallResult>
