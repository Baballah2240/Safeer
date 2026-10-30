// One explicit public-asset list for the local server and static build.
export const publicAssets = {
  '/': ['index.html', 'text/html'],
  '/src/app.js': ['src/app.js', 'text/javascript'],
  '/src/i18n.js': ['src/i18n.js', 'text/javascript'],
  '/src/domain.mjs': ['src/domain.mjs', 'text/javascript'],
  '/src/demo.mjs': ['src/demo.mjs', 'text/javascript'],
  '/src/styles.css': ['src/styles.css', 'text/css'],
  '/src/tokens.css': ['src/tokens.css', 'text/css'],
  '/src/brand.svg': ['src/brand.svg', 'image/svg+xml'],
};
