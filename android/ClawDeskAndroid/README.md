# ClawDesk Android

## 文档速览

这份文档专门说明：
- Android 工程当前做到哪一步
- 如何构建 APK
- 当前已经同步了哪些桌面能力
- 毕设阶段 Android 端的边界是什么

最后更新：2026-03-12

## 1. 当前状态

当前 Android 端已经从“工程骨架”推进到：

`可构建、可运行、可同步桌面当前主要能力的第一版`

当前工程目录：

```text
C:\Users\ASUS\Desktop\openlaw\android\ClawDeskAndroid
```

## 2. 当前已实现页面

- Home
- Chat
- Tasks
- Activity
- More
- Capabilities
- Permissions
- Devices
- Pairing
- Settings

## 3. 当前已同步的桌面能力

当前已经同步：
- 首页总览
- 聊天主链路
- 任务中心摘要
- 活动时间线
- 能力概览
- 权限边界
- 设备面板
- 配对状态与配对请求
- Base URL 配置

## 4. 构建方式

在 Android Studio 中打开：

```text
C:\Users\ASUS\Desktop\openlaw\android\ClawDeskAndroid
```

或在命令行中执行：

```bash
./gradlew :app:assembleDebug
```

如果当前终端没有 `JAVA_HOME`，请先使用 JDK 17。

## 5. 当前构建结果

已验证：
- `gradlew :app:assembleDebug` 通过

当前 APK 输出路径：

```text
C:\Users\ASUS\Desktop\openlaw\android\ClawDeskAndroid\app\build\outputs\apk\debug\app-debug.apk
```

## 6. 毕设阶段边界

当前 Android 端仍然定位为：

`移动陪伴端`

这意味着：
- 以同步桌面当前主要信息面为主
- 以聊天、查看、配对入口为主
- 高风险执行和深度审批仍以桌面端为主
