export const API_BASE_URL = "https://sabixa-mvp.vercel.app/api/v1";

export type RoleTrack = {
  id: string;
  title: string;
  role_family: string;
  summary: string;
  task_count: number;
  benchmark: string;
  competencies: string[];
};

export type TaskRubricCriterion = {
  criterion: string;
  description: string;
  points: number;
  critical: boolean;
};

export type Task = {
  id: number;
  hiring_need_id: number;
  title: string;
  scenario: string;
  instructions: string;
  output_format: string;
  time_limit_minutes: number;
  competencies: string[];
  rubric: TaskRubricCriterion[];
};

export type Candidate = {
  id: number;
  user_id: number;
  location: string;
  experience: string;
  role_interest: string;
};

export type CandidateAuth = { candidate: Candidate; role_track: RoleTrack };

export type SkillMapItem = { competency: string; why_it_matters: string; weight: number };

export type HiringNeed = {
  id: number;
  employer_id: number;
  role_problem_summary: string;
  skill_map: SkillMapItem[];
  tasks: Task[];
};

export type EvaluationOutput = {
  overall_score: number;
  skill_score: number;
  evidence_score: number;
  readiness_score: number;
  role_fit_score: number;
  growth_score: number;
  confidence_band: "Low" | "Medium" | "High";
  confidence_reason: string;
  recommended_action: string;
  rubric_breakdown: Array<{ criterion: string; score: number; critical: boolean }>;
  evidence_quotes: string[];
  strengths: string[];
  gaps: string[];
  improvement_plan: string[];
  human_review_required: boolean;
  ethics_note: string;
};

export type SubmissionResult = {
  submission: { id: number; answer: string };
  evaluation: { parsed_json: EvaluationOutput; safety_flags: string[] };
  passport: { id: number; strengths: string[]; gaps: string[]; evidence_preview: string };
  improvement_route: {
    visibility: string;
    reason: string;
    recommended_next_task: string;
    practice_focus: string[];
    retry_allowed: boolean;
  };
};

export type ShortlistCandidate = {
  candidate_id: number;
  candidate_name: string;
  average_score: number;
  task_count: number;
  competency_coverage: number;
  recommended_action: string;
  evidence_preview: string;
};

export type TrialTaskReview = {
  id: number;
  overlap_score: number;
  recommendation: "Keep" | "Adjust" | "Replace";
  suggested_adjustment: string;
};

export type EmployerProfile = {
  id: number;
  company_name: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`${path} failed`);
  return res.json() as Promise<T>;
}

export const api = {
  roleTracks: () => request<RoleTrack[]>("/role-tracks"),
  mvpStatus: () => request<{ sprint_scope: { ai_provider: string } }>("/mvp/status"),
  candidateAuth: (payload: { full_name: string; email: string; location: string; experience: string; role_track_id: string }) =>
    request<CandidateAuth>("/auth/candidate", { method: "POST", body: JSON.stringify(payload) }),
  employerAuth: (payload: { user: { full_name: string; email: string; role: string }; company_name: string; company_type: string; sector: string; support_channel: string[]; customer_volume: string }) =>
    request<EmployerProfile>("/auth/employer", { method: "POST", body: JSON.stringify(payload) }),
  createHiringNeed: (payload: { employer_id: number; rough_jd: string; intake_answers: Record<string, unknown> }) =>
    request<HiringNeed>("/hiring-needs", { method: "POST", body: JSON.stringify(payload) }),
  seedDemo: () => request<{ hiring_need_id: number; shortlist: ShortlistCandidate[] }>("/demo/seed", { method: "POST" }),
  resetDemo: () => request<void>("/demo/reset", { method: "POST" }),
  hiringNeed: (id: number) => request<HiringNeed>(`/hiring-needs/${id}`),
  shortlist: (id: number) => request<ShortlistCandidate[]>(`/hiring-needs/${id}/shortlist`),
  submitTask: (payload: { candidate_id: number; hiring_need_id: number; task_id: number; answer: string }) =>
    request<SubmissionResult>("/submissions", { method: "POST", body: JSON.stringify(payload) }),
  trialTaskReconcile: (payload: { hiring_need_id: number; trial_task_text: string }) =>
    request<TrialTaskReview>("/trial-task-reconcile", { method: "POST", body: JSON.stringify(payload) }),
  createFeedback: (payload: Record<string, string>) =>
    request("/prototype-feedback", { method: "POST", body: JSON.stringify(payload) }),
};