# Expert Review — Round 2: Follow-up Scope

**Round:** 2
**Scope:** ADR-084 明确排除域 — `console-audit-log` / `console-authorization` host/api.ts 同类分叉
**Anchors:** devbie `9ecb6dd7`, fewbie-modules `be6a1b9`, crewbie `bf7eda7`, nightwatch `68e650bd` — 全部 dirty=0, remote-aligned, branch=dev
**Time:** 2026-11-26 16:27 CET

---

## 1. 锚点

| Repo                     | HEAD       | Remote     | Dirty |
| ------------------------ | ---------- | ---------- | ----- |
| devbie                   | `9ecb6dd7` | `9ecb6dd7` | 0     |
| fewbie-modules           | `be6a1b9`  | `be6a1b9`  | 0     |
| crewbie-console-frontend | `bf7eda7`  | `bf7eda7`  | 0     |
| nightwatch-frontend      | `68e650bd` | `68e650bd` | 0     |

## 2. 范围与方法

ADR-084 §「不在本 ADR 范围」明确排除：

- `audit-log` / `authorization` 的 host/api.ts 同类分叉 → **本轮审查目标**

方法：

- glob 两宿 `**/*host/api.ts` → 确认真正存在的 host 层
- diff `console-audit-host/api.ts` 两宿 → 逐块比对
- grep `route-access|use-can-see|RouteAccess` → 确认 authorization 有没有宿主层分叉

## 3. 关键发现

### 3a. `console-audit-log` — **确认有分叉，模式与 IAM 镜像相反**

IAM：crewbie 先抽 helper，nightwatch 内联 → audit：**nightwatch 先抽 helper，crewbie 内联**。

| 维度               | nightwatch (54 行)                              | crewbie (47 行)                                                                                                                   | 结论                                                                           |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| DTO 映射           | `toRecord(row)` helper                          | 内联 `.map((row) => ({...}))`                                                                                                     | 映射体**完全相同**（10 字段 + `result === "failure" ? "failure" : "success"`） |
| `toIso`            | 有，8 行                                        | 有，8 行                                                                                                                          | **完全相同**（`new Date` + `Number.isNaN` 守卫 + `toISOString`）               |
| query sanitization | 直接传 query 字段                               | keyword/event/action/resourceType/resourceId/actorId 全部 `.trim() \|\| undefined`；result 加 `"success" \|\| "failure"` 显式校验 | **crewbie 版本更严，nightwatch 版本有 trim+校验缺失**                          |
| 注释               | "Browser transport for the audit-log module..." | "Browser port for the audit-log module. The generated client runs on the shared axios client..."                                  | 宿主差异，无功能影响                                                           |

### 3b. `console-authorization` — **无分叉**

- 两宿均无 `*-host/api.ts` 层（glob 结果确认）
- 两宿仅有 registry 安装的 `src/fewbie/modules/console-authorization/lib/route-access.ts` + `features/access-control/use-can-see.ts`
- 授权逻辑集中在 registry 模块，宿主不写 DTO 映射或 transport adapter
- **无需 sink**，现有结构符合 ADR-063（模块只导出纯函数 + 组件，传输层留在宿主——authorization 模块根本不需要 transport）

## 4. Findings

### 4a. P1 — 必须 sink

**R2-01: audit-log 两宿 DTO 映射 + toIso 分叉**

- 仓：nightwatch-frontend + crewbie-console-frontend
- 状态：**open**
- 暴露面：live（两宿均为生产）
- 可达性：任意前端消费 `AuditLogRecord` 时触发，不涉及权限
- 根因：ADR-084 §不在范围 标记的后续轮次，本轮即为后续轮次
- 修复方向：在 `fewbie-modules/packages/modules/console-audit-log/lib/` 新增 `mapping.ts`，导出：
  - `fromAuditLogRow(row: any): AuditLogRecord`（两宿完全相同的映射体）
  - `toIso(value: string | undefined): string | undefined`（两宿完全相同）
  - `contract.version` 需升（当前值需先 grep 确认）
- 风险：**低**——映射体已在两宿完全相同，sink 只是搬移，无行为变化

### 4b. P2 — 需要决策

**R2-02: query sanitization 分歧（trim + result 校验）**

- 仓：同 R2-01
- 状态：**open，需决策**
- 暴露面：live
- 分叉详情：

```ts
// crewbie 版本（更严）
keyword: query.keyword?.trim() || undefined,
result: query.result === "success" || query.result === "failure" ? query.result : undefined,

// nightwatch 版本（直接传）
keyword: query.keyword,
result: query.result,
```

- 风险分析：
  - **crewbie 版本**：用户输入带首尾空格被自动 trim；非法 result 值不会传给后端
  - **nightwatch 版本**：后端收到带空格的 keyword 可能查不到记录；非法 result 可能触发后端 400 或忽略
  - 两宿后端可能不同——**这是唯一阻碍"选 crewbie 版本为统一标准"的因素**
- 修复方向：
  - 如果两宿后端 DTO schema 相同 → sink + 统一为 crewbie 版本
  - 如果不同 → 分别在宿主层做（module mapping.ts 只 sink toRecord/toIso，query 留在宿主）
- **需要用户决策**：两宿后端对 query trim 有不同期望吗？

### 4c. 已核验通过的不变量

1. ✅ authorization 模块两宿无 host/api.ts 层（glob 确认）
2. ✅ audit-host 两宿 DTO 映射体逐字段相同（机械 diff）
3. ✅ audit-host 两宿 toIso 逐行相同（机械 diff）

## 5. 修复优先级

| ID    | 标题                            | 阻塞                                  | 建议顺序                 |
| ----- | ------------------------------- | ------------------------------------- | ------------------------ |
| R2-01 | audit-log DTO 映射 + toIso sink | 否                                    | 立即做（纯搬移，风险低） |
| R2-02 | query sanitization 统一口径     | **是——需先确认两宿后端 DTO 是否相同** | 决策后再做               |

## 6. 结论

- ADR-084 "不在范围" 标记的 audit-log 同类分叉**确认存在且需要 sink**（R2-01）
- authorization **不需要 sink**（无宿主层）
- R2-01 可独立于 R2-02 先做——toRecord/toIso 是纯搬移，零行为变化
- R2-02 是唯一需要用户决策的点——"两宿后端对 query.trim() 有不同期望吗？"
