import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveHBuilderXCLI, resolvePublicNativeRoot, verifyToolchain } from '../src/compile.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const lockText = readFileSync(resolve(root, 'toolchain.lock.json'), 'utf8')
const lock = JSON.parse(lockText)

test('toolchain lock contains no machine-specific workspace path', () => {
  assert.equal(lock.schemaVersion, 2)
  assert.doesNotMatch(lockText, /\/(?:Users|Volumes)\//)
  assert.equal(lock.hbuilderx.cliPath, undefined)
  assert.equal(lock.publicNative.source.defaultRoot, undefined)
})

test('Public package requires iOS 14 consistently', () => {
  const iosConfig = JSON.parse(readFileSync(resolve(
    root,
    'uni_modules/unix-openim-sdk/utssdk/app-ios/config.json',
  ), 'utf8'))
  const pluginPackage = JSON.parse(readFileSync(resolve(
    root,
    'uni_modules/unix-openim-sdk/package.json',
  ), 'utf8'))

  assert.equal(lock.minimumPlatforms.ios, '14.0')
  assert.equal(iosConfig.deploymentTarget, '14.0')
  for (const clientName of ['uni-app', 'uni-app-x']) {
    assert.equal(pluginPackage.uni_modules.platforms.client[clientName].app.ios.minVersion, '14')
  }
})

test('Public native dependencies use the approved patch.15 release coordinates', () => {
  const pluginPackage = JSON.parse(readFileSync(resolve(
    root,
    'uni_modules/unix-openim-sdk/package.json',
  ), 'utf8'))
  const androidConfig = JSON.parse(readFileSync(resolve(
    root,
    'uni_modules/unix-openim-sdk/utssdk/app-android/config.json',
  ), 'utf8'))
  const iosConfig = JSON.parse(readFileSync(resolve(
    root,
    'uni_modules/unix-openim-sdk/utssdk/app-ios/config.json',
  ), 'utf8'))

  assert.equal(lock.publicNative.android.externalCoordinate, 'io.openim:core-sdk:3.8.3-patch15@aar')
  assert.equal(lock.publicNative.ios.externalPod, 'OpenIMSDKCore')
  assert.equal(lock.publicNative.ios.externalVersion, '3.8.3-hotfix.15-dynamic.1')

  const harmony = pluginPackage.uni_modules.platforms.client['uni-app-x'].app.harmony
  if (harmony === 'x') {
    assert.equal(
      androidConfig.dependencies[0].source,
      "implementation 'io.openim:core-sdk:3.8.3-patch15@aar'",
    )
    assert.equal(iosConfig['dependencies-pods'][0].name, 'OpenIMSDKCore')
    assert.equal(iosConfig['dependencies-pods'][0].version, '3.8.3-hotfix.15-dynamic.1')
  }
})

test('package and platform implementation versions match marketplace metadata', () => {
  const pluginPackage = JSON.parse(readFileSync(resolve(
    root,
    'uni_modules/unix-openim-sdk/package.json',
  ), 'utf8'))
  assert.equal(pluginPackage.version, '0.2.3')
  const expectedVersions = { 'uni-app': '0.2.2', 'uni-app-x': '0.1.0' }
  for (const clientName of ['uni-app', 'uni-app-x'] as const) {
    const app = pluginPackage.uni_modules.platforms.client[clientName].app
    assert.equal(app.android.extVersion, expectedVersions[clientName])
    assert.equal(app.ios.extVersion, expectedVersions[clientName])
  }
})

test('toolchain paths resolve from environment or verified siblings', () => {
  const cli = resolveHBuilderXCLI(lock, { [lock.hbuilderx.cliEnvironmentVariable]: '/tmp/explicit-hbuilderx-cli' })
  assert.equal(cli, '/tmp/explicit-hbuilderx-cli')

  const nativeRoot = resolvePublicNativeRoot(root, lock.publicNative.source)
  const explicitNativeRoot = process.env[lock.publicNative.source.rootEnvironmentVariable]
  assert.equal(
    resolve(nativeRoot),
    explicitNativeRoot == null || explicitNativeRoot === ''
      ? resolve(root, '..', 'openim-sdk-core-v3.8.3-locked')
      : resolve(explicitNativeRoot),
  )
})

test('resolved toolchain proves Core revision without requiring package-local native overrides', () => {
  const isEnterpriseComposition = existsSync(resolve(root, 'contracts/enterprise/delta.json'))
  const verified = verifyToolchain(root, { verifyPublicNative: !isEnterpriseComposition })
  assert.equal(verified.hbuilderx.cliSha256, lock.hbuilderx.cliSha256)
})
