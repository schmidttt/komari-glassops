/** Each embedded frontend is pinned to the backend contract it was built for. */
export const EMBEDDED_ADMIN_PROFILES: readonly {
  directory: string
  versions: readonly string[]
  commit: string
}[] = [
  {
    directory: 'admin-app',
    versions: ['1.4.3'],
    commit: '4a74e8a81e2e4b1c3da8ad795f9523151efb6b56',
  },
  {
    directory: 'admin-app-1.5',
    versions: ['1.5.0-fix1'],
    commit: '3324844cfa347f18c83435f1ccf5634df7e5b768',
  },
] as const
