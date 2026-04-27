# ClawModel Manager

一个轻量的 OpenClaw 模型接入配置管理工具后端核心，聚焦三个可写路径：

- `models.providers`
- `agents.defaults.models`
- `agents.defaults.model.primary`

## 已实现能力

- Provider/Model 数据结构定义与校验（Zod）
- 默认模型引用校验（必须存在于 provider/model）
- 主模型引用校验（必须存在且在默认模型列表中）
- 设置主模型时自动加入默认模型白名单
- 删除 Provider/Model 的引用保护校验
- 仅替换允许路径的保存函数 `saveModelAccessConfig`
- 后端读取/写入默认配置文件 `/root/.openclaw/openclaw.json`
- 提供 HTTP API：
  - `GET /api/config` 读取配置（可选 query `path` 覆盖默认路径）
  - `PUT /api/config` 保存三段受控配置

## 启动后端

```bash
npm install
npm run build
npm run start:backend
```

开发模式：

```bash
npm run dev:backend
```
