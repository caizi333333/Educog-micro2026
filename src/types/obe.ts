// OBE 共享类型定义

export type AssessmentType = 'QUIZ' | 'EXPERIMENT' | 'LEARNING_PROGRESS' | 'COMPREHENSIVE';

export type CQIReportType = 'COURSE' | 'INDICATOR' | 'GRADUATION_REQ';
export type CQIStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'CLOSED';
export type CQIActionCategory = 'CONTENT' | 'METHOD' | 'RESOURCE' | 'ASSESSMENT';
export type CQIActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface OBERadarDataPoint {
  indicatorCode: string;
  indicatorName: string;
  graduationReqName: string;
  achievementDegree: number;
  threshold: number;
  passed: boolean;
}

export interface OBEStudentProgress {
  courseObjectives: {
    id: string;
    code: string;
    name: string;
    achievementDegree: number;
    passed: boolean;
    breakdown: {
      type: string;
      targetId: string;
      description?: string;
      score: number;
      maxScore: number;
      weight: number;
    }[];
  }[];
  indicatorPoints: {
    id: string;
    code: string;
    description: string;
    achievementDegree: number;
    threshold: number;
    passed: boolean;
    contributingCOs: { coCode: string; coAchievement: number; supportWeight: number }[];
  }[];
  overallPassedCount: number;
  overallTotalCount: number;
}

export interface OBEGapAnalysisResult {
  classId: string;
  semester: string;
  weakPoints: { code: string; name: string; avgAchievement: number; threshold: number; gap: number }[];
  strengths: { code: string; name: string; avgAchievement: number }[];
  totalIndicators: number;
  passedIndicators: number;
  averageAchievement: number | null;
  totalStudents: number;
  passedStudents: number;
  passRate: number | null;
  expectedRecords: number;
  actualRecords: number;
  dataSufficient: boolean;
  configurationUpdatedAt: string | null;
}

export interface OBECQIReport {
  id: string;
  semester: string;
  classId: string | null;
  title: string;
  reportType: CQIReportType;
  targetCode: string | null;
  averageAchievement: number | null;
  passRate: number | null;
  totalStudents: number;
  passedStudents: number;
  weakPoints: any;
  strengths: any;
  improvementMeasures: any;
  status: CQIStatus;
  createdAt: string;
}

export interface OBECQIActionItem {
  id: string;
  cqiReportId: string;
  description: string;
  category: CQIActionCategory;
  assignedTo: string | null;
  dueDate: string | null;
  status: CQIActionStatus;
  result: string | null;
}

export interface OBEClassStats {
  classId: string;
  className: string;
  studentCount: number;
  averageAchievementByCO: { coCode: string; coName: string; avg: number; passRate: number }[];
  averageAchievementByIP: { ipCode: string; ipName: string; avg: number; passRate: number }[];
}

export interface OBESchoolSummary {
  semester: string;
  totalClasses: number;
  totalStudents: number;
  averageAchievement: number;
  passRateByGR: { grCode: string; grName: string; passRate: number; avgAchievement: number }[];
}
