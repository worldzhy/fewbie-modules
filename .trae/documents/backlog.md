# fewbie-modules backlog

本仓未完成的工程任务。会话结束时把遗留项追加到这里，会话开始时先检查；完成后删除对应条目。

跨仓评审的 findings 台账在 `devbie/.trae/documents/findings.md`，本仓只记录待办，不复制台账。

## 待办

（空）

## 组件级 item 发布链（2026-11-22，ADR-063）

- [ ] **dev→main 后同步 CLI 快照**：`copilot` / `notification-center` 已在 dev（`b672a17`）通过 `check:contract` / `check:types` / `npm test`。devbie 的 `check:registry-snapshot` 以 fewbie-modules `main` 为基准，合并前同步会判 stale；合并后在 devbie 执行 `FEWBIE_MODULES_PATH=<fewbie-modules> npm run registry:sync -w @devbie/fewbie-cli` 并提交生成的 `packages/fewbie-cli/registry/**` 与 `.snapshot.json`。
