# 答辩演示数据准备清单

## 文档速览

这份文档专门说明：
- 答辩演示前建议准备哪些示例数据
- 哪些数据可以用一键脚本生成
- 每个核心页面适合展示什么内容
- 如何避免现场使用真实隐私数据演示

最后更新：2026-03-12

## 1. 文档目标

这份文档用于整理答辩演示前需要准备的示例数据，确保 `Home / Chat / Tasks / Activity / Permissions / Devices` 打开后都能直接进入“可讲解、可截图、可演示”的状态。

## 2. 推荐准备方式

优先使用项目内置的演示种子脚本：

```bash
npm run demo:seed:clean
```

项目位置：

```text
C:\Users\ASUS\Desktop\openlaw\clawdesk
```

脚本作用：
- 写入演示聊天记录
- 生成 Agent 任务卡
- 生成 safe actions
- 生成 reminder plan
- 生成 study roadmap
- 生成 file workspace
- 生成课程表条目
- 生成待审批请求
- 生成活动时间线

如果只想写入到临时目录，可使用：

```bash
npx tsx scripts/seed-demo-data.mjs --home C:\path\to\demo-home --clean
```

## 3. 数据准备原则

准备演示数据时建议遵循：

1. 只使用虚构课程、虚构提醒和非敏感文件名
2. 不在答辩现场暴露真实聊天内容、真实生日、真实隐私文件
3. 每条数据都应该服务于某个页面的讲解
4. 数量不必很多，但每类至少保留一条可见样本

## 4. 各页面建议保留的数据

### 4.1 Home

建议保留：
- 最近聊天摘要
- 至少 1 条 Agent 任务卡
- 至少 1 条最近活动
- 至少 1 条待审批请求
- 设备与 Runtime 在线状态

### 4.2 Chat

建议保留：
- 课程提醒类问题 1 条
- 学习计划类问题 1 条
- 文件整理类问题 1 条
- 生日提醒类问题 1 条

### 4.3 Tasks

建议保留：
- 1 条 Agent task card
- 1 条 safe action
- 1 条 reminder plan
- 1 条 study roadmap
- 1 个 file workspace
- 1 组课程表条目

### 4.4 Activity

建议保留至少这些事件：
- `chat-message-sent`
- `agent-task-created`
- `agent-reminder-plan-created`
- `agent-study-roadmap-created`
- `agent-file-workspace-created`
- `approval-request-created`

### 4.5 Permissions

建议保留：
- 默认风险策略
- 至少 1 条待审批请求
- 至少 1 条已批准或已拒绝记录

### 4.6 Devices

建议保留：
- 宿主机在线状态
- 至少 1 台已配对设备
- Pairing Center 就绪状态

### 4.7 文件工作台

建议保留：
- 1 个课程资料示例文件
- 1 个报名材料示例文件
- 1 个个人行政示例文件
- 至少 1 条搜索结果
- 至少 1 条整理建议
- 至少 1 组整理预览

## 5. 现场前最后确认

答辩前建议手工确认：

- `Home` 是否能直接看到摘要
- `Chat` 是否已有示例会话
- `Tasks` 是否能看到 4 类结构化成果
- `Activity` 是否有最近时间线
- `Permissions` 是否有待审批数据
- `Devices` 是否有设备和 Pairing Center 状态

## 6. 不建议在现场临时生成的内容

为了降低风险，不建议在答辩现场临时依赖这些内容：

- 真实 AI token
- 真实个人文件目录
- 真实生日或真实联系人信息
- 不稳定的浏览器扩展联调
- Everything 外部环境临时安装

## 7. 一句话原则

答辩现场优先展示“提前准备好的稳定示例数据”，而不是临时生成复杂内容。稳定、清晰、可解释，比功能炫技更重要。
