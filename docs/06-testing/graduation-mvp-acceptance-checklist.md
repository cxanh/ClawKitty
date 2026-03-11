# 毕业设计 MVP 验收清单

## 文档速览

这份文档专门说明：
- 毕业设计 MVP 的验收清单
- 哪些页面和流程必须可演示
- 哪些问题会影响通过

最后更新：2026-03-12


## 1. 文档目标

这份清单用于回答一个很实际的问题：

`当前版本是否已经达到毕业设计阶段可演示、可讲解、可交付的标准。`

它不是面向长期商业发布的完整 QA 标准，而是当前桌面端毕设 MVP 的验收基线。

## 2. 验收范围

当前验收范围只覆盖毕业设计 MVP。

纳入验收：

- 桌面端安装与启动
- 首次启动引导
- Home
- Chat
- Tasks
- Activity
- Capabilities
- Permissions
- Devices
- 提醒基础能力
- 课表基础能力
- 文件工作台基础能力

明确不纳入当前毕设验收：

- Android 完整客户端
- 小程序客户端
- 真正的多 Agent 运行时
- 自动文件移动 / 重命名 / 删除执行
- 高级模型编排的正式生产验证

## 3. 推荐验证环境

推荐环境：

- Windows 10 或 Windows 11
- 用户电脑不需要安装 Node.js
- 用户电脑不需要安装 OpenClaw
- 当前目录版入口：
  - `C:\Users\ASUS\Desktop\openlaw\clawdesk\apps\desktop\release\0.1.0\win-unpacked\ClawDesk.exe`

可选增强环境：

- Chrome，用于 Browser Relay 演示
- Everything，用于文件搜索加速演示

## 4. 验收清单

### 4.1 安装与首次启动

- [ ] 可以启动 `ClawDesk.exe`
- [ ] 没有安装 OpenClaw 也能正常打开
- [ ] 应用自管数据目录会自动初始化
- [ ] 首次启动引导或 Home 总览能正常显示
- [ ] 没有阻塞性的启动报错

通过标准：

- 在一台普通 Windows 电脑上，程序能打开并进入主导航。

### 4.2 Home

- [ ] Home 作为 Agent-first 首页正常显示
- [ ] Home 能展示对话摘要或空状态引导
- [ ] Home 能展示任务焦点、活动摘要、能力摘要、权限摘要、设备摘要
- [ ] 空白工作区首次启动引导仍然可用

通过标准：

- Home 可以作为答辩的开场页使用。

### 4.3 Chat

- [ ] 用户可以新建一段对话
- [ ] 用户可以发送消息
- [ ] Assistant 回复可以正常显示
- [ ] 回复来源可见：
  - 有 provider 时为 provider-backed
  - 没有 provider 时为 fallback-backed
- [ ] 用户可以从 Chat 生成任务卡
- [ ] 用户可以从 Chat 生成安全动作
- [ ] 有审批提示时，信息可读

建议演示输入：

- “帮我提醒一下下周三下午两点的会议”
- “帮我制定一个四周的 Python 学习计划”
- “帮我找一下课程作业文件”

通过标准：

- Chat 能清楚演示“和 Agent 对话 -> 得到结构化后续成果”。

### 4.4 Tasks

- [ ] Tasks 页优先展示 Agent 工作台
- [ ] Agent Task Board 正常显示
- [ ] Agent Safe Action Board 正常显示
- [ ] Reminder Plans Board 正常显示
- [ ] Study Roadmaps Board 正常显示
- [ ] File Workspace Board 正常显示
- [ ] 旧 Basic Task 兼容区仍然保留

通过标准：

- Tasks 能同时展示“面向用户的 Agent 成果区”和“底层兼容能力区”。

### 4.5 Activity

- [ ] Activity 时间线正常加载
- [ ] 最新事件可查看详情
- [ ] 审批事件可读性足够
- [ ] 分类过滤可用：
  - 全部
  - Agent
  - Approvals
  - Reminders
  - Files
  - System

通过标准：

- 用户可以通过 Activity 回答“Agent 最近做了什么”。 

### 4.6 Capabilities

- [ ] Models / Skills / Tools 概览可见
- [ ] 能力状态区分明确：
  - available
  - partial
  - planned
- [ ] 页面能清楚说明当前系统“能做什么 / 不能做什么”

通过标准：

- 能力页能支撑答辩中的“能力边界说明”。

### 4.7 Permissions

- [ ] 风险默认策略可见
- [ ] 工具级策略可见
- [ ] 待审批请求可见
- [ ] 审批历史可见
- [ ] 用户可以批准或拒绝一条待审批请求

通过标准：

- 页面能够清楚说明高风险动作不是直接执行，而是受审批约束。

### 4.8 Devices

- [ ] Devices 页面打开无报错
- [ ] 宿主机摘要可见
- [ ] 多设备数量可见
- [ ] Pairing Center 可见
- [ ] 待审批配对请求存在时能显示
- [ ] 设备注册表与设备详情面板可见

通过标准：

- 页面能支持“保留设备管理面板并支持多设备观察”的产品叙事。

### 4.9 提醒基础能力

- [ ] `memory-item` 可以生成 reminder plan
- [ ] active reminder plan 可以生成桌面提醒投递
- [ ] reminder delivery 事件会进入 Activity
- [ ] 课表条目可以创建或导入
- [ ] course reminder delivery 链路存在

通过标准：

- 用户能够看到提醒不只是计划出来了，而且真的能被投递。

### 4.10 文件工作台基础能力

- [ ] 文件工作台可以从 safe action 创建
- [ ] 本地搜索可用
- [ ] 时间分组和事件分组可用
- [ ] 只读整理建议可见
- [ ] 只读整理预览可见
- [ ] 不会自动移动或删除文件

通过标准：

- 页面能展示“对新生友好的文件查找与整理建议”，且不引入高风险自动化。

## 5. 开发侧快速验证命令

```powershell
cd C:\Users\ASUS\Desktop\openlaw\clawdesk
npm run check
npm run build
npm run package:dir
```

## 6. 当前毕设通过判断

当前版本可视为满足毕业设计 MVP 验收，当且仅当：

1. 桌面程序能在 Windows 上稳定启动
2. 主要页面都可演示
3. 权限和审批模型能讲清楚
4. 提醒、文件工作台、设备支撑故事是连贯的
5. 文档与现有实现状态一致

## 7. 当前延期验证项

以下内容保留在文档和规划中，但不是当前毕设是否通过的阻塞项：

- Android 端完整联调
- 小程序端验证
- 自动文件整理执行
- 生产级 provider orchestration 验证
