# ADR-001: settings-required-state 支持就地动作（onAction）

状态：已采纳
日期：2026-11-22

## 背景

`settings-required-state` 当前契约把 `settingsHref` 与 `onOpenSettings` 定为必填，只能表达「跳到设置页」这一种行动。唯一真实宿主（nightwatch-frontend）的同名影子组件实际使用 `onAction` + `actionPending` 做就地初始化（例如一键创建资源），不需要跳转。契约与真实用法不匹配，导致该 item 无法被采用（R84-12）。

## 候选方案

1. 什么都不做，宿主继续维护影子组件 —— registry item 永久不可采用，两份实现继续漂移。
2. 新增一个独立的 `settings-required-action` item —— 同一视觉状态出现两个 item，宿主还要按需二选一，准入标准上也无法自证区分。
3. 在现有 item 上把动作扩成可选：`settingsHref` / `onOpenSettings` 改为可选，新增可选 `onAction` / `actionPending`，`onAction` 优先。

## 决策

选方案 3。这是同一个「配置缺失」状态的两种行动出口，不是两个状态；用可选 port 表达，调用方按需选择，纯增量、不破坏已有调用。

## 跨宿主 / 演进检验（registry 模块设计必填）

新增字段不含任何宿主概念：`onAction` 只是一个无参回调，跳转路径仍由宿主通过 `settingsHref` 与 `onOpenSettings` 注入。换宿主后语义不变，也没有引入 router 依赖（item 仍禁止 import `next`）。

## 影响

- 契约 `ports` 从 `["onOpenSettings"]` 变为 `[]`：动作入口不再是必填项，contract 只约束 labels、ui 与 states；新增 `loading` state 以覆盖 `actionPending`。
- 宿主可以删除影子组件、直接装配该 item；不再需要 `next/link`。
- 两个可选动作同时缺省时组件不渲染按钮，由调用方负责避免这种用法。
