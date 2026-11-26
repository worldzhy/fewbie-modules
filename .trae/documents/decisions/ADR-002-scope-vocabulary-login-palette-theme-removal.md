# ADR-002: notification-center 契约去宿主词汇、login-shell 可换肤、回收 theme 模块

状态：已采纳
日期：2026-11-26
关系：落实 devbie ADR-080 D2（协议真源归模块）与 round107 前端复用评审 R107-11 / R107-12 / R107-13

## 背景

round107 评审在 registry 侧命中三类「共享模块里写进了某一方的东西」：

1. `notification-center` 的页面契约出现 `projectId`、`NotificationProjectOption`、`allProjects`、`ariaProject`。project 是两个宿主各自的实体，模块准入标准第一条要求「不含宿主业务词汇（无产品名、实体、状态或枚举）」。一个只按「站点」或「租户」分组的宿主无法使用该 block，只能改模块或另写一份。
2. `account-access` 的 `login-shell` 把 19 个语义 token 写死在 inline style，并在 className 里再写 `bg-[#070c17] text-[#e6ecf7]`。这是四仓里仅有的 arbitrary 颜色，且落在共享模块中：宿主除了 fork 无法换肤。
3. `theme` 与 `data-table` 两个模块零安装、零 `registryDependencies` 引用。

## 决策

**D1 `notification-center` 的筛选项泛化为「scope」。**

| 旧                                       | 新                                     |
| ---------------------------------------- | -------------------------------------- |
| `NotificationCenterQuery.projectId`      | `NotificationCenterQuery.scopeId`      |
| `NotificationProjectOption`              | `NotificationScopeOption`              |
| `NotificationCenterProps.projectOptions` | `NotificationCenterProps.scopeOptions` |
| `labels.allProjects`                     | `labels.allScopes`                     |
| `labels.ariaProject`                     | `labels.ariaScope`                     |

`scope` 指「宿主用来分组的维度」：项目、站点或租户都只是它的一个取值。字段与类型名不含任何宿主的词，宿主把自己的实体名映射进 `scopeOptions` 即可。manifest 的 `labels`（顶层与 features 层）同步替换。

**D2 `login-shell` 暴露 `LoginPalette` 与 `palette?: Partial<LoginPalette>`。**

- 19 个 shadcn 语义 token 加一个 `--login-backdrop`（页面底色与渐变的暗部，非 shadcn token）组成 `LoginPalette`，默认值保持现有夜视效；宿主只覆盖需要的键，其余沿用默认。
- className 里的 arbitrary 颜色全部改为 token 引用（`bg-[var(--login-backdrop)]`、`text-foreground`、渐变里的 `var(--login-backdrop)`），因此 palette 的覆盖是完整的——不存在「改了变量但背景还是旧色」的死角。
- 视觉默认值不变：`--background` 仍是 `#0d1117`，页面底色仍是 `#070c17`（改由 `--login-backdrop` 承载）。

**D3 删除 `theme` 模块。** 框架已提供 `ThemeProvider` / `useThemePreference` / `THEME_COOKIE`（fewbie-starter ADR-001、ADR-009），`theme` 模块是 next-themes 的第二套主题系统，两宿主零安装。保留它只会让新宿主在「框架主题」与「next-themes 主题」之间二选一。随模块一起删除不再被引用的 `next-themes` devDependency。

**D4 `data-table` 保留。** 评审同时点名它零消费，但它是客户端整表排序分页的通用实现，与 IAM/审计页面的服务端分页行渲染器不兼容（ADR-013 已把服务端分页条上收到框架）。承认它当前无宿主使用，作为可选能力保留；不为了「零消费」删除一个形态正确的通用组件。

## 跨宿主 / 演进检验

- `scopeId` / `scopeOptions` / `allScopes` / `ariaScope`：换宿主语义不变，宿主负责把自身实体映射为 `{ id, name }`。
- `palette`：纯展示覆盖，不含产品词；默认值即当前视觉，未传 palette 的宿主零改动。
- 删除 `theme`：框架主题是唯一主题系统，新宿主没有第二条可选路径。

## 影响

- fewbie-modules：`notification-center` 的 `types.ts` / `notification-list.tsx` / `index.ts` / `fewbie.module.json`；`account-access` 的 `login-shell.tsx` / `index.ts` 与 palette 单测；删除 `packages/modules/theme/`；`README.md` 模块表去掉 `theme`；`package.json` 去掉 `next-themes`。
- 宿主：`template update` + `fewbie modules add notification-center account-access` 后，`fewbie.json` 的 i18n 词条 `allProjects`/`ariaProject` 改名，`notification-host` 的 `projectOptions` prop 改 `scopeOptions`；`LoginShell` 调用点无需改动。
- 验证：`npm run check:contract`、`npm run check:types`、`npm test`、`npm run format:check`。
