/**
 * 实验空间（ilab-x.com）2022 版接口客户端（含 2026 版 ai_data 扩展字段）。
 * 仅服务端调用（接口规范明确"暂不支持前端语言 JavaScript 使用"，即须在服务端完成签名与调用）。
 *
 * 编码纪律（见官方常见问题）：
 * - 签名使用 ticket/access_token 的【解码后原文】；URL 拼接使用【编码后】值；
 * - MD5 签名结果一律转大写；
 * - originId 只允许大小写字母/数字/下划线（禁用 "-"）；
 * - ticket 两分钟过期，拿到后须立即换 access_token；
 * - data_upload 的 POST body 不做 urlEncode，Content-Type: application/json。
 */
import { createHash } from 'node:crypto';
import type { IlabConfig } from './config';

export interface IlabTokenInfo {
  accessToken: string;
  username: string;      // un：实验空间用户账号
  displayName: string;   // dis：用户姓名
  expiresAtMs: number;   // 13 位时间戳
}

export interface IlabStepRecord {
  seq: number;
  title: string;
  startTime: number;
  endTime: number;
  timeUsed: number;
  expectTime: number;
  maxScore: number;
  score: number;
  repeatCount: number;
  evaluation: string;
  scoringModel: string;
  remarks?: string;
  ext_data?: Record<string, unknown>;
}

export interface IlabAiModelUsed {
  model: string;
  version: string;
  /** 仅允许：公有云服务 | 私有化部署 | 混合服务 | 本地运行 */
  deployment: '公有云服务' | '私有化部署' | '混合服务' | '本地运行';
  provider?: string;
}

export interface IlabAiData {
  ai_call_count: number;
  ai_models_used: IlabAiModelUsed[];
  ai_usage_scenarios: string[];
  ai_input_token_count?: number;
  ai_output_token_count?: number;
  ai_remark?: string;
}

export interface IlabResultPayload {
  username: string;
  title: string;
  childProjectTitle?: string;
  /** 1-完成；2-未完成 */
  status: 1 | 2;
  score: number;
  startTime: number;
  endTime: number;
  timeUsed: number;
  appid: string;
  /** 平台唯一记录ID：仅大小写字母、数字、下划线 */
  originId: string;
  steps: IlabStepRecord[];
  group_id?: string;
  group_name?: string;
  role_in_group?: string;
  group_members?: string;
  ext_data?: Record<string, unknown>;
  ai_data?: IlabAiData;
}

export interface IlabApiReply {
  code: number;
  msg?: string;
  id?: string;
  [key: string]: unknown;
}

export function md5Upper(text: string): string {
  return createHash('md5').update(text, 'utf8').digest('hex').toUpperCase();
}

/** 校验 originId 合法性（规范：字母/数字/下划线，勿用 "-"） */
export function normalizeOriginId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_');
}

async function callJson(url: string, init?: RequestInit): Promise<IlabApiReply> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as IlabApiReply;
  } catch {
    return { code: -1, msg: `非JSON响应 HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
}

/**
 * 用 ticket 换取 access_token 与用户信息。
 * ticket 两分钟过期，必须在落地页立即调用。
 */
export async function exchangeTicket(
  config: IlabConfig,
  ticket: string,
): Promise<IlabTokenInfo> {
  // ticket 可能以编码形态（跳转 URL 原文）或已解码形态（框架参数解析）到达，
  // 统一先还原成原文：签名与重编码都必须基于原文，双重编码会导致 signature 不匹配。
  let decodedTicket = ticket;
  try { decodedTicket = decodeURIComponent(ticket); } catch { /* 已是原文 */ }
  const signature = md5Upper(decodedTicket + config.appid + config.secret);
  const url =
    `${config.apiBase}/open/api/v2/token?ticket=${encodeURIComponent(decodedTicket)}` +
    `&appid=${encodeURIComponent(config.appid)}&signature=${signature}`;
  const reply = await callJson(url);
  if (reply.code !== 0 || typeof reply.access_token !== 'string') {
    throw new Error(`实验空间令牌换取失败（code=${reply.code}）：${reply.msg ?? '未知错误'}`);
  }
  return {
    accessToken: reply.access_token,
    username: typeof reply.un === 'string' ? reply.un : '',
    displayName: typeof reply.dis === 'string' ? reply.dis : '',
    expiresAtMs: typeof reply.expires_time === 'number' ? reply.expires_time : Date.now() + 24 * 3600e3,
  };
}

/**
 * 重新获取 access_token（原 token 最多可换 2 次，换来的是最终 token，不能再续）。
 */
export async function refreshAccessToken(
  config: IlabConfig,
  accessToken: string,
): Promise<{ accessToken: string; expiresAtMs: number }> {
  const signature = md5Upper(accessToken + config.appid + config.secret);
  const url =
    `${config.apiBase}/open/api/v2/token/refresh?access_token=${encodeURIComponent(accessToken)}` +
    `&appid=${encodeURIComponent(config.appid)}&signature=${signature}`;
  const reply = await callJson(url);
  if (reply.code !== 0 || typeof reply.access_token !== 'string') {
    throw new Error(`实验空间令牌刷新失败（code=${reply.code}）：${reply.msg ?? '未知错误'}`);
  }
  return {
    accessToken: reply.access_token,
    expiresAtMs: typeof reply.expires_time === 'number' ? reply.expires_time : Date.now() + 24 * 3600e3,
  };
}

/**
 * 实验结果数据回传。返回码 0 为成功；19 为 ai_data 校验类错误。
 */
export async function uploadExperimentResult(
  config: IlabConfig,
  accessToken: string,
  payload: IlabResultPayload,
): Promise<IlabApiReply> {
  const url = `${config.apiBase}/open/api/v2/data_upload?access_token=${encodeURIComponent(accessToken)}`;
  return callJson(url, { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * 实验报告附件上传。注意：附件内容直接放请求体（非 form-data），≤5MB。
 * 须在 data_upload 成功之后调用。
 */
export async function uploadAttachment(
  config: IlabConfig,
  accessToken: string,
  args: {
    originId: string;
    filename: string;
    title: string;
    remarks?: string;
    content: Uint8Array;
  },
): Promise<IlabApiReply> {
  const qs =
    `access_token=${encodeURIComponent(accessToken)}` +
    `&appid=${encodeURIComponent(config.appid)}` +
    `&originId=${encodeURIComponent(args.originId)}` +
    `&filename=${encodeURIComponent(args.filename)}` +
    `&title=${encodeURIComponent(args.title)}` +
    `&remarks=${encodeURIComponent(args.remarks ?? '')}`;
  const res = await fetch(`${config.apiBase}/open/api/v2/attachment_upload?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: args.content as unknown as BodyInit,
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as IlabApiReply;
  } catch {
    return { code: -1, msg: `非JSON响应 HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
}

/** 回传结果查询（正式平台仅负责人/团队可查，按 originId 单条核对）。 */
export async function getUploadedResult(
  config: IlabConfig,
  accessToken: string,
  query: { originId?: string; username?: string; start?: number },
): Promise<unknown> {
  const signature = md5Upper(accessToken + config.appid + config.secret);
  const params = new URLSearchParams({
    access_token: accessToken,
    appid: config.appid,
    signature,
    start: String(query.start ?? 1),
  });
  if (query.originId) params.set('originId', query.originId);
  if (query.username) params.set('username', query.username);
  const res = await fetch(`${config.apiBase}/open/api/v2/data_get?${params.toString()}`);
  return res.json();
}
