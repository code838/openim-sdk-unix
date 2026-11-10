import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const readJSON = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

test('Public 0.2.3 publication metadata does not imply runtime release approval', () => {
  const candidate = readJSON('tooling/release/public-candidate.json')
  const plugin = readJSON('uni_modules/unix-openim-sdk/package.json')

  assert.deepEqual(candidate, {
    schemaVersion: 1,
    edition: 'public',
    version: '0.2.3',
    status: 'release-pending',
    releaseApproved: false,
  })
  assert.equal(plugin.version, candidate.version)
  const changelog = readFileSync(resolve(root, 'uni_modules/unix-openim-sdk/changelog.md'), 'utf8')
  assert.match(changelog, /^# 更新日志\n\n## 0\.2\.3（2026-11-10）/)
  assert.match(changelog, /\n## 0\.2\.2（2026-08-27）/)
})
