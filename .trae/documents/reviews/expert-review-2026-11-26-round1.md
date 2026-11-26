# Expert Review — Plan Scope: ADR-084 IAM Mapping Sinks

**Round:** 1 (initial)
**Scope:** `plan: ADR-084-fewbie-module-iam-port-mapping-sinks.md` + modules `console-iam`
**Reviewer:** TRAE adversarial agent
**Anchors:** fewbie-modules `3e74ae6`, crewbie `bf7eda7`, nightwatch `6ed54d30` (all dirty=0, remote-aligned, branch=dev)
**Time:** 2026-11-26 16:25 CET

---

## 1. 锚点

| Repo | Branch | HEAD | Remote | Dirty | Notes |
|---|---|---|---|---|---|
| fewbie-modules | dev | `3e74ae6` | `3e74ae6` | 0 | registry |
| crewbie-console-frontend | dev | `bf7eda7` | `bf7eda7` | 0 | consumer |
| nightwatch-frontend | dev | `6ed54d30` | `6ed54d3` ⚠️ | 0 | Short-SHA length mismatch only (9 vs 7 chars); full SHA match confirmed with `git rev-parse HEAD` |

## 2. 范围与方法

**Plan:** ADR-084 — 模块导出 IAM 端口的类型→DTO 映射函数，减少宿主分叉
**Modules:** `console-iam` — registry `packages/modules/console-iam/` + both hosts' `console-iam-host/api.ts`

方法：机械取证（`diff -rq`, grep for inline mappings, version field, DTO imports）+ 主张判定表（plan scope §0.1）+ 两宿等价性 diff。

## 3. 结论摘要

**目标偏离：无。** 实现与 ADR-084 完全对齐，且两项指标超出方案预期：

| 指标 | ADR-084 预期 | 实际 | 判定 |
|---|---|---|---|
| 宿主 api.ts 行数下降 | ~303 → 200 左右 | **303/312 → 206/206** | ✅ 超预期 |
| 两宿 api.ts 传输层差异 | 预期仍有 host-specific transport | **diff 只有注释不同** | ✅ 超预期（api client 封装了 transport 差异） |
| mapping.ts 函数数 | 每端口一组映射 | **17 个纯函数** | ✅ 达标 |
| 两宿 mapping.ts 副本一致性 | 应相同 | **逐字节相同** | ✅ 达标 |
| contract.version | 2.1.0 | **2.1.0** | ✅ 达标 |

维度评分：架构 ✅ | 契约 ✅ | 一致性 ✅ | 交付质量 ✅

---

## 4. 主张判定表

### 主张清单（从 ADR-084 拆解）

| # | 主张 | 判定 | 证据 |
|---|---|---|---|
| C1 | 模块新增 `lib/mapping.ts`，导出所有 DTO↔模块类型映射函数 | **成立** | `fewbie-modules/packages/modules/console-iam/lib/mapping.ts` 17 个纯函数；`diff -q` 两宿副本逐字节相同 |
| C2 | 宿主 api.ts 映射体删除、改为 import 模块函数 | **成立** | `grep '^function'` 两宿 api.ts 空；`import {...} from "@/fewbie/modules/console-iam/lib/mapping"` 两宿都有（行 44） |
| C3 | mapping.ts 不依赖宿主 DTO 类型名 | **成立** | `grep -E 'import.*Dto|from.*@/api'` 在 mapping.ts 上空；全部 `row: any` 输入 |
| C4 | `fewbie.module.json` `contract.version` 升为 `2.1.0` | **成立** | `"version": "2.1.0"` 确认 |
| C5 | 宿主仍保留传输层端口函数（`iamUsersPort` 等） | **成立** | 两宿 api.ts 仍导出 4 个 port object，内部仍调用 `postUsers()`, `getUsers()`, `patchUsersUserId()` 等 host API client |
| C6 | 两宿 api.ts 只剩传输层差异（本应如此） | **成立且超出预期** | `diff` 两宿 api.ts 只有 4 行注释不同（"The generated client already targets the backend directly" vs "Nightwatch's generated client is already browser-safe"），功能代码 100% 相同。api client 封装了 transport 差异 |
| C7 | 宿主 api.ts 中 `.map(fromUserRow)` + `data.pagination.countOfTotal` 是传输层 envelope 解构，不是手写 shape transform | **成立** | 这些调用的输入是模块导出函数，输出直接是模块类型；`.pagination.countOfTotal` 是 API envelope 取数（属于传输层） |
| C8 | ADR-084 不在范围：后端 DTO Prisma migrate / 权限组复杂业务逻辑 / 其它 console-*-host/api.ts | **成立** | 无越界改动 |

---

## 5. Findings

### 5a. P0 — 无

### 5b. P1 — 无

### 5c. P2 — withdrawn（非 bug / 已知设计）

| ID | 标题 | 判定 | 理由 |
|---|---|---|---|
| R1-01 | 命名风格：`fromUserRow` vs ADR-084 示例 `fromUserDto` | **withdrawn** | ADR-084 示例里 `fromUserDto(dto: UserDto): IamUser` 用了伪类型（模块没有 `UserDto`）。`fromUserRow(row: any)` 更准确地表达"输入是任意 row shape，输出是模块类型"，避免暗示它是"标准 DTO"。输出侧 `toCreateUserInput(input: IamUserInput)` 参数名用模块真实类型名更清晰 |
| R1-02 | `any` 参数（9 处 ESLint warning） | **withdrawn (known)** | ADR-084 明确决策：mapping.ts 不能依赖宿主 DTO 类型名（两宿生成的 api client 版本可能不同）。用 `any` 是设计选择，不是实现缺陷 |
| R1-03 | crewbie api.ts 残留 `as AddPermissionGroupPermissionDto[]` cast | **withdrawn** | 这是宿主传输层把 `IamGroupPermissionInput[]` cast 成后端 DTO——不属于"DTO 映射"（mapping.ts 产出的是 payload shape，宿主 cast 给 api client 类型检查） |

---

## 6. 已核验通过的不变量（正面结论，供下一轮判断覆盖是否退化）

1. ✅ 两宿 `console-iam-host/api.ts` 无内联 DTO 映射函数（`grep '^function '` 返回空）
2. ✅ 两宿 api.ts 都从 `@/fewbie/modules/console-iam/lib/mapping` 导入所有 shape transform
3. ✅ 两宿安装的 mapping.ts 与 registry 逐字节相同（`diff -rq` 空）
4. ✅ mapping.ts 无宿主 DTO import（`grep -E 'import.*Dto|from.*@/api'` 空）
5. ✅ `contract.version = 2.1.0`（升级符合 ADR-084 预期）
6. ✅ 两宿 api.ts **功能代码 100% 相同**（`diff` 只有注释行 59-63 不同）
7. ✅ 两宿 api.ts 行数从 303/312 降到 206/206（降 ~33%）
8. ✅ `fewbie.module.json` `files` 数组包含 `"src/fewbie/modules/console-iam/lib/mapping.ts"`

---

## 7. 覆盖率清单

| 范围 | 是否审了 | 取证方法 |
|---|---|---|
| registry `console-iam/lib/mapping.ts` (17 个函数) | ✅ | 全文 grep + diff vs 两宿副本 |
| registry `fewbie.module.json` (contract + files) | ✅ | grep version + files 数组 |
| crewbie `console-iam-host/api.ts` (206 行) | ✅ | 全文 grep function 定义 + import 来源 |
| nightwatch `console-iam-host/api.ts` (206 行) | ✅ | 同上 + diff vs crewbie |
| 两宿 api.ts 之间的差异 | ✅ | `diff` 命令 |
| 两宿生成的 api client | ❌ 排除 | ADR-084 明确不在范围（后端 DTO schema 是另一套仓） |
| 其它 console-*-host/api.ts | ❌ 排除 | ADR-084 明确不在范围（audit-log / authorization 同类分叉后续轮次） |
| ESLint `any` warnings | ❌ 不审 | ADR-084 设计决策，不是实现缺陷 |
| Prisma schema / 后端 DTO | ❌ 排除 | ADR-084 明确不在范围 |

---

## 8. 修复优先级

无 P0/P1，无需修复。

**建议后续轮次（非本 session）：**
- 其它 console-*-host/api.ts（audit-log / authorization）同类分叉 sink（ADR-084 §不在本 ADR 范围 明确标记）
- `fewbie modules apply --force-update` flag 实施（ADR-086 已决策）

---

## 9. 台账指针

无 findings 需落台账。此轮为目标偏离检查，零发现。
