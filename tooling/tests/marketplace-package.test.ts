import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { verifyPublicMarketplaceWorktree } from '../../scripts/verify-public-marketplace-worktree.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function buildPackage(outputDir: string) {
  execFileSync(process.execPath, ['scripts/build-public-marketplace-package.mjs', '--allow-dirty', '--output-dir', outputDir], {
    cwd: root,
  })
  const manifestPath = join(outputDir, 'unix-openim-sdk-0.2.3-marketplace-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  return {
    archivePath: join(outputDir, manifest.archive.fileName),
    sumsPath: join(outputDir, 'SHA256SUMS'),
    manifest,
  }
}

test('Public marketplace package is deterministic and contains only the explicit plugin allowlist', () => {
  const firstRoot = mkdtempSync(join(tmpdir(), 'openim-marketplace-first-'))
  const secondRoot = mkdtempSync(join(tmpdir(), 'openim-marketplace-second-'))
  try {
    const first = buildPackage(firstRoot)
    const second = buildPackage(secondRoot)
    assert.equal(first.manifest.version, '0.2.3')
    assert.equal(first.manifest.status, 'release-pending')
    assert.equal(first.manifest.releaseApproved, false)
    assert.equal(first.manifest.artifactKind, 'dcloud-plugin')
    assert.equal(first.manifest.developmentInfrastructureIncluded, false)
    assert.equal(first.manifest.archive.sha256, second.manifest.archive.sha256)
    assert.deepEqual(first.manifest.files, second.manifest.files)

    const entries = execFileSync('unzip', ['-Z1', first.archivePath], { encoding: 'utf8' }).trim().split('\n')
    assert.ok(entries.includes('uni_modules/unix-openim-sdk/package.json'))
    assert.ok(entries.includes('uni_modules/unix-openim-sdk/license.md'))
    assert.ok(entries.includes('uni_modules/unix-openim-sdk/readme.md'))
    assert.ok(entries.includes('uni_modules/unix-openim-sdk/changelog.md'))
    assert.equal(entries.includes('uni_modules/unix-openim-sdk/MARKET_USAGE.md'), false)
    assert.ok(entries.includes('uni_modules/unix-openim-sdk/utssdk/interface.uts'))
    assert.ok(entries.includes('uni_modules/unix-openim-sdk/utssdk/unierror.uts'))
    assert.equal(entries.some((path) => /app-harmony|\/libs\/|\/Frameworks\/|\.aar$|\.har$|\.xcframework/i.test(path)), false)
    assert.equal(entries.some((path) => /\/_CodeSignature\/|\/CodeResources$/.test(path)), false)
    assert.equal(entries.some((path) => /(?:^|\/)(?:local-runtime|tooling|pages|test-results)(?:\/|$)/.test(path)), false)
    assert.equal(entries.includes('uni_modules/unix-openim-sdk/.npmignore'), false)

    const sums = readFileSync(first.sumsPath, 'utf8')
    assert.match(sums, new RegExp(`^${first.manifest.archive.sha256}  unix-openim-sdk-0\\.2\\.3-marketplace\\.zip`, 'm'))
  } finally {
    rmSync(firstRoot, { recursive: true, force: true })
    rmSync(secondRoot, { recursive: true, force: true })
  }
})

test('Public marketplace plugin ships the repository license verbatim', () => {
  assert.equal(
    readFileSync(join(root, 'uni_modules/unix-openim-sdk/license.md'), 'utf8'),
    readFileSync(join(root, 'LICENSE'), 'utf8'),
  )
})

test('Public marketplace metadata declares both traditional uni-app and uni-app x', () => {
  const pluginPackage = JSON.parse(readFileSync(join(root, 'uni_modules/unix-openim-sdk/package.json'), 'utf8'))
  assert.equal(pluginPackage.version, '0.2.3')
  assert.equal(pluginPackage.engines['uni-app'], '^5.23')
  assert.equal(pluginPackage.engines['uni-app-x'], '^5.23')
  assert.equal(pluginPackage.dcloudext.declaration.data, '插件不采集任何数据')
  assert.equal(pluginPackage.dcloudext.declaration.permissions, '无')
  assert.deepEqual(pluginPackage.files, ['license.md', 'readme.md', 'changelog.md', 'utssdk'])

  const traditional = pluginPackage.uni_modules.platforms.client['uni-app']
  assert.deepEqual(traditional.vue, { vue2: '√', vue3: '√' })
  assert.equal(traditional.app.vue, '√')
  assert.equal(traditional.app.nvue, '√')
  assert.equal(traditional.app.android.minVersion, '5.0')
  assert.equal(traditional.app.android.extVersion, '0.2.2')
  assert.equal(traditional.app.ios.minVersion, '14')
  assert.equal(traditional.app.ios.extVersion, '0.2.2')

  const uniAppX = pluginPackage.uni_modules.platforms.client['uni-app-x']
  assert.equal(uniAppX.app.android.minVersion, '5.0')
  assert.equal(uniAppX.app.android.extVersion, '0.1.0')
  assert.equal(uniAppX.app.ios.minVersion, '14')
  assert.equal(uniAppX.app.ios.extVersion, '0.1.0')
})

test('Public marketplace packager derives archive inputs from tracked plugin files', () => {
  const source = readFileSync(join(root, 'scripts/build-public-marketplace-package.mjs'), 'utf8')
  assert.match(source, /\['ls-files', '-z', '--', pluginRelativePath\]/)
  assert.doesNotMatch(source, /readdirSync\(absolutePath\)/)
})

test('Public marketplace worktree preflight rejects ignored native artifacts', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'openim-marketplace-preflight-'))
  try {
    const plugin = join(fixture, 'uni_modules/unix-openim-sdk')
    mkdirSync(plugin, { recursive: true })
    writeFileSync(join(fixture, '.gitignore'), '*.aar\n')
    writeFileSync(join(plugin, 'package.json'), '{"id":"unix-openim-sdk"}\n')
    execFileSync('git', ['init'], { cwd: fixture })
    execFileSync('git', ['add', '.gitignore', 'uni_modules/unix-openim-sdk/package.json'], { cwd: fixture })
    execFileSync('git', ['-c', 'user.name=OpenIM Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'], { cwd: fixture })
    assert.deepEqual(verifyPublicMarketplaceWorktree(fixture), {
      pluginRelativeRoot: 'uni_modules/unix-openim-sdk',
      fileCount: 1,
      totalBytes: 25,
    })

    const libs = join(plugin, 'utssdk/app-android/libs')
    mkdirSync(libs, { recursive: true })
    writeFileSync(join(libs, 'open_im_sdk.aar'), 'ignored native artifact')
    assert.throws(
      () => verifyPublicMarketplaceWorktree(fixture),
      /untracked or ignored plugin files are present: .*open_im_sdk\.aar.*forbidden plugin directories are present:/s,
    )
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})

test('Public marketplace worktree preflight rejects top-level build caches', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'openim-marketplace-preflight-cache-'))
  try {
    const plugin = join(fixture, 'uni_modules/unix-openim-sdk')
    mkdirSync(plugin, { recursive: true })
    writeFileSync(join(fixture, '.gitignore'), 'unpackage/\n')
    writeFileSync(join(plugin, 'package.json'), '{"id":"unix-openim-sdk"}\n')
    execFileSync('git', ['init'], { cwd: fixture })
    execFileSync('git', ['add', '.gitignore', 'uni_modules/unix-openim-sdk/package.json'], { cwd: fixture })
    execFileSync('git', ['-c', 'user.name=OpenIM Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'], { cwd: fixture })

    const cachedArtifact = join(fixture, 'unpackage/resources/app-android/uni_modules/unix-openim-sdk/utssdk/app-android/libs')
    mkdirSync(cachedArtifact, { recursive: true })
    writeFileSync(join(cachedArtifact, 'open_im_sdk.aar'), 'cached native artifact')
    assert.throws(
      () => verifyPublicMarketplaceWorktree(fixture),
      /forbidden workspace build\/cache paths are present: unpackage/,
    )
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
