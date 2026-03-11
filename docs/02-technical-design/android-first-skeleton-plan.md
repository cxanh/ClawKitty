# Android 第一版工程骨架说明（方向校正版）

## 文档速览

这份文档专门说明：
- Android 工程骨架的搭建说明
- 目录结构与初始页面规划
- 后续继续补齐移动端的起点

最后更新：2026-03-12


## 1. 当前定位

Android 工程骨架已经存在，但它的后续开发方向需要重新校正。

新的方向不是“继续补监控页”，而是：
- 先接通 `Settings / Base URL`
- 再接通 `Home`
- 然后优先进入 `Chat`
- 再接 `Pairing` 与 `Tasks`

## 2. 当前目录

- `C:\Users\ASUS\Desktop\openlaw\android\ClawDeskAndroid`

## 3. 已有基础

### 工程层
- `settings.gradle.kts`
- `build.gradle.kts`
- `gradle.properties`
- `gradle wrapper`
- `app/build.gradle.kts`

### 应用层
- `MainActivity.kt`
- `ui/navigation/*`
- `ui/screens/home/HomeRoute.kt`
- `ui/screens/pairing/PairingRoute.kt`

### 数据层
- `data/model/MobileModels.kt`
- `data/api/MobileApi.kt`
- `data/repository/MobileRepository.kt`

## 4. 当前真实状态

已经完成：
- Android 环境接通
- `gradlew help` 通过
- `gradlew :app:assembleDebug` 通过
- `app-debug.apk` 已生成

## 5. 接下来优先级

### 第一优先级
- `Settings / Base URL`
- `Home 自动刷新`

### 第二优先级
- `Chat MVP`
- 基础会话列表
- 消息发送

### 第三优先级
- `Pairing request` 真联调
- `Tasks` 摘要页

### 第四优先级
- `Capabilities` 概览
- `Activity` 简版

## 6. 一句话结论

Android 骨架已经可继续，不再需要回头补工程基础。

后续应直接围绕：

`Settings -> Home -> Chat -> Pairing -> Tasks`

往下开发。
