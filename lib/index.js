import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { defineTool } from "@deepseek-ai/dsh-tools"
import { BUNDLED_SKILL_RANK } from "@deepseek-ai/dsh-skill"
import { BALANCE_PROVIDER_PRESETS, listBalances, queryBalance } from "./balance.js"

const PROVIDER_NAME = "multiplatform-balance"
const SKILL_NAME = "multiplatform-balance"
const TOOL_NAME = "get_multiplatform_balances"
const SKILL_BODY_URL = new URL("../assets/multiplatform-balance.md", import.meta.url)
const RESOURCE_BASE = {
  kind: "directory",
  path: fileURLToPath(new URL("../assets/", import.meta.url))
}

const SKILL_DESCRIPTION = "Query account balances across DeepSeek, Doubao / Volcengine, Qwen / Alibaba Cloud, Hunyuan / Tencent Cloud and other configured providers. Use when the user asks for multi-platform balances, account balance, recharge balance, or wants to compare balances across model providers. 查询多平台余额、账户余额、充值余额或对比不同模型平台余额时使用。"

const CANDIDATE = {
  name: SKILL_NAME,
  description: SKILL_DESCRIPTION,
  whenToUse: "用户询问多平台余额、账户余额、充值余额、赠金余额，或要求对比 DeepSeek、豆包、千问、混元等平台的可用余额时使用。",
  invocation: {
    modelInvocable: true,
    userInvocable: true
  },
  provider: PROVIDER_NAME,
  source: "bundled",
  rank: BUNDLED_SKILL_RANK,
  resourceBase: RESOURCE_BASE,
  locator: SKILL_BODY_URL
}

const provider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([CANDIDATE]),
  async get(_candidate) {
    return {
      name: CANDIDATE.name,
      description: CANDIDATE.description,
      whenToUse: CANDIDATE.whenToUse,
      invocation: CANDIDATE.invocation,
      provider: CANDIDATE.provider,
      source: CANDIDATE.source,
      resourceBase: RESOURCE_BASE,
      content: await readFile(SKILL_BODY_URL, "utf8")
    }
  }
}

export const name = "dsh-multiplatform-balance"
export const inject = ["skills", "tools"]

export function apply(ctx, config = {}) {
  const cfg = {
    currency: "CNY",
    balanceCacheTtl: 60,
    balance: {},
    ...(config ?? {})
  }

  ctx.skills.registerProvider(() => provider)

  ctx.tools.register(defineTool({
    name: TOOL_NAME,
    description: "查询已配置的模型平台账户余额。默认返回全部平台；传入 provider 时只返回单个平台。只读操作，不会充值或修改配置。",
    parameters: {
      provider: {
        type: "string",
        description: "可选。单个平台 id，例如 deepseek、doubao、qwen、hunyuan；省略时返回全部已配置平台。"
      }
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          balances: {
            type: "array",
            required: true,
            items: {
              type: "object",
              additionalProperties: true
            }
          },
          queriedAt: {
            type: "number",
            required: true
          }
        }
      },
      render: (_args, value) => [{
        type: "text",
        text: JSON.stringify(value, null, 2)
      }]
    },
    async execute(args) {
      let items
      if (args && args.provider) {
        const result = await queryBalance(args.provider, cfg)
        items = result
          ? [result]
          : [{ provider: args.provider, configured: false, value: null, error: "not configured" }]
      } else {
        items = await listBalances(cfg)
      }
      return { balances: items, queriedAt: Date.now() }
    }
  }))
}

export { BALANCE_PROVIDER_PRESETS }