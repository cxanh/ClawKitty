# ClawDesk 用户手册

## 文档速览

这份文档专门说明：
- 面向用户的安装与使用说明
- Home、Chat、Tasks、Permissions、Devices 等页面怎么用
- 如何准备演示数据并完成基础走查
- 常见问题和基础排障方式

最后更新：2026-03-12

## 1. 文档目标

这份手册面向当前 ClawDesk 桌面端使用者，说明如何启动、理解各个核心页面，以及如何完成当前毕业设计 MVP 范围内的主要操作。

## 2. 启动程序

当前推荐直接使用目录版：

```text
C:\Users\ASUS\Desktop\openlaw\clawdesk\apps\desktop\release\0.1.0\win-unpacked\ClawDesk.exe
```

启动后：
1. 等待桌面端初始化 Runtime
2. 首次启动时优先查看 Home 首页
3. 如果是答辩演示前准备，先执行演示数据种子脚本

## 3. 一键准备演示数据

项目目录：

```text
C:\Users\ASUS\Desktop\openlaw\clawdesk
```

推荐命令：

```bash
npm run demo:seed:clean
```

脚本会自动准备：
- Chat 示例会话
- Agent 任务卡
- safe actions
- active reminder plan
- active study roadmap
- active file workspace
- 课程表条目
- 待审批请求
- Activity 时间线

## 4. 核心页面说明

### 4.1 Home

用于快速了解：
- Agent 当前状态
- 最近聊天摘要
- 当前任务焦点
- 最近活动
- 待审批数量
- 设备与 Runtime 支撑状态

如果第一次接触这个项目，建议先看 Home，再决定从哪个页面继续深入。

### 4.2 Chat

用于和 Agent 对话，并从对话中生成：
- 任务卡
- safe action
- 后续建议

如果不知道从哪里开始，通常就从 Chat 开始，因为这里最接近“给 Agent 下达任务”。

### 4.3 Tasks

用于查看和管理：
- Agent 任务卡
- safe actions
- reminder plans
- study roadmaps
- file workspaces
- course schedule

这页承担“结构化成果中心”的作用，适合展示聊天之后沉淀下来的内容。

### 4.4 Activity

用于查看最近发生的行为变化，例如：
- 新对话
- 新任务
- 新提醒
- 审批结果
- 文件工作台预览

如果要解释“Agent 刚刚做了什么”，优先看这一页。

### 4.5 Capabilities

用于查看当前系统已有的：
- Models
- Skills
- Tools
- 能力状态

适合解释：
- 系统现在能做什么
- 哪些能力还是部分实现
- 哪些能力是后续规划

### 4.6 Permissions

用于查看和调整：
- 默认风险策略
- 工具级策略
- 待审批请求
- 审批历史

这页适合解释系统如何在“智能”和“安全”之间保持平衡。

### 4.7 Devices

用于查看：
- 宿主机状态
- 多设备数量
- Pairing Center
- 已配对设备详情

这页作为支撑控制台保留，用于展示桌面宿主机、多设备接入和移动端配对能力。

## 5. 推荐上手顺序

如果第一次使用，建议按这个顺序体验：

1. 先看 Home，理解系统当前状态
2. 再到 Chat，发起一次对话
3. 到 Tasks，看结构化成果如何沉淀
4. 到 Activity，看系统如何记录全过程
5. 到 Permissions，理解风险与审批
6. 最后到 Devices，理解多设备与配对中心

## 6. 当前适合演示的典型流程

建议优先展示：

1. Chat 生成任务和提醒草稿
2. Tasks 中查看 reminder plan 和 study roadmap
3. Activity 中查看这些动作的时间线
4. Permissions 中展示待审批请求
5. Devices 中展示 Pairing Center 和已配对设备
6. 文件工作台中展示搜索、建议和整理预览

## 7. 常见问题

### 7.1 没有配置 AI token 可以使用吗

可以。当前桌面端支持没有 token 时的安全回退路径，不会因为没有 provider 凭据就完全失效。

### 7.2 没有安装 OpenClaw 可以使用吗

可以。当前桌面端已经支持在没有 OpenClaw 的电脑上首次启动，并自动初始化应用自管数据目录。

### 7.3 Android 端是否已经和桌面端完全同步

还没有。当前毕业设计阶段以桌面端 MVP 为主，Android 已完成工程骨架、核心页面和主要信息面同步，但没有覆盖全部高风险和深度执行能力。

### 7.4 Browser Relay、Everything、Android 是否必须演示

不是。它们都属于可增强项，不是当前毕业设计主链路的必要条件。答辩时优先展示 `Home / Chat / Tasks / Activity / Permissions / Devices`。
