// Keep recovery fragments in the browser, never in a server request or log.
const destination = new URL('https://mitinta.app/collection/')
const route = window.location.pathname.replace(/^\/(?:MiTinta\.app-web|lorcana-lector-web|MiTinta\.app)\//i, '/')
if (route.startsWith('/collection/')) destination.pathname = route
destination.search = window.location.search
destination.hash = window.location.hash
window.location.replace(destination.href)
