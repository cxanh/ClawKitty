# 答辩前走查 Runbook

## 文档速览

这份文档专门说明：
- 答辩开始前应该如何逐项走查
- 哪些链路必须提前验证
- 现场异常时优先如何降级处理
- 哪些命令和页面适合作为最终检查入口

最后更新：2026-03-12

## 1. 文档目标

这份 runbook 面向答辩前最后一轮走查。目标不是继续扩功能，而是把演示风险降到最低，确保“桌面端毕设 MVP”稳定可讲解。

## 2. 建议走查时间

建议至少完成两轮：

1. 答辩前一天做一轮完整走查
2. 答辩当天开始前做一轮 5 到 10 分钟快速走查

## 3. 前一天完整走查

### 3.1 版本与环境

- [ ] 使用的是当前最新目录版  
      `C:\Users\ASUS\Desktop\openlaw\clawdesk\apps\desktop\release\0.1.0\win-unpacked\ClawDesk.exe`
- [ ] 程序能正常打开
- [ ] Runtime 在线
- [ ] 应用数据目录可读写
- [ ] 演示数据已经准备完成

### 3.2 推荐命令检查

项目目录：

```text
C:\Users\ASUS\Desktop\openlaw\clawdesk
```

推荐执行：

```bash
npm run check
npm run build
npm run demo:seed:clean
```

如需重新生成目录版：

```bash
npm run package:dir
```

### 3.3 主链路页面检查

- [ ] `Home` 能显示 Agent 总览
- [ ] `Chat` 能看到示例会话并继续发消息
- [ ] `Tasks` 能看到任务卡、提醒计划、学习路线图、文件工作台、课程表
- [ ] `Activity` 能看到最近时间线
- [ ] `Capabilities` 能看到模型、Skill、Tool 状态
- [ ] `Permissions` 能看到策略和审批请求
- [ ] `Devices` 能看到宿主机、多设备和 Pairing Center

### 3.4 典型演示链路检查

- [ ] `Chat -> 任务卡`
- [ ] `Chat -> safe action`
- [ ] `safe action -> reminder plan`
- [ ] `safe action -> study roadmap`
- [ ] `safe action -> file workspace`
- [ ] `file workspace -> 搜索 -> 整理预览`
- [ ] `course schedule -> 课程条目可见`
- [ ] `Permissions -> 至少 1 条待审批请求`

## 4. 当天快速走查

答辩当天优先确认：

- [ ] `ClawDesk.exe` 能打开
- [ ] `Home` 首页正常
- [ ] `Chat` 会话可见
- [ ] `Tasks` 中结构化结果可见
- [ ] `Activity` 时间线可见
- [ ] `Permissions` 和 `Devices` 页面可正常打开

## 5. 现场异常时的降级顺序

如果现场出现异常，优先按这个顺序降级：

1. 保住 `Home / Chat / Tasks / Activity / Permissions / Devices`
2. Browser Relay 视为可降级增强项
3. Everything 加速视为可降级增强项
4. Android 联调视为可降级增强项

## 6. 讲解时的优先级

答辩时优先讲：

1. 产品定位：个人 Agent 助手
2. 核心交互：Chat
3. 结构化成果：Tasks
4. 可解释性：Activity
5. 安全边界：Permissions
6. 多设备支撑：Devices

## 7. 一句话原则

答辩当天优先展示稳定、清晰、可解释的基础能力；不要为了展示边缘功能而增加现场风险。
