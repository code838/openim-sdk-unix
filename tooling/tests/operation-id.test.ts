import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const common = readFileSync(resolve(root, 'uni_modules/unix-openim-sdk/utssdk/common/native-call-common.uts'), 'utf8')

function operationSource(source: string): string {
  const ast = ts.createSourceFile('operation-id.ts', source, ts.ScriptTarget.Latest, true)
  const statements = ast.statements.filter((statement) =>
    (ts.isFunctionDeclaration(statement) && statement.name?.text === 'normalizeOperationID')
    || (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) =>
      ['operationIDPrefix', 'operationIDSequence'].includes(declaration.name.getText(ast)))),
  )
  assert.ok(statements.some((statement) => ts.isFunctionDeclaration(statement)), 'real helper must exist')
  return statements.map((statement) => statement.getText(ast).replace(/^export /, '')).join('\n')
}

function fixture(source = common) {
  let clock = 1700000000000
  const context = createContext({
    Date: { now: (): number => clock },
    Math: { floor: Math.floor, random: (): number => 0 },
  })
  const javascript = ts.transpileModule(operationSource(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  runInContext(javascript, context)
  return {
    normalize: context.normalizeOperationID as (operationID?: string | null) => string,
    context,
    setClock(value: number): void { clock = value },
  }
}

test('missing, null, empty and whitespace-only operation IDs receive nonempty distinct IDs', () => {
  const { normalize } = fixture()
  const generated = [normalize(), normalize(null), normalize(''), normalize(' '), normalize('\t\r\n')]
  assert.ok(generated.every((value) => value.length > 0 && value.length < 128 && /^[A-Za-z0-9_-]+$/.test(value)))
  assert.equal(new Set(generated).size, generated.length)
})

test('caller-provided nonblank operation IDs are preserved byte-for-byte', () => {
  const { normalize } = fixture()
  for (const value of ['caller-operation', '  caller-operation  ', '0']) assert.equal(normalize(value), value)
})

test('same-millisecond calls stay unique even with identical random values and clock rollback', () => {
  const { normalize, setClock } = fixture()
  const generated = Array.from({ length: 10000 }, () => normalize())
  setClock(1)
  for (let index = 0; index < 1000; index++) generated.push(normalize())
  assert.ok(generated.every((value) => value.length > 0))
  assert.equal(new Set(generated).size, generated.length)
})

test('concurrent callers receive different automatically generated operation IDs', async () => {
  const { normalize } = fixture()
  const generated = await Promise.all(Array.from({ length: 1000 }, () => Promise.resolve().then(() => normalize())))
  assert.equal(new Set(generated).size, generated.length)
})

for (const platform of ['android', 'ios']) {
  test(platform + ' exported login passes generated IDs to the real driver seam', async () => {
    const source = readFileSync(resolve(root, 'uni_modules/unix-openim-sdk/utssdk/app-' + platform + '/index.uts'), 'utf8')
    const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
    const login = ast.statements.find((statement) => ts.isVariableStatement(statement)
      && statement.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === 'login'))
    assert.ok(login, 'real exported login must exist')
    const { context } = fixture()
    const captured: string[] = []
    Object.assign(context, {
      stringifyJSON: JSON.stringify,
      recordSDKLoginSession: (): void => {},
      resolveStringNative: (action: (resolve: (value: string) => void, reject: (reason: unknown) => void) => void) => new Promise<string>(action),
      driverCallAsync: (_id: number, operationID: string, _request: string, resolve: (value: string) => void): void => {
        captured.push(operationID)
        resolve('')
      },
    })
    const javascript = ts.transpileModule(login.getText(ast).replace('export const login', 'var login'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
    }).outputText
    runInContext(javascript, context)
    const call = context.login as (userID: string, token: string, operationID?: string | null) => Promise<string>
    await call('fixture-user', 'fixture-not-a-token')
    await call('fixture-user', 'fixture-not-a-token', null)
    await call('fixture-user', 'fixture-not-a-token', '')
    await call('fixture-user', 'fixture-not-a-token', 'caller-operation')
    assert.ok(captured.slice(0, 3).every((value) => value.length > 0))
    assert.equal(new Set(captured.slice(0, 3)).size, 3)
    assert.equal(captured[3], 'caller-operation')
  })
}

for (const platform of ['android', 'ios']) {
  test(platform + ' real send-message options use generated or caller-preserved operation IDs', async () => {
    const source = readFileSync(resolve(root, 'uni_modules/unix-openim-sdk/utssdk/app-' + platform + '/index.uts'), 'utf8')
    const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true)
    const reader = ast.statements.find((statement) => ts.isFunctionDeclaration(statement)
      && statement.name?.text === 'readOperationID')
    assert.ok(reader)
    const { context } = fixture()
    const captured: string[] = []
    Object.assign(context, {
      stringifyJSON: JSON.stringify,
      stringifyOpenIMMessage: JSON.stringify,
      readOfflinePushInfo: (): string => '',
      readIsOnlineOnly: (): boolean => false,
      rejectNativeError: (): void => assert.fail('unexpected native error'),
      resolveSendMessageData: (_data: string, _method: string, resolve: (value: object) => void): void => resolve({}),
      driverCallAsync: (_id: number, operationID: string, _request: string, resolve: (value: string) => void): void => {
        captured.push(operationID)
        resolve('{}')
      },
    })
    for (const method of ['sendMessage', 'sendMessageNotOss']) {
      const declaration = ast.statements.find((statement) => ts.isVariableStatement(statement)
        && statement.declarationList.declarations.some((item) => item.name.getText(ast) === method))
      assert.ok(declaration)
      runInContext(ts.transpileModule(reader.getText(ast) + '\n'
        + declaration.getText(ast).replace('export const ' + method, 'var ' + method), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
      }).outputText, context)
      const call = context[method] as (options: Record<string, unknown>) => Promise<object>
      for (const operationID of [undefined, null, '', ' \t', 'caller-send-operation']) {
        await call({ message: {}, recvID: 'fixture-peer', groupID: '', operationID })
      }
    }
    const generated = captured.filter((value) => value !== 'caller-send-operation')
    assert.equal(generated.length, 8)
    assert.ok(generated.every((value) => value.length > 0))
    assert.equal(new Set(generated).size, generated.length)
    assert.equal(captured.filter((value) => value === 'caller-send-operation').length, 2)
  })
}
