# 多平台余额

查询 DeepSeek、豆包 / 火山引擎、千问 / 阿里云百炼、混元 / 腾讯云等平台的账户余额。

## 何时使用

- 用户问多平台余额账户余额充值余额赠金余额还有多少余额。
- 用户想同时查看或对比 DeepSeek、豆包、千问、混元等平台的余额。
- 用户问某个具体平台还能不能继续调用 API。

## 使用方式

优先调用 `get_multiplatform_balances` 工具：

- 不传参数：返回全部已配置平台。
- 传入 `provider`：只查单个平台，例如 `deepseek`、`doubao`、`qwen`、`hunyuan`。

如果工具不可用，再使用本机 DSH 的只读接口：

```powershell
Invoke-RestMethod 'http://127.0.0.1:3080/dsh-token-ledger-pro/balances' | ConvertTo-Json -Depth 6
```

单个平台：

```powershell
Invoke-RestMethod 'http://127.0.0.1:3080/dsh-token-ledger-pro/balance?provider=deepseek' | ConvertTo-Json -Depth 6
```

## 输出要求

用表格或列表展示：

| 平台 | 余额 | 币种 | 状态 |
|---|---|---|---|
| DeepSeek | 11.25 | CNY | 正常 |
| 豆包 / Doubao | -0.53 | CNY | 正常 |
| 千问 / Qwen | 3.21 | CNY | 正常 |
| 混元 / Hunyuan | 0 | CNY | 正常 |

规则：

- `configured: false` 显示未配置，不要编造余额。
- `error` 非空时显示错误原因，不要把错误显示成 0。
- 这是只读操作，禁止充值、修改配置、输出 API Key / AK/SK。
- 豆包、千问、混元查到的是云账号级余额，不是单个模型余额；说明时请注明。