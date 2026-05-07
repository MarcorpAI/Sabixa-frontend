const defaultApiBase =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000/api/v1";

export const API_BASE_URL = defaultApiBase.replace(/\/$/, "");

export type RoleTrack = {
  id: string;
  title: string;
  role_family: string;
  summary: string;
  task_count: number;
  benchmark: string;
  competencies: string[];
};

export type Candidate = {
  id: number;
  user_id: number;
  location: string;
  experience: string;
  role_interest: string;
  visibility_status: string;
  created_at: string;
};

export type CandidateAuth = {
  candidate: Candidate;
  role_track: RoleTrack;
};

export type SkillMapItem = {
  competency: string;
  why_it_matters: string;
  weight: number;
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
  created_at: string;
};

export type IntakeAnswers = {
  why_hiring_now: string;
  company_stage: string;
  channels: string[];
  common_issues: string;
  weekly_ticket_volume: string;
  bad_hire_cost: string;
  first_30_days: string;
  tools_or_processes: string;
  priority_skills: string[];
};

export type HiringNeed = {
  id: number;
  employer_id: number;
  rough_jd: string | null;
  intake_answers: IntakeAnswers;
  role_problem_summary: string;
  skill_map: SkillMapItem[];
  criteria: {
    priority_skills?: string[];
  };
  tasks: Task[];
  created_at: string;
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
  rubric_breakdown: Array<{
    criterion: string;
    score: number;
    critical: boolean;
  }>;
  evidence_quotes: string[];
  strengths: string[];
  gaps: string[];
  improvement_plan: string[];
  human_review_required: boolean;
  ethics_note: string;
};

export type SubmissionResult = {
  submission: {
    id: number;
    candidate_id: number;
    hiring_need_id: number;
    task_id: number;
    answer: string;
    created_at: string;
  };
  evaluation: {
    id: number;
    parsed_json: EvaluationOutput;
    confidence: string;
    safety_flags: string[];
    created_at: string;
  };
  passport: {
    id: number;
    candidate_id: number;
    submission_id: number;
    public_summary: {
      headline?: string;
      summary?: string;
      readiness_label?: string;
      employer_signal?: string;
    };
    strengths: string[];
    gaps: string[];
    evidence_preview: string;
    created_at: string;
  };
  improvement_route: {
    visibility: string;
    reason: string;
    recommended_next_task: string;
    practice_focus: string[];
    retry_allowed: boolean;
  };
};

export type SkillPassport = {
  id: number;
  candidate_id: number;
  submission_id: number;
  public_summary: {
    overall_score?: number;
    confidence_band?: string;
    recommended_action?: string;
    score_breakdown?: Record<string, number>;
    human_review_required?: boolean;
    evidence_quotes?: string[];
    ethics_note?: string;
    evidence_preview?: string;
    headline?: string;
    summary?: string;
  };
  strengths: string[];
  gaps: string[];
  evidence_preview: string;
  created_at: string;
};

export type ShortlistCandidate = {
  candidate_id: number;
  candidate_name: string;
  submission_id: number;
  passport_id: number;
  overall_score: number;
  task_count: number;
  average_score: number;
  confidence_band: string;
  competency_coverage: number;
  recommended_action: string;
  evidence_preview: string;
  human_review_required: boolean;
};

export type TrialTaskReview = {
  id: number;
  hiring_need_id: number;
  overlap_score: number;
  repeated_competencies: string[];
  new_competencies: string[];
  recommendation: "Keep" | "Adjust" | "Replace";
  suggested_adjustment: string;
  created_at: string;
};

export type EmployerProfile = {
  id: number;
  user_id: number;
  company_name: string;
  company_type: string;
  sector: string;
  support_channel: string[];
  customer_volume: string;
  created_at: string;
};

export type MvpStatus = {
  product_statement: string;
  sprint_scope: Record<string, boolean | string>;
  counts: Record<string, number>;
  acceptance_criteria: Array<{
    criterion: string;
    backend_support: boolean;
    primary_endpoint: string;
  }>;
  frontend_entrypoints: string[];
};

export type DemoSeed = {
  employer_id: number;
  hiring_need_id: number;
  task_ids: number[];
  candidate_ids: number[];
  submission_ids: number[];
  passport_ids: number[];
  shortlist: ShortlistCandidate[];
  feedback_ids: number[];
};

export type PrototypeFeedback = {
  id: number;
  tester_type: "candidate" | "employer" | "trainer";
  observations: string;
  doubts: string;
  trust_signals: string;
  changes_made: string;
  created_at: string;
};

type RequestOptions = RequestInit & {
  skipJson?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipJson, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      ...rest,
    });
  } catch (error) {
    throw new Error(
      `Could not reach backend at ${API_BASE_URL}${path}. Check VITE_API_BASE_URL, backend deploy status, and CORS.`
    );
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `${path} failed with status ${response.status}`);
  }

  if (skipJson || response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  roleTracks: () => request<RoleTrack[]>("/role-tracks"),
  mvpStatus: () => request<MvpStatus>("/mvp/status"),
  listFeedback: () => request<PrototypeFeedback[]>("/prototype-feedback"),
  resetDemo: () => request<void>("/demo/reset", { method: "POST", skipJson: true }),
  seedDemo: () => request<DemoSeed>("/demo/seed", { method: "POST" }),
  hiringNeed: (id: number) => request<HiringNeed>(`/hiring-needs/${id}`),
  shortlist: (id: number) => request<ShortlistCandidate[]>(`/hiring-needs/${id}/shortlist`),
  globalShortlist: () => request<ShortlistCandidate[]>("/shortlist"),
  getPassport: (id: number) => request<SkillPassport>(`/skill-passports/${id}`),
  candidateAuth: (payload: {
    full_name: string;
    email: string;
    location: string;
    experience: string;
    role_track_id: string;
  }) => request<CandidateAuth>("/auth/candidate", { method: "POST", body: JSON.stringify(payload) }),
  employerAuth: (payload: {
    user: { full_name: string; email: string; role: "employer" };
    company_name: string;
    company_type: string;
    sector: string;
    support_channel: string[];
    customer_volume: string;
  }) => request<EmployerProfile>("/auth/employer", { method: "POST", body: JSON.stringify(payload) }),
  createHiringNeed: (payload: {
    employer_id: number;
    rough_jd: string;
    intake_answers: IntakeAnswers;
  }) => request<HiringNeed>("/hiring-needs", { method: "POST", body: JSON.stringify(payload) }),
  submitTask: (payload: {
    candidate_id: number;
    hiring_need_id: number;
    task_id: number;
    answer: string;
  }) => request<SubmissionResult>("/submissions", { method: "POST", body: JSON.stringify(payload) }),
  trialTaskReconcile: (payload: { hiring_need_id: number; trial_task_text: string }) =>
    request<TrialTaskReview>("/trial-task-reconcile", { method: "POST", body: JSON.stringify(payload) }),
  createFeedback: (payload: {
    tester_type: "candidate" | "employer" | "trainer";
    observations: string;
    doubts: string;
    trust_signals: string;
    changes_made: string;
  }) => request<PrototypeFeedback>("/prototype-feedback", { method: "POST", body: JSON.stringify(payload) }),
};
