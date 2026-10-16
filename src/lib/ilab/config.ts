/**
 * 实验空间（ilab-x.com）对接配置。
 * 依据：《国家虚拟仿真实验教学课程技术接口规范（2022版）》
 *      ＋《“人工智能+”虚拟仿真实验教学项目技术接口规范（2026版）》ai_data 扩展。
 *
 * 环境变量：
 *   ILAB_ENABLED         是否启用对接（默认关闭，避免日常教学误回传）
 *   ILAB_API_BASE        接口地址。测试平台 http://39.105.173.29；正式 https://www.ilab-x.com
 *   ILAB_APPID           实验空间分配的项目编号（测试公用密钥 APPID=10000）
 *   ILAB_SECRET          实验空间分配的项目密钥
 *   ILAB_EXPERIMENT_ID   本平台内与申报项目对应的实验编号，默认 proj04
 *   ILAB_EXPERIMENT_TITLE 回传用的实验名称（应与实验空间登记的课程名一致）
 *   ILAB_UPLOAD_REPORT   是否在成绩回传后上传实验报告附件（默认关闭）
 */
export interface IlabConfig {
  enabled: boolean;
  apiBase: string;
  appid: string;
  secret: string;
  experimentId: string;
  experimentTitle: string;
  uploadReport: boolean;
}

export function getIlabConfig(): IlabConfig {
  return {
    enabled: process.env.ILAB_ENABLED === 'true',
    apiBase: (process.env.ILAB_API_BASE ?? 'https://www.ilab-x.com').replace(/\/+$/, ''),
    appid: process.env.ILAB_APPID ?? '',
    secret: process.env.ILAB_SECRET ?? '',
    experimentId: process.env.ILAB_EXPERIMENT_ID ?? 'proj04',
    experimentTitle:
      process.env.ILAB_EXPERIMENT_TITLE ?? '智慧农业大棚监控系统设计',
    uploadReport: process.env.ILAB_UPLOAD_REPORT === 'true',
  };
}

export function isIlabConfigured(config: IlabConfig = getIlabConfig()): boolean {
  return config.enabled && Boolean(config.appid) && Boolean(config.secret);
}
