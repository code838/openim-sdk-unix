# Public 插件市场发布流程

本流程只适用于 DCloud 插件市场中的 Public `unix-openim-sdk`。Private/HarmonyOS 版本和 `openim-av-runtime` 不得使用该产物。

## 分支和版本

- 发布源码以 `origin/main` 为唯一基线。
- 发布准备使用临时分支 `release/public-<version>`。
- 分支只允许版本、市场文档、确定性打包和发布门禁改动，不接收新功能。
- 发布 PR 使用 merge commit 合回 `main`，禁止 squash、rebase 和 force-push。
- Tag 固定为 `unix-openim-sdk-public-v<version>`，必须指向 release PR 的 `main` merge commit。
- DCloud 上传完成并核对后删除临时 release 分支；Tag 和发布产物永久保留。

`0.2.1` 已于 2026-08-27 上传到 DCloud，但随后确认市场分发包误含本地原生制品，不能作为发布 authority，也不应继续导入使用。修正包 `0.2.2` 已于同日发布。当前准备版本以插件 package.json 和 tooling/release/public-candidate.json 为准；市场分发事实不能替代正式运行证据或解除 compatibility ledger 阻断，也不自动改变 releaseApproved。

DCloud 顶层市场版本与各运行形态的 `extVersion` 是不同维度，不能自动强制相等。传统 `uni-app` 支持 Vue、nvue、Android 和 iOS，其 Android/iOS `extVersion` 固定为 `0.2.2`；`uni-app x` Android/iOS 实现版本固定为 `0.1.0`。升级插件总版本不能改写这组已确认的平台元数据；发布向导和打包器均须保持它们。

## 市场包边界

市场上传内容由 `uni_modules/unix-openim-sdk/package.json` 的 `files` allowlist 与当前提交的 Git tracked 文件交集控制。ignored 文件即使残留在长期 worktree 中，也不得进入候选包：

- `package.json`
- `license.md`
- `readme.md`（插件市场详情页读取此文件）
- `changelog.md`（插件市场版本更新说明读取此文件）
- `utssdk` 中的 Public Android/iOS/common/interface/unierror 源码

以下内容必须始终排除：

- `utssdk/app-harmony`
- AAR、HAR、JAR、XCFramework、Framework、SO 和本地 `libs`/`Frameworks`
- Enterprise 合同、商业信令、Session Snapshot、AV Runtime
- 测试账号、Token、服务器地址、日志、截图和自动化证据
- 顶层 `local-runtime`、`tooling`、宿主模板、测试 fixture 和离线 SDK profile；这些仅用于团队内部开发、CI 与发布验证
- `node_modules`、`unpackage`、`.hbuilderx`、本机绝对路径
- Xcode `_CodeSignature/CodeResources` 以及其他 ignored 签名、缓存和构建残留

Android 和 iOS 原生 SDK 由市场插件配置引用远端制品，不随源码包内嵌：

- Android `io.openim:core-sdk:3.8.3-patch15`
- iOS `OpenIMSDKCore 3.8.3-hotfix.15-dynamic.1`

## 发布候选生成

候选验证 checkout 必须从 clean checkout 执行：

```bash
npm ci
npm run generate
git diff --exit-code
npm run typecheck:tooling
npm run test:tooling
npm run verify
npm run verify:generated
npm run verify:policy
npm run verify:release-integrity -- --release
npm run verify:release-policy
npm run compile:public
npm run verify:consumer:uniapp:android
npm run verify:consumer:uniapp:ios
```

编译会生成 ignored `unpackage/`，因此不得直接从上述验证 checkout 发布。必须从同一完整提交重新创建专用发布 checkout；该 checkout 不执行 compile/runtime，只执行：

```bash
npm ci
npm run marketplace:preflight
npm run marketplace:build
```

产物位于 `dist/public-marketplace/`：

- `unix-openim-sdk-<version>-marketplace.zip`
- `unix-openim-sdk-<version>-marketplace-manifest.json`
- `SHA256SUMS`

ZIP 用于审计、GitHub Release 和归档。实际向 DCloud 更新 uni_modules 插件时，必须在同一 Tag 的专用 clean checkout 中用 HBuilderX 右键 `uni_modules/unix-openim-sdk` 执行“发布/更新到插件市场”；禁止从曾放置本地 AAR、XCFramework、HAR 或签名资源的长期 worktree 发布。

HBuilderX 不以 Git tracked 状态作为上传边界。发布前必须同时执行以下检查：

- `git status --porcelain` 为空；
- 仓库顶层不存在 `unpackage/` 或 `.hbuilderx/`；验证产生的缓存只能保留在独立验证 checkout；
- `git status --ignored --short -- uni_modules/unix-openim-sdk` 不包含二进制、`libs`、`Frameworks`、`Resources` 或 `_CodeSignature`；
- 插件目录大小与候选 manifest 合理一致，市场显示大小出现数量级差异时立即停止发布；
- 发布向导完成后、最终提交前再次检查 `git diff --exit-code`。HBuilderX 若改写 `package.json`、changelog、平台版本或隐私声明，必须先恢复 authority 并重新核对，不能直接上传。

上传前后核对 HBuilderX 展示的版本、平台和文件差异与 manifest 一致。发布后必须从市场重新导入，逐文件比较实际插件与 Tag checkout；仅页面版本号和更新记录一致不足以证明同源。

候选 ZIP、逐文件 manifest、`SHA256SUMS`、SBOM 和最终运行证据保存为 CI/Release 资产，不把运行后生成的索引提交回被测提交。仓库只保存稳定政策与历史摘要。

## 运行证据口径

- 正式门禁要求每个平台连续三次同一 series 的 schema-v3 全量证据，sequence 必须为 1、2、3，并绑定最终提交、clean 工作树、锁定 Core 和实际原生制品。
- Android 三次证据中至少一次必须来自 arm64 真机 Release；其余两次仍须属于同一系列并满足完整证据门禁。
- iOS 同样需要三次连续证据，但不强制真机；模拟器证据可进入正式系列。
- schema-v2 及更早结果只作为历史摘要，不能认证当前发布。`latest` 文件只用于导航，发布结论必须引用不可变的 per-run evidence 与 matching manifest。
- Public 与 Private 的证据不能互相复用。Private Android/iOS 必须使用其锁定的 Enterprise Core，不能用 Public Core 结果替代。
- 大型 runner 或 matrix 结构性重构登记为当前修正版本发布后的技术债；候选收口阶段不扩大此类改动。

## 正式发布门禁

以下条件全部满足前不得打 Tag、上传市场或标记 Release Approved：

- Public 合同、生成、policy、SBOM、license、secret scan 全绿。
- Maven AAR 与锁定 Public Core AAR SHA-256 一致。
- CocoaPods XCFramework 与锁定 Public Core inventory SHA-256 一致。
- Android/iOS release dependency profile、uni-app x consumer compile/link 通过。
- 传统 uni-app Vue 2 / Vue 3 的 Android、iOS 正向编译通过，Public 导出合同解析器必须稳定拒绝已移除导出的负向 canary。
- Android、iOS 各有连续三次同系列 schema-v3 全量自动化证据；Android 系列至少包含一次 arm64 真机 Release。
- iOS 不强制真机，但设备、工具链和构建配置必须在 schema-v3 provenance 中完整记录。
- 两平台证据均绑定最终 merge commit，`dirty=false`，无 skip 或已知问题豁免。
- 候选 ZIP 在两个独立 clean checkout 中 SHA-256 一致。

## 发布和回滚

1. release PR 合入 `main`。
2. 在 merge commit 上创建签名 Tag。
3. 从 Tag 的两个 clean checkout 各生成一次候选并比较 SHA-256。
4. 创建 GitHub Release，附 ZIP、manifest、`SHA256SUMS` 和 SBOM。
5. 在同一 Tag checkout 中通过 HBuilderX 更新 DCloud 插件 ID `unix-openim-sdk`。
6. 从插件市场重新导入到空白 uni-app 和 uni-app x 工程，制作本地自定义基座并完成安装/初始化/登录/消息收发冒烟。
7. 删除临时 release 分支。

回滚时发布更高 patch 版本恢复上一稳定实现，不移动或覆盖已经发布的 Tag 和市场版本。
