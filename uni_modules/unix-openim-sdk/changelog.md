# 更新日志

## 0.2.3（待发布）

### 新增

- 补充消息接收选项、群设置、群成员角色、申请处理结果、在线状态等公共枚举常量，并为对应参数和返回字段提供命名类型。
- 补充仍属于消息 `contentType` 的 UserCommand 通知类型常量。

### 修复

- 调用时省略或传入空白 `operationID` 会自动生成唯一请求标识，避免原生接口参数错误；显式传入的有效标识保持不变。

- 移除历史消息请求和结果中底层 Core 已不再提供的 `lastMinSeq` 字段。

### 兼容性变化

- 保留既有群设置和角色枚举类型名作为兼容别名；现有调用无需修改。
- 移除 `createImageMessage()`、`createSoundMessage()`、`createVideoMessage()` 和 `createFileMessage()`；本地媒体消息统一使用对应的 `FromFullPath` API。
- `OpenIMCreateVideoMessageParams` 不再包含 `videoSourcePath`、`snapshotSourcePath`，`OpenIMCreateFileMessageParams` 不再包含 `fileSourcePath`。

## 0.2.2（2026-08-27）

### 修复

- 修正插件市场分发包，确保只包含 Public Android、iOS 和公共 UTS 源码，不再夹带本地原生制品或构建缓存。

### 说明

- 本版本不新增或变更 SDK API；Android 和 iOS 原生 SDK 仍分别通过 Maven 与 CocoaPods 依赖获取。

## 0.2.1（2026-08-27）

### 新增

- `OpenIMVideoElem` 新增可选字段 `snapshotType`，保留 Core 返回的视频缩略图类型。

### 修复

- Android 正确解析 `unifile://usr` 本地媒体路径，避免创建媒体消息或上传文件时把虚拟路径传给原生 Core。
- Android、iOS 在更新会话等 patch 请求中保留显式 `false` 和数值 `0`，不再与“未传入”混淆。
- iOS 使用稳定的消息 JSON 写入和解析流程，避免嵌套数字字段被错误转换，并完整保留消息元素字段。
- 兼容 Core 的批量新消息、批量离线消息和单对象用户状态回调；既有单条消息订阅会逐条收到事件，且不会重复投递。

### 兼容性变化

- 从 `OpenIMSetGroupInfoParams` 移除当前 Public Core 不支持的 `displayIsRead` 字段；升级后请删除对该字段的传入和类型引用。

## 0.2.0（2026-08-12）

### 新增

- 支持传统 uni-app（Vue 2 / Vue 3）和 uni-app x 的 App Android、App iOS 项目。
- 事件订阅统一返回 `OpenIMSDKEventSubscription`，可通过 `off(subscription)` 精确取消。
- 新增 `offAll(eventName)`，用于按事件名清理全部订阅。

### 变更

- Android 原生依赖升级并固定为 `io.openim:core-sdk:3.8.3-patch15`。
- iOS 原生依赖升级并固定为 `OpenIMSDKCore 3.8.3-hotfix.15-dynamic.1`。
- App iOS 最低支持版本调整为 iOS 14；App Android 最低支持 Android 5.0 / API 21。

### 修复

- 修复文件、图片、语音、视频消息及文件上传 API 无法直接使用 App `unifile://` 本地路径的问题。
- 修复 iOS 对 Foundation JSON 对象数组、布尔值和批量消息回调的解析兼容问题。
- 修复 Android、iOS 原生回调在初始化、销毁和重复订阅场景下的生命周期问题。
- 修复部分消息、用户和可选字段在不同平台返回结构不一致的问题。

### 升级提示

- 这是包含事件订阅破坏性变更的版本。旧版“`onXxx` 返回取消函数”的写法必须改为保存 subscription handle，再调用 `off(subscription)`。
- 旧的 `offEvent(eventName)` 不再提供；请改用 `offAll(eventName)`。
- 原生 SDK 能力必须通过包含本插件的自定义基座或正式安装包验证。

## 0.1.2（2026-07-10）

- 统一 `checkFriend` 的跨平台返回结构。
- 修复 Android 部分消息与会话 API 的原生参数顺序。
- 改进 Android、iOS 的结果解析和错误返回一致性。
- 修复 iOS `atTextElem.atUsersInfo`、本地媒体路径和稀疏消息字段的处理。

## 0.1.1（2026-07-03）

- 统一 Android、iOS 的类型化事件监听接口。
- 统一文件上传和日志上传进度回调为 `{ progress: number }`。
- 改进长生命周期页面中的事件监听清理。

## 0.1.0

- 首次发布。
- 支持通过 UTS API 在 Android、iOS App 中调用 OpenIM 原生 SDK。
