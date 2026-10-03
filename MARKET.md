# dsh-market 发布步骤

本目录已经是可发布的 skill 插件包。实际发布需要 npm 与 GitHub 账号。

## 1. 发布到 npm

```powershell
cd "D:\Program Files\AI数据中心\deepseek\dsh-multiplatform-balance"
npm login
npm publish --access public
```

如果 npm 未登录，会打开浏览器 OAuth 登录。

## 2. 创建 GitHub 仓库

仓库名：

```text
dsh-multiplatform-balance
```

把本目录内容提交并推送到：

```text
https://github.com/bjzkhy/dsh-multiplatform-balance
```

## 3. 提交 dsh-market 收录

`catalog/bjzkhy__dsh-multiplatform-balance.yml` 是收录申请条目。把它按原文件名复制到：

```text
awesome-dsh-plugin/data/plugins/bjzkhy__dsh-multiplatform-balance.yml
```

然后：

```sh
npm ci
node scripts/generate-readme.mjs
```

把生成 README 和收录条目一起提 PR 到 awesome-dsh-plugin。

## 4. 检查项

- `package.json` 的 `repository.url` 与 GitHub 仓库一致。
- GitHub 仓库添加 topic `dsh-plugin`。
- npm 包名 `dsh-multiplatform-balance` 可用。
- 本地 `npm pack --dry-run` 已通过。