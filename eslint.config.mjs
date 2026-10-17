import antfu from '@antfu/eslint-config'

export default antfu({
  ignores: ['public/admin-app/**', 'public/admin-app-1.5/**', 'public/admin-app-1.6/**'],
  formatters: true,
  vue: true,
})
