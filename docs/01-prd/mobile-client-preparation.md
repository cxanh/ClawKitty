# ClawDesk 移动端准备说明（Agent 助手方向）

## 文档速览

这份文档专门说明：
- 移动端当前准备状态
- 已完成的接口与配对能力
- 后续继续开发的承接点

最后更新：2026-03-12


## 1. 当前判断

移动端已经不能再按“只读监控补充端”来规划。

新的统一方向是：

`移动端是个人 Agent 助手的陪伴入口。`

它未来要支持：
- 聊天
- 任务下发
- 状态查看
- 活动跟进
- 能力可见性
- 配对与审批配合

## 2. 当前已具备的基础

桌面 Runtime 已经提供的移动端相关接口：
- `GET /api/v1/mobile/overview`
- `GET /api/v1/mobile/bootstrap`
- `GET /api/v1/mobile/alerts-summary`
- `GET /api/v1/mobile/auth-boundary`
- `GET /api/v1/mobile/pairing-flow`
- `GET /api/v1/mobile/pairing-status`
- `POST /api/v1/mobile/pairing-request`

Android 工程当前也已经：
- 首次编译通过
- 生成 debug APK
- 能继续承接 Settings / Home / Pairing 开发

## 3. 当前还缺的核心能力

为了符合个人 Agent 助手方向，后续必须补上：
- 聊天接口与页面
- 任务接口与页面
- 活动流接口与页面
- 模型 / Skill / Tool 概览页

## 4. 移动端阶段划分

### 阶段 A：接通基础运行
- Base URL 配置
- Home 自动刷新
- Pairing 流程打通

### 阶段 B：Agent 交互上线
- Chat 页
- 消息发送
- 会话列表
- 基础任务反馈

### 阶段 C：Agent 状态透明
- Tasks 页
- Activity 页
- Capabilities 页

## 5. 当前开发重点

接下来移动端最优先做：
1. `Settings / Base URL`
2. `Home 自动刷新`
3. `Pairing request 真联调`
4. `Chat MVP`

## 6. 一句话结论

移动端规划已经从“远程状态查看”升级为：

`Agent 的移动聊天与任务陪伴入口。`
