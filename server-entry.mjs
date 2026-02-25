import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import handler from './dist/server/server.js'

const port = process.env.PORT || 8080

const mimeTypes = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  const staticPath = join('./dist/client', req.url.split('?')[0])
  if (existsSync(staticPath) && !staticPath.endsWith('/')) {
    const ext = extname(staticPath)
    const content = await readFile(staticPath)
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    })
    res.end(content)
    return
  }

  const url = `http://${req.headers.host}${req.url}`
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method)
      ? undefined
      : Readable.toWeb(req),
    duplex: 'half',
  })

  const response = await handler.fetch(request)

  res.writeHead(response.status, Object.fromEntries(response.headers))
  if (response.body) {
    Readable.fromWeb(response.body).pipe(res)
  } else {
    res.end()
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${port}`)
})
