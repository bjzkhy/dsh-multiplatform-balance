import { createHash, createHmac } from "node:crypto"

// Minimal provider aliases used by balance config lookup.
const BALANCE_ALIASES = {
  deepseek: "deepseek",
  doubao: "doubao", volcengine: "doubao", volces: "doubao", ark: "doubao", volcano: "doubao",
  qwen: "qwen", qianwen: "qwen", tongyi: "qwen", dashscope: "qwen", bailian: "qwen", aliyun: "qwen",
  hunyuan: "hunyuan", tencent: "hunyuan",
  kimi: "moonshot", moonshot: "moonshot", moonshotai: "moonshot",
  zhipu: "zhipu", zai: "zhipu", bigmodel: "zhipu", glm: "zhipu",
  openai: "openai",
  anthropic: "anthropic", claude: "anthropic",
  siliconflow: "siliconflow", silicon: "siliconflow",
  openrouter: "openrouter", oneapi: "openrouter", newapi: "openrouter"
}

function normalizeBalanceProvider(provider) {
  const raw = String(provider ?? "").trim()
  const key = raw.toLowerCase().replace(/[^a-z0-9._-]/g, "")
  return BALANCE_ALIASES[key] || key
}
const BALANCE_PROVIDER_PRESETS = [
  { provider: "deepseek", label: "DeepSeek", kind: "apiKey", type: "deepseek" },
  { provider: "doubao", label: "豆包 / Doubao", kind: "cloud", type: "volcengine" },
  { provider: "qwen", label: "千问 / Qwen", kind: "cloud", type: "aliyun" },
  { provider: "hunyuan", label: "混元 / Hunyuan", kind: "cloud", type: "tencent" }
]

function balanceKind(type) {
  const t = String(type ?? "").toLowerCase()
  if (t === "volcengine" || t === "tencent" || t === "aliyun") return "cloud"
  if (t === "custom") return "custom"
  return "apiKey"
}

function providerLabel(provider, preset) {
  if (preset && preset.label) return preset.label
  const p = String(provider ?? "")
  const known = {
    deepseek: "DeepSeek",
    doubao: "豆包 / Doubao",
    qwen: "千问 / Qwen",
    hunyuan: "混元 / Hunyuan",
    moonshot: "Kimi",
    zhipu: "智谱 GLM",
    openai: "OpenAI",
    anthropic: "Anthropic"
  }
  return known[p.toLowerCase()] || p
}

// 火山参数全局缓存（自动适配成功后复用）
const volcSuccessParams = new Map();
const VOLC_CANDIDATES = {
  actions: ["QueryBalanceAcct", "QueryBalance", "GetBalance", "GetAccountBalance"],
  versions: ["2022-01-01", "2021-01-01", "2018-01-01", "2023-01-01"],
  services: ["billing", "finance", "trade", "account", "bill"],
  endpoints: ["https://billing.volcengineapi.com/", "https://open.volcengineapi.com/"]
};
// ---------- 火山引擎 V4 签名（billing QueryBalanceAcct） ----------
function signVolcEngine({ method, host, path, query, accessKey, secretKey, region, service, payload }) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, "")            // YYYYMMDD
  const xDate = now.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z"  // YYYYMMDDTHHMMSSZ
  const hashedPayload = createHash("sha256").update(payload || "").digest("hex")
  const enc = (s) => encodeURIComponent(s)
  const canonicalQuery = Object.keys(query || {})
    .sort()
    .map((k) => enc(k) + "=" + enc(String(query[k])))
    .join("&")
  const canonicalHeaders =
    "host:" + host + "\n" +
    "x-content-sha256:" + hashedPayload + "\n" +
    "x-date:" + xDate + "\n"
  const signedHeaders = "host;x-content-sha256;x-date"
  const canonicalRequest = [
    method, path || "/", canonicalQuery, canonicalHeaders, signedHeaders, hashedPayload
  ].join("\n")
  const scope = date + "/" + region + "/" + service + "/request"
  const stringToSign =
    "HMAC-SHA256\n" + xDate + "\n" + scope + "\n" +
    createHash("sha256").update(canonicalRequest).digest("hex")
  // 火山Secret是Base64编码的二进制串，先解码
  const secretBuf = Buffer.from(secretKey, "utf8"); // 火山官方 Secret 是原始字符串，不 Base64 解码
  const kDate = createHmac("sha256", secretBuf).update(date).digest()
  const kRegion = createHmac("sha256", kDate).update(region).digest()
  const kService = createHmac("sha256", kRegion).update(service).digest()
  const kSigning = createHmac("sha256", kService).update("request").digest()
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex")
  const authorization =
    "HMAC-SHA256 Credential=" + accessKey + "/" + scope +
    ", SignedHeaders=" + signedHeaders +
    ", Signature=" + signature
  return {
    queryString: canonicalQuery,
    headers: {
      host: host,
      "x-content-sha256": hashedPayload,
      "x-date": xDate,
      Authorization: authorization
    }
  }
}


// ---------- 腾讯云 TC3 签名（billing DescribeAccountBalance，混元按腾讯云账户计费） ----------
function signTencent({ secretId, secretKey, region = "", service = "billing", action = "DescribeAccountBalance", version = "2018-07-09", body = "{}" }) {
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const date = now.toISOString().slice(0, 10)   // YYYY-MM-DD（腾讯 TC3 的 Credential 日期格式）
  const host = "billing.tencentcloudapi.com"
  const contentType = "application/json; charset=utf-8"
  const hashedPayload = createHash("sha256").update(body).digest("hex")
  const canonicalHeaders = "content-type:" + contentType + "\nhost:" + host + "\n"
  const signedHeaders = "content-type;host"
  const canonicalRequest = [
    "POST", "/", "",
    canonicalHeaders, signedHeaders, hashedPayload
  ].join("\n")
  const scope = date + "/" + service + "/tc3_request"
  const stringToSign = [
    "TC3-HMAC-SHA256", String(timestamp), scope,
    createHash("sha256").update(canonicalRequest).digest("hex")
  ].join("\n")
  const secretDate = createHmac("sha256", "TC3" + secretKey).update(date).digest()
  const secretService = createHmac("sha256", secretDate).update(service).digest()
  const secretSigning = createHmac("sha256", secretService).update("tc3_request").digest()
  const signature = createHmac("sha256", secretSigning).update(stringToSign).digest("hex")
  const headers = {
    "Content-Type": contentType,
    "X-TC-Action": action,
    "X-TC-Version": version,
    "X-TC-Timestamp": String(timestamp),
    Authorization: "TC3-HMAC-SHA256 Credential=" + secretId + "/" + scope +
      ", SignedHeaders=" + signedHeaders + ", Signature=" + signature
  }
  if (region) headers["X-TC-Region"] = region
  return { url: "https://" + host + "/", headers, body }
}

// ---------- 阿里云 RPC 签名（bssopenapi QueryAccountBalance，千问按阿里云账户计费） ----------
function percentEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/\!/g, "%21")
    .replace(/\'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
}
function signAliyun({ accessKeyId, accessKeySecret, region = "", action = "QueryAccountBalance", version = "2017-12-14" }) {
  const params = {
    Action: action,
    Version: version,
    Format: "JSON",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
  }
  if (region) params.RegionId = region
  const keys = Object.keys(params).sort()
  const canonicalized = keys
    .map((k) => percentEncode(k) + "=" + percentEncode(params[k]))
    .join("&")
  const stringToSign = "GET&%2F&" + percentEncode(canonicalized)
  const signature = createHmac("sha1", accessKeySecret + "&").update(stringToSign).digest("base64")
  return {
    url: "https://business.aliyuncs.com/?" + canonicalized + "&Signature=" + percentEncode(signature),
    headers: {}
  }
}

// 余额配置查找：精确 → 别名 → 关键词模糊（doubao/volc/ark 任意写法都命中）
function findBalanceConfig(provider, config) {
  const balances = config.balance || {}
  const p = String(provider ?? "").toLowerCase()
  // 1) 精确
  if (balances[p]) return balances[p]
  // 2) 别名归一
  const norm = normalizeBalanceProvider(p)
  if (balances[norm]) return balances[norm]
  // 3) 关键词模糊
  const kw = {
    doubao: /(doubao|volc|ark|豆包|火山)/,
    deepseek: /deepseek/,
    tencent: /(hunyuan|混元|tencent|腾讯)/,
    aliyun: /(qwen|千问|dashscope|bailian|百炼|aliyun|阿里)/
  }
  for (const key of Object.keys(balances)) {
    const lk = String(key).toLowerCase()
    for (const [target, re] of Object.entries(kw)) {
      if (re.test(p) && re.test(lk)) return balances[key]
    }
  }
  return null
}
// ---------- 余额查询 ----------
const balanceCache = new Map(); // key: provider, value: { value, currency, updatedAt, error }

// 内置厂商余额查询实现
async function queryBalance(provider, config) {
  // 配置查找：精确 → 别名 → 关键词模糊（支持 volcengine-ark 等自定义 provider 名）
  const balanceConfig = findBalanceConfig(provider, config);
  if (!balanceConfig) return null;
  const { type, apiKey, endpoint, headers = {}, valuePath = "balance", currency = config.currency } = balanceConfig;
  const now = Date.now();
  const cacheKey = provider;
  const cached = balanceCache.get(cacheKey);
  const ttlMs = (config.balanceCacheTtl ?? 60) * 1000; // ?? 而非 ||：ttl=0 表示禁用缓存
  if (cached && (now - cached.updatedAt) < ttlMs) {
    return cached;
  }
  try {
    let url, reqHeaders = {...headers}, method = "GET", body;
    if (type === "deepseek") {
      url = endpoint || "https://api.deepseek.com/user/balance";
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (type === "openai") {
      url = endpoint || "https://api.openai.com/v1/dashboard/billing/subscription";
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (type === "anthropic") {
      url = endpoint || "https://api.anthropic.com/v1/organizations/:organization_id/usage"; // Anthropic 余额需要 organization_id
      reqHeaders["x-api-key"] = apiKey;
      reqHeaders["anthropic-version"] = "2023-06-01";
    } else if (type === "moonshot") {
      url = endpoint || "https://api.moonshot.cn/v1/users/me/balance";
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (type === "zhipu") {
      url = endpoint || "https://open.bigmodel.cn/api/paas/v4/user/finances";
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    } else if (type === "volcengine") {
      const volcVersion = balanceConfig.version || "2022-01-01";
      const {
        accessKey,
        secretKey,
        region = "cn-north-1",
        endpoint = "https://billing.volcengineapi.com/",
        service = "billing",
        action = "QueryBalanceAcct"
      } = balanceConfig;
      let chosen = { endpoint, service, action, version: volcVersion };
      // 默认走火山 Billing QueryBalanceAcct；只有显式 autoDetect: true 才做候选探测，避免设置页第一次加载过慢
      if (balanceConfig.autoDetect === true) {
        const volcCacheKey = `${accessKey}:${region}`;
        if (!volcSuccessParams.has(volcCacheKey)) {
          outer: for (const endpointCandidate of VOLC_CANDIDATES.endpoints) {
            for (const serviceCandidate of VOLC_CANDIDATES.services) {
              for (const actionCandidate of VOLC_CANDIDATES.actions) {
                for (const versionCandidate of VOLC_CANDIDATES.versions) {
                  try {
                    const hostCandidate = new URL(endpointCandidate).host;
                    const signedCandidate = signVolcEngine({
                      method: "GET", host: hostCandidate, path: "/",
                      query: { Action: actionCandidate, Version: versionCandidate },
                      accessKey, secretKey, region, service: serviceCandidate, payload: ""
                    });
                    const testUrl = endpointCandidate + "?" + signedCandidate.queryString;
                    const testHeaders = { ...signedCandidate.headers, Host: hostCandidate };
                    const testRes = await fetch(testUrl, { headers: testHeaders, signal: AbortSignal.timeout(3000) });
                    if (testRes.ok) {
                      const testJson = await testRes.json();
                      if (testJson && !testJson.ResponseMetadata?.Error) {
                        volcSuccessParams.set(volcCacheKey, {
                          endpoint: endpointCandidate,
                          service: serviceCandidate,
                          action: actionCandidate,
                          version: versionCandidate
                        });
                        break outer;
                      }
                    }
                  } catch {}
                }
              }
            }
          }
        }
        chosen = volcSuccessParams.get(`${accessKey}:${region}`) || chosen;
      }
      const host = new URL(chosen.endpoint).host;
      const signed = signVolcEngine({
        method: "GET", host, path: "/",
        query: { Action: chosen.action, Version: chosen.version },
        accessKey, secretKey, region, service: chosen.service, payload: ""
      });
      url = chosen.endpoint + "?" + signed.queryString;
      reqHeaders = { ...signed.headers, ...reqHeaders, Host: host };
    } else if (type === "tencent") {
      const { secretId, secretKey, region = "", service = "billing", action = "DescribeAccountBalance", apiVersion = "2018-07-09" } = balanceConfig;
      const signed = signTencent({ secretId, secretKey, region, service, action, version: apiVersion, body: "{}" });
      url = signed.url;
      reqHeaders = { ...signed.headers, ...reqHeaders };
      method = "POST";
      body = signed.body;
    } else if (type === "aliyun") {
      const { accessKeyId, accessKeySecret, region = "", action = "QueryAccountBalance", apiVersion = "2017-12-14" } = balanceConfig;
      const signed = signAliyun({ accessKeyId, accessKeySecret, region, action, version: apiVersion });
      url = signed.url;
      reqHeaders = { ...signed.headers, ...reqHeaders };
    } else if (type === "custom" && endpoint) {
      url = endpoint;
    } else {
      throw new Error("Unsupported balance provider type");
    }
    const res = await fetch(url, {
      method: method,
      headers: reqHeaders,
      body: body,
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // 云厂商常以 HTTP 200 返回业务错误，这里统一识别，避免误显示为 0
    const providerError = json?.ResponseMetadata?.Error || json?.Response?.Error ||
      (json?.Code && json?.Message && !json?.Data ? { Code: json.Code, Message: json.Message } : null);
    if (providerError) {
      const code = providerError.Code || providerError.code;
      const message = providerError.Message || providerError.message;
      throw new Error([code, message].filter(Boolean).join(": ") || "provider error");
    }
    // 值提取：valuePath 点号路径；deepseek 官方接口可能是 balance_infos 数组（求和）
    let value;
    if (type === "deepseek") {
      const direct = typeof json.balance === "number" || typeof json.balance === "string"
        ? Number(json.balance)
        : undefined;
      if (direct != null && Number.isFinite(direct)) {
        value = direct;
      } else if (Array.isArray(json.balance_infos)) {
        value = json.balance_infos
          .filter((b) => b == null || b.is_available !== false)
          .reduce((sum, b) => sum + (Number(b.total_balance) || 0), 0);
      } else {
        value = valuePath.split(".").reduce((obj, k) => obj?.[k], json);
      }
    } else if (type === "volcengine") {
      // 火山余额接口字段名可能为 Balance / AvailableBalance / Result.Balance 等
      const candidates = ["Result.AvailableBalance", "Result.Balance", "Result.CashBalance", "Result.TotalBalance", "AvailableBalance", "Balance"];
      let hit = null
      for (const p of candidates) {
        const v = p.split(".").reduce((obj, k) => obj?.[k], json)
        if (v != null) { hit = Number(v); break }
      }
      value = hit != null && Number.isFinite(hit) ? hit : valuePath.split(".").reduce((obj, k) => obj?.[k], json)
    } else if (type === "tencent") {
      // 腾讯云费用中心：Response.AvailableAmount（可用余额，元）
      const candidates = ["Response.AvailableAmount", "Response.Balance", "Response.CashBalance"];
      let hit = null
      for (const p of candidates) {
        const v = p.split(".").reduce((obj, k) => obj?.[k], json)
        if (v != null) { hit = Number(v); break }
      }
      value = hit != null && Number.isFinite(hit) ? hit : valuePath.split(".").reduce((obj, k) => obj?.[k], json)
    } else if (type === "aliyun") {
      // 阿里云 BSS：Data.AvailableAmount（可用金额，字符串→数字）
      const candidates = ["Data.AvailableAmount", "Data.AvailableCashAmount", "Data.CashAmount"];
      let hit = null
      for (const p of candidates) {
        const v = p.split(".").reduce((obj, k) => obj?.[k], json)
        if (v != null) { hit = Number(v); break }
      }
      value = hit != null && Number.isFinite(hit) ? hit : valuePath.split(".").reduce((obj, k) => obj?.[k], json)
    } else {
      value = valuePath.split(".").reduce((obj, k) => obj?.[k], json);
    }
    const result = { value: Number(value) || 0, currency, updatedAt: now, provider, error: null };
    balanceCache.set(cacheKey, result);
    return result;
  } catch (e) {
    const errorResult = { value: null, currency: currency, updatedAt: now, provider, error: e.message };
    balanceCache.set(cacheKey, errorResult);
    return errorResult;
  }
}
export async function listBalances(config = {}) {
  const balanceConfigs = config.balance || {}
  const seen = new Set()
  const items = []
  const pushConfigured = async (provider, preset, balanceConfig) => {
    if (!balanceConfig || seen.has(balanceConfig)) return
    seen.add(balanceConfig)
    const result = await queryBalance(provider, config)
    items.push({
      provider,
      label: providerLabel(provider, preset),
      kind: balanceKind(balanceConfig.type),
      type: balanceConfig.type,
      configured: true,
      value: result?.value ?? null,
      currency: result?.currency || balanceConfig.currency || config.currency || "CNY",
      updatedAt: result?.updatedAt || Date.now(),
      error: result?.error || null
    })
  }
  for (const preset of BALANCE_PROVIDER_PRESETS) {
    const balanceConfig = findBalanceConfig(preset.provider, config)
    if (!balanceConfig) {
      items.push({
        provider: preset.provider,
        label: preset.label,
        kind: preset.kind,
        type: preset.type,
        configured: false,
        value: null,
        currency: config.currency || "CNY",
        updatedAt: null,
        error: null
      })
      continue
    }
    await pushConfigured(preset.provider, preset, balanceConfig)
  }
  for (const key of Object.keys(balanceConfigs)) {
    const balanceConfig = balanceConfigs[key]
    if (!balanceConfig || seen.has(balanceConfig)) continue
    await pushConfigured(key, null, balanceConfig)
  }
  return items
}

export {
  BALANCE_PROVIDER_PRESETS,
  balanceKind,
  providerLabel,
  findBalanceConfig,
  queryBalance
}