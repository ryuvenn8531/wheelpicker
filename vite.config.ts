import { defineConfig } from 'vite'

// Project sites on GitHub Pages are served from /<repo>/. Local dev stays at /.
const base = process.env.GITHUB_PAGES === 'true' ? '/wheelpicker/' : '/'

export default defineConfig({ base })
