# Unix OpenIM SDK

`unix-openim-sdk` 是 OpenIM UTS 原生插件，支持在传统 **uni-app（Vue 2 / Vue 3）** 和 **uni-app x** 的 Android、iOS App 中调用 OpenIM 原生 SDK。

插件提供 Promise 风格 API、类型化数据模型和可精确取消的事件订阅。

## 平台与环境

| 平台 | 支持情况 | 最低版本 |
| --- | --- | --- |
| uni-app App Android（Vue 2 / Vue 3） | 支持 | Android 5.0 / API 21 |
| uni-app App iOS（Vue 2 / Vue 3） | 支持 | iOS 14 |
| uni-app x App Android | 支持 | Android 5.0 / API 21 |
| uni-app x App iOS | 支持 | iOS 14 |
| HarmonyOS | 当前市场版不支持；商业版已支持 | — |
| Web / 小程序 | 不支持 | — |

开发环境要求：

- HBuilderX `5.23.2026080313-alpha` 或更高兼容版本。
- uni-app / uni-app x `5.23` 系列。
- 与 OpenIM Core 3.8.3 协议兼容的 OpenIM Server。

插件平台配置会自动引用以下原生依赖：

- Android：`io.openim:core-sdk:3.8.3-patch15`
- iOS：`OpenIMSDKCore 3.8.3-hotfix.15-dynamic.1`

## 安装与运行

1. 从 DCloud 插件市场导入本插件，确认目录为 `uni_modules/unix-openim-sdk`。
2. 从 `@/uni_modules/unix-openim-sdk` 根路径导入 API。
3. 制作包含本插件的 Android / iOS 自定义基座，或直接构建正式安装包。
4. 依次调用 `initSDK` 和 `login`。

标准基座不包含 OpenIM 原生 SDK，只能用于普通页面调试，不能验证 SDK 初始化、登录、消息收发或事件回调。

传统 uni-app 的 JavaScript/TypeScript 页面与 uni-app x 的 UTS 页面使用相同的插件根导入路径。插件导出的复杂数据、回调和错误类型均由公开 UTS 类型描述；业务侧无需直接调用 Kotlin 或 Swift。

## 初始化与登录

```uts
import {
  OpenIMPlatformAndroid,
  OpenIMPlatformIOS,
  initSDK,
  login,
  getLoginStatus
} from '@/uni_modules/unix-openim-sdk'

const platformID = OpenIMPlatformAndroid // iOS 使用 OpenIMPlatformIOS

initSDK({
  apiAddr: 'https://your-openim-api.example.com',
  wsAddr: 'wss://your-openim-ws.example.com',
  platformID,
  dataDir: '',
  logLevel: 5,
  isLogStandardOutput: true
}).then(() => login('your-user-id', 'your-im-token')).then(() => getLoginStatus())
```

通常保持 `dataDir` 为空字符串，让 SDK 使用 App 沙盒中的默认可写目录。不要把 `unifile://`、仅在前端有效的相对路径或不可写目录传给原生 Core。

Promise 失败时 reject 的错误结构为 `{ errCode: number, errMsg: string }`。

`operationID` 保持为接口的最后一个可选参数。省略、传入 `null`、空字符串或全空白字符串时，SDK 自动生成唯一请求标识；显式传入的有效标识原样保留，不会裁剪或替换。

## 事件订阅

从 `0.2.0` 开始，每个 `onXxx` 返回一个 `OpenIMSDKEventSubscription`。使用 `off(subscription)` 精确取消，或使用 `offAll(eventName)` 清理某类事件的全部订阅。

```uts
import {
  onConnectSuccess,
  onRecvNewMessage,
  off,
  offAll
} from '@/uni_modules/unix-openim-sdk'

const connectionSubscription = onConnectSuccess(() => {
  console.log('OpenIM connected')
})

const messageSubscription = onRecvNewMessage((message) => {
  console.log('new message', message)
})

off(connectionSubscription)
off(messageSubscription)
offAll('onRecvNewMessage')
```

`0.2.0` 不兼容旧版“`onXxx` 返回取消函数”和旧批量取消方法。升级时必须保存 subscription handle 并改用 `off` / `offAll`。

## 发送文本消息

```uts
import { createTextMessage, sendMessage } from '@/uni_modules/unix-openim-sdk'

createTextMessage('hello OpenIM').then((message) => {
  if (message == null) return
  return sendMessage({
    message,
    recvID: 'receiver-user-id',
    groupID: '',
    offlinePushInfo: null,
    isOnlineOnly: false
  })
})
```

## 文件与媒体消息

文件类 API 可以接收 App 可读的 POSIX 绝对路径，也可以接收由 `uni.env.USER_DATA_PATH` 生成的 `unifile://` 路径。插件会在调用 OpenIM Core 前将 UTS 虚拟路径转换为当前平台的原生绝对路径。不要传 `uni.env.USER_DATA_PATH` 字面量、仅相对于页面的路径、已不存在的文件或 App 无权读取的路径。

```uts
import { createFileMessageFromFullPath, sendMessage } from '@/uni_modules/unix-openim-sdk'

createFileMessageFromFullPath({
  filePath: `${uni.env.USER_DATA_PATH}/file.pdf`,
  fileName: 'file.pdf'
}).then((message) => {
  if (message == null) return
  return sendMessage({
    message,
    recvID: 'receiver-user-id',
    groupID: '',
    offlinePushInfo: null,
    isOnlineOnly: false
  })
})
```

同类 API 还包括 `createImageMessageFromFullPath`、`createSoundMessageFromFullPath`、`createVideoMessageFromFullPath`、`uploadFile` 和 `uploadLogs`。

## 能力范围

- SDK：初始化、登录、登出、反初始化、登录状态、SDK 版本。
- 消息：文本、图片、语音、视频、文件、引用、合并、自定义、位置、表情、历史消息、搜索、撤回、删除、已读回执和发送进度。
- 会话：会话列表、分页、置顶、草稿、免打扰、未读数和输入状态。
- 好友与黑名单：好友、好友申请、黑名单和关系检查。
- 群组：群资料、群成员、群申请、禁言、邀请、踢人、转让和解散。
- 用户：用户资料、用户状态订阅。
- 文件与日志：文件上传、日志上传及进度事件。

具体参数和返回类型以插件根目录导出的 `interface.uts` 为准。

## 数据、隐私与权限

- 插件不会向插件作者或固定第三方服务上传数据。
- 运行时只连接宿主在 `initSDK` 中配置的 OpenIM API / WebSocket 地址，并处理宿主业务所需的用户 ID、IM Token、消息、会话、群组和关系数据。
- IM Token 应由业务服务端安全签发，不要写入源码、插件配置或日志。
- SDK 数据默认保存在 App 沙盒内。
- 插件本身不会主动弹出系统权限申请。业务使用相册、相机、麦克风或文件能力时，宿主 App 必须根据实际功能声明并申请权限。

## 常见问题

### 为什么标准基座调用失败？

标准基座没有打入本插件声明的 OpenIM 原生依赖。请制作自定义基座或安装正式构建产物。

### 服务地址和 Token 从哪里获得？

服务地址来自你部署的 OpenIM Server；用户注册和 IM Token 应由业务服务端完成。插件包不内置账号、Token 或服务器地址。

### 为什么升级后监听取消代码报错？

请改为保存 `OpenIMSDKEventSubscription` 并调用 `off(subscription)`；批量清理使用 `offAll(eventName)`。

### 如何反馈问题？

请在 [openimsdk/openim-sdk-unix](https://github.com/openimsdk/openim-sdk-unix/issues) 提交 issue，并附 HBuilderX 版本、平台、系统版本和已脱敏日志。

## License

AGPL-3.0-only。详见插件目录中的 `license.md`。
