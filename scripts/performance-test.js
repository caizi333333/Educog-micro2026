const fs = require('fs');
const path = require('path');

/**
 * 只读性能基准。
 * 输入环境变量：
 *   TEST_URL, TEST_TOKEN, CONCURRENCY, REQUESTS_PER_USER, THINK_MS,
 *   TEST_ENDPOINTS(逗号分隔的 /api GET 路径), TEST_OUTPUT, GATE,
 *   DEPLOYMENT_VERSION（生产部署编号或不可变版本号）。
 * 输出 JSON：版本、测试口径、请求数、吞吐量、错误率、p50/p95/p99。
 */

function integerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} 必须是 ${min}-${max} 的整数`);
  }
  return value;
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

function gitOutput(args, fallback) {
  try {
    return require('child_process').execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

function sourceVersion() {
  return {
    commit: gitOutput(['rev-parse', 'HEAD'], 'UNKNOWN'),
    worktreeDirty: gitOutput(['status', '--porcelain'], '') !== '',
    deploymentVersion: process.env.DEPLOYMENT_VERSION
      || process.env.VERCEL_GIT_COMMIT_SHA
      || 'UNSPECIFIED',
  };
}

const baseUrl = (process.env.TEST_URL || 'http://localhost:3000').replace(/\/$/, '');
const authToken = process.env.TEST_TOKEN || '';
const concurrency = integerEnv('CONCURRENCY', 10, 1, 100);
const requestsPerUser = integerEnv('REQUESTS_PER_USER', 20, 1, 500);
const thinkMs = integerEnv('THINK_MS', 50, 0, 10_000);
const requestTimeoutMs = integerEnv('REQUEST_TIMEOUT_MS', 10_000, 500, 60_000);
const defaultEndpoints = [
  '/api/teacher/dashboard',
  '/api/analytics/learning-gains',
  '/api/knowledge-graph?type=stats',
  '/api/health/database',
];
const endpoints = (process.env.TEST_ENDPOINTS || defaultEndpoints.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!authToken) throw new Error('TEST_TOKEN 未设置；只允许使用受控演示账号的短期访问令牌');
if (!/^https?:\/\//.test(baseUrl)) throw new Error('TEST_URL 必须使用 http 或 https');
if (endpoints.length === 0) throw new Error('TEST_ENDPOINTS 不能为空');
for (const endpoint of endpoints) {
  if (!endpoint.startsWith('/api/') || endpoint.includes('://') || /[\r\n]/.test(endpoint)) {
    throw new Error(`仅允许本站 /api/ 只读路径：${endpoint}`);
  }
}

const generatedAt = new Date().toISOString();
const safeTimestamp = generatedAt.replace(/[:.]/g, '-');
const outputPath = path.resolve(process.env.TEST_OUTPUT || `tmp/feedback-audit/performance-${safeTimestamp}.json`);
const samples = [];
const errors = [];
let successfulRequests = 0;
let failedRequests = 0;

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function makeRequest(endpoint, workerId, iteration) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: 'application/json',
        'User-Agent': 'EduCog-ReadOnly-Benchmark/1.0',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const durationMs = performance.now() - started;
    samples.push(durationMs);
    if (response.ok) {
      successfulRequests += 1;
    } else {
      failedRequests += 1;
      errors.push({ endpoint, status: response.status, workerId, iteration });
    }
  } catch (error) {
    const durationMs = performance.now() - started;
    samples.push(durationMs);
    failedRequests += 1;
    errors.push({
      endpoint,
      status: null,
      workerId,
      iteration,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function worker(workerId) {
  for (let iteration = 0; iteration < requestsPerUser; iteration += 1) {
    const endpoint = endpoints[(workerId + iteration) % endpoints.length];
    await makeRequest(endpoint, workerId, iteration + 1);
    await sleep(thinkMs);
  }
}

async function main() {
  // 先逐个预热核心接口，预热不进入统计；若预热失败，正式测试仍会记录真实错误。
  for (const endpoint of endpoints) {
    const beforeSamples = samples.length;
    const beforeSuccess = successfulRequests;
    const beforeFailed = failedRequests;
    const beforeErrors = errors.length;
    await makeRequest(endpoint, 0, 0);
    samples.splice(beforeSamples);
    successfulRequests = beforeSuccess;
    failedRequests = beforeFailed;
    errors.splice(beforeErrors);
  }

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index + 1)));
  const durationMs = performance.now() - startedAt;
  const totalRequests = successfulRequests + failedRequests;
  const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 100;
  const p50 = percentile(samples, 0.5);
  const p95 = percentile(samples, 0.95);
  const p99 = percentile(samples, 0.99);
  const gateEnabled = process.env.GATE === 'true';
  const gate = {
    enabled: gateEnabled,
    target: '25并发只读核心接口：错误率≤1%，热态p95≤2000ms',
    passed: !gateEnabled || (errorRate <= 1 && p95 !== null && p95 <= 2000),
  };

  const report = {
    schemaVersion: 2,
    generatedAt,
    sourceVersion: sourceVersion(),
    target: baseUrl,
    method: 'GET_ONLY',
    config: {
      concurrency,
      requestsPerUser,
      thinkMs,
      requestTimeoutMs,
      endpoints,
    },
    results: {
      durationMs: Number(durationMs.toFixed(2)),
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRatePercent: Number(errorRate.toFixed(2)),
      throughputRps: Number((totalRequests / (durationMs / 1000)).toFixed(2)),
      latencyMs: {
        min: samples.length ? Number(Math.min(...samples).toFixed(2)) : null,
        average: samples.length ? Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2)) : null,
        p50: p50 === null ? null : Number(p50.toFixed(2)),
        p95: p95 === null ? null : Number(p95.toFixed(2)),
        p99: p99 === null ? null : Number(p99.toFixed(2)),
        max: samples.length ? Number(Math.max(...samples).toFixed(2)) : null,
      },
    },
    gate,
    errors: errors.slice(0, 20),
    interpretation: concurrency === 50
      ? '50并发为容量观察档，不自动表述为生产承诺。'
      : '该结果仅代表本次测试窗口和所列只读接口。',
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!gate.passed) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
