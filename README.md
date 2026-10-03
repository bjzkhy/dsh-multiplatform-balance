# dsh-multiplatform-balance

DeepSeek Harness 多平台余额 Skill 插件。

Query multi-platform model account balances across DeepSeek, Doubao / Volcengine, Qwen / Alibaba Cloud, Hunyuan / Tencent Cloud and other configured providers.

## 功能

- 向 Agent 注册 `multiplatform-balance` skill。
- 向 Agent 注册 `get_multiplatform_balances` 工具。
- 支持一次查询全部已配置平台，也支持只查单个平台。
- 支持 DeepSeek、豆包 / 火山引擎、千问 / 阿里云百炼、混元 / 腾讯云，以及 `type: custom` 的自定义 HTTP 余额接口。
- 内置 60 秒缓存，避免频繁请求。
- 只读，不会充值或修改账户。

## 安装

```sh
dsh plugin --profile web add dsh-multiplatform-balance
```

桌面端把 `--profile web` 换成对应 profile，例如 `desktop`。

## 配置

在 profile 的 `cordis.patch.yml` 中给 `dsh-multiplatform-balance` 添加 `config.balance`：

```yaml
- id: dsh-multiplatform-balance
  config:
    currency: "CNY"
    balanceCacheTtl: 60
    balance:
      "deepseek":
        type: deepseek
        apiKey: "sk-..."
        currency: "CNY"
      "doubao":
        type: volcengine
        accessKey: "AKLT..."
        secretKey: "..."
        region: "cn-north-1"
        version: "2022-01-01"
        currency: "CNY"
      "qwen":
        type: aliyun
        accessKeyId: "LTAI..."
        accessKeySecret: "..."
        currency: "CNY"
      "hunyuan":
        type: tencent
        secretId: "AKID..."
        secretKey: "..."
        region: "ap-beijing"
        currency: "CNY"
```

说明：

- 豆包 / 千问 / 混元查询的是云账号级余额，不是单个模型余额。
- 未配置的平台会返回 `configured: false`，不会编造余额。
- 密钥只存在本地配置文件中，注意不要泄露。

## 自定义 HTTP 接口

```yaml
balance:
  myproxy:
    type: custom
    endpoint: "https://你的中转站/api/balance"
    headers:
      Authorization: "Bearer sk-xxx"
    valuePath: "data.balance"
    currency: "CNY"
```

`valuePath` 支持点号路径，例如 `data.balance`、`balance`、`data.amount`。

## Agent 使用

模型或用户可以使用：

- Skill: `multiplatform-balance`
- Tool: `get_multiplatform_balances`
  - 参数 `provider` 可选，例如 `deepseek`、`doubao`、`qwen`、`hunyuan`。

## License

MIT