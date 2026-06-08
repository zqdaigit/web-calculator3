# 项目研发协作规范

## 1. 命令规范

- **构建**: `npm run build`
- **测试**: `npm test`

## 2. 分支与目录隔离规范

### 项目管理角色 (Project Manager)
- **专属工作目录**: 根目录 (维护 TODO.md 与进度看板)
- **分支策略**: 维护 `main` 与 `review/[ArtifactKey]` 分支。

### 需求分析角色 (Product Owner/Analyst)
- **专属工作目录**: `requirements/` (维护 PRD 与需求文档)
- **分支策略**: 使用 Multica 自动创建的 `agent/agent/<hash>` 分支。

### 交互设计角色 (UX/UI Designer)
- **专属工作目录**: `designs/` (维护原型与交互规范)
- **分支策略**: 使用 Multica 自动创建的 `agent/agent/<hash>` 分支。

### 静态交互原型角色 (Prototype Agent)
- **专属工作目录**: `designs/prototypes/` (维护 HTML 原型)
- **分支策略**: 使用 Multica 自动创建的 `agent/agent/<hash>` 分支。

### 同步校验角色 (Sync/Consistency Agent)
- **专属工作目录**: `sync/` (维护一致性检查报告)
- **分支策略**: 在 Multica 自动创建的执行分支中合入 `review/[ArtifactKey]` 后提交报告。

### 软件开发与测试角色 (Developer/Tester)
- **专属工作目录**: 业务代码目录
- **分支策略**: 开发使用 `feature/xxx`、`bugfix/xxx` 或 `test/xxx`，通过 Pull Request 合并回主干。
