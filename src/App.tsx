import { useEffect, useState } from "react";
import {
  api,
  setAuthToken,
  type AuthSession,
  type CandidateDashboard,
  type EmployerDashboard,
  type HiringNeed,
  type IntakeAnswers,
  type ShortlistCandidate,
  type SkillPassport,
  type SubmissionResult,
  type Task,
  type TrialTaskReview,
} from "./api";
import "./App.css";

type View = "landing" | "auth" | "candidate" | "employer" | "passport";
type Role = "candidate" | "employer";
type AuthMode = "login" | "signup";

const initialPassportId = new URLSearchParams(window.location.search).get("passport");

const intakeDefaults: IntakeAnswers = {
  why_hiring_now: "Support messages are increasing and delayed responses are causing refunds.",
  company_stage: "Growing ecommerce SME serving mobile-first customers.",
  channels: ["WhatsApp", "Email"],
  common_issues: "Delayed deliveries, refund pressure, missing updates, wrong item complaints.",
  weekly_ticket_volume: "250 to 400 messages weekly",
  bad_hire_cost: "Refund losses, angry reviews, churn, and poor operations handoff.",
  first_30_days: "Reply to WhatsApp complaints and escalate urgent refund cases correctly.",
  tools_or_processes: "WhatsApp Business, Google Sheets, courier notes, refund checklist.",
  priority_skills: ["Empathy", "Clarity", "Ownership", "Escalation judgement"],
};

const emptyAuth = {
  full_name: "",
  email: "",
  password: "",
  company_name: "",
  location: "Lagos, Nigeria",
  experience: "",
};

function App() {
  const [view, setView] = useState<View>(initialPassportId ? "passport" : "landing");
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authRole, setAuthRole] = useState<Role>("candidate");
  const [authForm, setAuthForm] = useState(emptyAuth);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [candidateDashboard, setCandidateDashboard] = useState<CandidateDashboard | null>(null);
  const [employerDashboard, setEmployerDashboard] = useState<EmployerDashboard | null>(null);
  const [hiringNeed, setHiringNeed] = useState<HiringNeed | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [latestSubmission, setLatestSubmission] = useState<SubmissionResult | null>(null);
  const [passport, setPassport] = useState<SkillPassport | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<SkillPassport | null>(null);
  const [intakeForm, setIntakeForm] = useState<IntakeAnswers>(intakeDefaults);
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);
  const [trialTaskText, setTrialTaskText] = useState("");
  const [trialReview, setTrialReview] = useState<TrialTaskReview | null>(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const currentTask = hiringNeed?.tasks[taskIndex] ?? null;
  const shareUrl = passport
    ? `${window.location.origin}${window.location.pathname}?passport=${passport.id}`
    : "";

  useEffect(() => {
    if (initialPassportId) {
      void openPassport(Number(initialPassportId), true);
      return;
    }
    void restoreSession();
    // Initial boot only: URL state and saved auth token are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restoreSession() {
    try {
      const restored = await api.me();
      setSession(restored);
      if (restored.user.role === "candidate") {
        setView("candidate");
        await loadCandidateDashboard();
      }
      if (restored.user.role === "employer") {
        setSelectedPassport(null);
        setView("employer");
        await loadEmployerDashboard();
      }
    } catch {
      setAuthToken("");
    }
  }

  async function submitAuth() {
    setError("");
    setLoading(authMode === "login" ? "Signing in" : "Creating account");
    try {
      const nextSession =
        authMode === "login"
          ? await api.login({ email: authForm.email, password: authForm.password })
          : await api.signup({
              role: authRole,
              full_name: authForm.full_name,
              email: authForm.email,
              password: authForm.password,
              company_name: authForm.company_name,
              location: authForm.location,
              experience: authForm.experience || "Entry-level customer support candidate.",
            });
      setAuthToken(nextSession.access_token);
      setSession(nextSession);
      setAuthForm(emptyAuth);
      if (nextSession.user.role === "candidate") {
        setView("candidate");
        await loadCandidateDashboard();
      } else {
        setSelectedPassport(null);
        setView("employer");
        await loadEmployerDashboard();
      }
    } catch (authError) {
      setError(readError(authError, "Could not complete auth."));
    } finally {
      setLoading("");
    }
  }

  async function loadCandidateDashboard() {
    try {
      const dashboard = await api.candidateDashboard();
      setCandidateDashboard(dashboard);
      setPassport(dashboard.latest_passport);
    } catch {
      setCandidateDashboard(null);
    }
  }

  async function loadEmployerDashboard() {
    try {
      const dashboard = await api.employerDashboard();
      setEmployerDashboard(dashboard);
      setHiringNeed(dashboard.active_hiring_need);
      setSelectedPassport(null);
      const globalRows = await api.globalShortlist();
      setShortlist(globalRows);
    } catch {
      setEmployerDashboard(null);
    }
  }

  async function createAssessmentNeed() {
    const poolEmployer = await api.employerAuth({
      user: {
        full_name: "Sabixa Assessment Pool",
        email: "assessment-pool@sabixa.africa",
        role: "employer",
      },
      company_name: "Sabixa Assessment Pool",
      company_type: "Assessment workspace",
      sector: "Customer support",
      support_channel: intakeDefaults.channels,
      customer_volume: intakeDefaults.weekly_ticket_volume,
    });
    const need = await api.createHiringNeed({
      employer_id: poolEmployer.id,
      rough_jd: "Customer support assessment pool",
      intake_answers: intakeDefaults,
    });
    setHiringNeed(need);
    setTaskIndex(0);
    setAnswer("");
    return need;
  }

  async function startAssessment() {
    setLoading("Preparing assessment");
    setError("");
    try {
      await createAssessmentNeed();
    } catch (assessmentError) {
      setError(readError(assessmentError, "Could not prepare assessment."));
    } finally {
      setLoading("");
    }
  }

  async function submitTask() {
    if (!session?.candidate) {
      setError("Login as a candidate first.");
      return;
    }
    const need = hiringNeed ?? (await createAssessmentNeed());
    const task = need.tasks[taskIndex] ?? need.tasks[0];
    if (!task || !answer.trim()) {
      setError("Write your response before submitting.");
      return;
    }
    setLoading("Scoring response");
    setError("");
    try {
      const result = await api.submitTask({
        candidate_id: session.candidate.id,
        hiring_need_id: need.id,
        task_id: task.id,
        answer: answer.trim(),
      });
      const nextPassport = await api.getPassport(result.passport.id);
      setLatestSubmission(result);
      setPassport(nextPassport);
      await loadCandidateDashboard();
    } catch (submissionError) {
      setError(readError(submissionError, "Could not score this task."));
    } finally {
      setLoading("");
    }
  }

  async function createHiringNeed() {
    if (!session?.employer) {
      setError("Login as an employer first.");
      return;
    }
    setLoading("Generating task pack");
    setError("");
    try {
      const need = await api.createHiringNeed({
        employer_id: session.employer.id,
        rough_jd: `Customer support role for ${session.employer.company_name}`,
        intake_answers: intakeForm,
      });
      setHiringNeed(need);
      setEmployerDashboard((current) =>
        current
          ? { ...current, active_hiring_need: need, hiring_needs: [need, ...current.hiring_needs] }
          : current
      );
      setShortlist(await api.globalShortlist());
    } catch (needError) {
      setError(readError(needError, "Could not create hiring need."));
    } finally {
      setLoading("");
    }
  }

  async function openPassport(passportId: number, publicView = false) {
    setLoading("Opening passport");
    setError("");
    try {
      const nextPassport = await api.getPassport(passportId);
      setSelectedPassport(nextPassport);
      if (publicView) {
        setPassport(nextPassport);
      }
    } catch (passportError) {
      setError(readError(passportError, "Could not open passport."));
    } finally {
      setLoading("");
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy link.");
    }
  }

  async function reconcileTrialTask() {
    if (!hiringNeed || !trialTaskText.trim()) {
      setError("Create a hiring need and paste a trial task first.");
      return;
    }
    setLoading("Checking overlap");
    setError("");
    try {
      const review = await api.trialTaskReconcile({
        hiring_need_id: hiringNeed.id,
        trial_task_text: trialTaskText,
      });
      setTrialReview(review);
    } catch (trialError) {
      setError(readError(trialError, "Could not review trial task."));
    } finally {
      setLoading("");
    }
  }

  function logout() {
    setAuthToken("");
    setSession(null);
    setCandidateDashboard(null);
    setEmployerDashboard(null);
    setHiringNeed(null);
    setPassport(null);
    setSelectedPassport(null);
    setView("landing");
    window.history.replaceState({}, "", window.location.pathname);
  }

  return (
    <div className="app-shell">
      <div className="toast-stack" aria-live="polite">
        {loading ? <Toast tone="neutral" message={loading} /> : null}
        {error ? <Toast tone="error" message={error} /> : null}
      </div>
      <header className="topbar">
        <button className="brand" onClick={() => setView(session ? (session.user.role as View) : "landing")}>
          <img src="/sabixalogo.svg" alt="Sabixa" />
        </button>
        <nav>
          <button onClick={() => openAuth("candidate")}>Candidate</button>
          <button onClick={() => openAuth("employer")}>Employer</button>
          {session ? <button onClick={logout}>Logout</button> : null}
        </nav>
      </header>

      {view === "landing" ? <Landing onStart={openAuth} /> : null}
      {view === "auth" ? (
        <AuthView
          mode={authMode}
          role={authRole}
          form={authForm}
          onMode={setAuthMode}
          onRole={setAuthRole}
          onChange={setAuthForm}
          onSubmit={submitAuth}
        />
      ) : null}
      {view === "candidate" ? (
        <CandidateView
          dashboard={candidateDashboard}
          hiringNeed={hiringNeed}
          currentTask={currentTask}
          taskIndex={taskIndex}
          answer={answer}
          latestSubmission={latestSubmission}
          passport={passport}
          shareUrl={shareUrl}
          copied={copied}
          onStart={startAssessment}
          onAnswer={setAnswer}
          onSubmit={submitTask}
          onNextTask={() => {
            setTaskIndex((current) => current + 1);
            setAnswer("");
            setLatestSubmission(null);
          }}
          onCopy={copyShareLink}
        />
      ) : null}
      {view === "employer" ? (
        <EmployerView
          dashboard={employerDashboard}
          hiringNeed={hiringNeed}
          intakeForm={intakeForm}
          shortlist={shortlist}
          selectedPassport={selectedPassport}
          trialTaskText={trialTaskText}
          trialReview={trialReview}
          onIntake={setIntakeForm}
          onCreateNeed={createHiringNeed}
          onOpenPassport={openPassport}
          onTrialText={setTrialTaskText}
          onReconcile={reconcileTrialTask}
        />
      ) : null}
      {view === "passport" ? (
        <main className="page single">
          <PassportCard passport={passport} publicView />
        </main>
      ) : null}
    </div>
  );

  function openAuth(role: Role) {
    if (session?.user.role === role) {
      if (role === "employer") {
        setSelectedPassport(null);
      }
      setView(role);
      return;
    }
    setAuthRole(role);
    setAuthMode("signup");
    setView("auth");
  }
}

function Landing({ onStart }: { onStart: (role: Role) => void }) {
  return (
    <main className="landing">
      <section className="hero landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">AI proof-of-skill hiring</span>
          <h1>Customer support hiring, scored by real work.</h1>
          <p>
            Sabixa turns short support tasks into skill passports, ranked evidence and practical
            improvement routes for entry-level talent.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => onStart("candidate")}>Start as candidate</button>
            <button onClick={() => onStart("employer")}>Hire with Sabixa</button>
          </div>
        </div>
      </section>
      <section className="landing-proof">
        <span>3-task support assessment</span>
        <span>Rubric-based AI scoring</span>
        <span>Shareable skill passport</span>
        <span>Employer shortlist evidence</span>
      </section>
    </main>
  );
}

function AuthView({
  mode,
  role,
  form,
  onMode,
  onRole,
  onChange,
  onSubmit,
}: {
  mode: AuthMode;
  role: Role;
  form: typeof emptyAuth;
  onMode: (mode: AuthMode) => void;
  onRole: (role: Role) => void;
  onChange: (form: typeof emptyAuth) => void;
  onSubmit: () => void;
}) {
  return (
    <main className="page single">
      <section className="panel auth-panel">
        <div>
          <span className="eyebrow">{role} account</span>
          <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>
        </div>
        <div className="segmented">
          <button className={role === "candidate" ? "active" : ""} onClick={() => onRole("candidate")}>Candidate</button>
          <button className={role === "employer" ? "active" : ""} onClick={() => onRole("employer")}>Employer</button>
        </div>
        {mode === "signup" ? (
          <label>
            Full name
            <input value={form.full_name} onChange={(event) => onChange({ ...form, full_name: event.target.value })} />
          </label>
        ) : null}
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={(event) => onChange({ ...form, password: event.target.value })} />
        </label>
        {mode === "signup" && role === "employer" ? (
          <label>
            Company
            <input value={form.company_name} onChange={(event) => onChange({ ...form, company_name: event.target.value })} />
          </label>
        ) : null}
        {mode === "signup" && role === "candidate" ? (
          <label>
            Experience
            <textarea rows={3} value={form.experience} onChange={(event) => onChange({ ...form, experience: event.target.value })} />
          </label>
        ) : null}
        <button className="primary" onClick={onSubmit}>{mode === "login" ? "Log in" : "Sign up"}</button>
        <button className="text-button" onClick={() => onMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </section>
    </main>
  );
}

function CandidateView({
  dashboard,
  hiringNeed,
  currentTask,
  taskIndex,
  answer,
  latestSubmission,
  passport,
  shareUrl,
  copied,
  onStart,
  onAnswer,
  onSubmit,
  onNextTask,
  onCopy,
}: {
  dashboard: CandidateDashboard | null;
  hiringNeed: HiringNeed | null;
  currentTask: Task | null;
  taskIndex: number;
  answer: string;
  latestSubmission: SubmissionResult | null;
  passport: SkillPassport | null;
  shareUrl: string;
  copied: boolean;
  onStart: () => void;
  onAnswer: (answer: string) => void;
  onSubmit: () => void;
  onNextTask: () => void;
  onCopy: () => void;
}) {
  const score = latestSubmission?.evaluation.parsed_json;
  return (
    <main className="page dashboard">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Candidate dashboard</span>
          <h1>Build a support skill passport.</h1>
        </div>
        <button className="primary" onClick={onStart}>{hiringNeed ? "Restart assessment" : "Start assessment"}</button>
      </section>
      <section className="metric-row">
        <Metric value={dashboard?.readiness.task_count ?? 0} label="tasks completed" />
        <Metric value={dashboard?.readiness.average_score ?? "N/A"} label="average score" />
        <Metric value={dashboard?.readiness.readiness_label ?? "No evidence"} label="readiness" />
      </section>
      <section className="two-column">
        <div className="panel">
          <span className="eyebrow">Assessment task</span>
          {currentTask ? (
            <TaskComposer task={currentTask} taskIndex={taskIndex} answer={answer} onAnswer={onAnswer} onSubmit={onSubmit} />
          ) : (
            <EmptyState title="No active task" body="Start the assessment to generate the customer support task pack." />
          )}
          {score ? (
            <div className="score-block">
              <strong>{score.overall_score}/100</strong>
              <span>{score.recommended_action}</span>
              <p>{score.confidence_reason}</p>
              <ReviewList title="Why this score" items={[...score.strengths, ...score.gaps]} />
              {hiringNeed && taskIndex + 1 < hiringNeed.tasks.length ? <button onClick={onNextTask}>Next task</button> : null}
            </div>
          ) : null}
        </div>
        <div className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Passport</span>
              <h2>Shareable evidence card</h2>
            </div>
            {passport ? <button onClick={onCopy}>{copied ? "Copied" : "Copy link"}</button> : null}
          </div>
          <PassportCard passport={passport} />
          {shareUrl ? <input className="share-input" readOnly value={shareUrl} /> : null}
        </div>
      </section>
    </main>
  );
}

function EmployerView({
  dashboard,
  hiringNeed,
  intakeForm,
  shortlist,
  selectedPassport,
  trialTaskText,
  trialReview,
  onIntake,
  onCreateNeed,
  onOpenPassport,
  onTrialText,
  onReconcile,
}: {
  dashboard: EmployerDashboard | null;
  hiringNeed: HiringNeed | null;
  intakeForm: IntakeAnswers;
  shortlist: ShortlistCandidate[];
  selectedPassport: SkillPassport | null;
  trialTaskText: string;
  trialReview: TrialTaskReview | null;
  onIntake: (answers: IntakeAnswers) => void;
  onCreateNeed: () => void;
  onOpenPassport: (passportId: number) => void;
  onTrialText: (value: string) => void;
  onReconcile: () => void;
}) {
  return (
    <main className="page dashboard">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Employer dashboard</span>
          <h1>Candidate evidence for {dashboard?.employer.company_name ?? "your team"}.</h1>
        </div>
        <button className="primary" onClick={onCreateNeed}>Generate task pack</button>
      </section>
      <section className="employer-grid">
        <div className="panel candidate-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Candidates</span>
              <h2>Ranked by scored work samples</h2>
            </div>
            <span className="count-label">{shortlist.length} candidates</span>
          </div>
          <div className="candidate-list">
            {shortlist.length === 0 ? (
              <EmptyState
                title="No scored candidates yet"
                body="When candidates complete tasks, they appear here with score, confidence and passport evidence."
              />
            ) : null}
            {shortlist.map((candidate) => (
              <button className="candidate-row" key={candidate.passport_id} onClick={() => onOpenPassport(candidate.passport_id)}>
                <span>
                  <strong>{candidate.candidate_name}</strong>
                  <small>
                    {candidate.task_count} task{candidate.task_count === 1 ? "" : "s"} · {candidate.confidence_band} confidence · {candidate.recommended_action}
                  </small>
                </span>
                <b>{candidate.average_score}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="panel passport-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Candidate passport</span>
              <h2>Profile and evidence</h2>
            </div>
          </div>
          {selectedPassport ? (
            <PassportCard passport={selectedPassport} />
          ) : (
            <EmptyState
              title="Select a candidate"
              body="Click a candidate from the list to review their scorecard, strengths, gaps and submitted evidence."
            />
          )}
        </div>
        <div className="panel">
          <span className="eyebrow">Hiring need</span>
          <IntakeForm form={intakeForm} onChange={onIntake} />
        </div>
        <div className="panel">
          <span className="eyebrow">Assessment pack</span>
          {hiringNeed ? <HiringNeedSummary need={hiringNeed} /> : <EmptyState title="No task pack yet" body="Generate a task pack from the hiring need above." />}
        </div>
        <div className="panel wide">
          <span className="eyebrow">Trial task overlap</span>
          <textarea rows={4} value={trialTaskText} onChange={(event) => onTrialText(event.target.value)} placeholder="Paste the company-specific trial task..." />
          <button onClick={onReconcile}>Check overlap</button>
          {trialReview ? (
            <div className="trial-result">
              <strong>{trialReview.overlap_score}% overlap</strong>
              <span>{trialReview.recommendation}</span>
              <p>{trialReview.suggested_adjustment}</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function TaskComposer({ task, taskIndex, answer, onAnswer, onSubmit }: { task: Task; taskIndex: number; answer: string; onAnswer: (answer: string) => void; onSubmit: () => void }) {
  return (
    <div className="task-composer">
      <div className="section-head">
        <div>
          <h2>{task.title}</h2>
          <p>{task.scenario}</p>
        </div>
        <span className="badge">Task {taskIndex + 1}</span>
      </div>
      <p className="muted">{task.instructions}</p>
      <div className="rubric">
        {task.rubric.map((item) => <span key={item.criterion}>{item.criterion}</span>)}
      </div>
      <textarea rows={9} value={answer} onChange={(event) => onAnswer(event.target.value)} placeholder="Write the exact response or ticket note you would send..." />
      <button className="primary" onClick={onSubmit}>Submit for AI scoring</button>
    </div>
  );
}

function IntakeForm({ form, onChange }: { form: IntakeAnswers; onChange: (answers: IntakeAnswers) => void }) {
  return (
    <div className="form-grid">
      <label>Why hiring now?<textarea rows={2} value={form.why_hiring_now} onChange={(event) => onChange({ ...form, why_hiring_now: event.target.value })} /></label>
      <label>Common issues<textarea rows={2} value={form.common_issues} onChange={(event) => onChange({ ...form, common_issues: event.target.value })} /></label>
      <label>First 30 days<textarea rows={2} value={form.first_30_days} onChange={(event) => onChange({ ...form, first_30_days: event.target.value })} /></label>
      <label>Weekly volume<input value={form.weekly_ticket_volume} onChange={(event) => onChange({ ...form, weekly_ticket_volume: event.target.value })} /></label>
    </div>
  );
}

function HiringNeedSummary({ need }: { need: HiringNeed }) {
  return (
    <div className="need-summary">
      <p>{need.role_problem_summary}</p>
      <div className="rubric">
        {need.skill_map.slice(0, 6).map((skill) => <span key={skill.competency}>{skill.competency}</span>)}
      </div>
      {need.tasks.map((task) => (
        <div className="task-row" key={task.id}>
          <strong>{task.title}</strong>
          <small>{task.competencies.join(", ")}</small>
        </div>
      ))}
    </div>
  );
}

function PassportCard({ passport, publicView = false }: { passport: SkillPassport | null; publicView?: boolean }) {
  if (!passport) {
    return <EmptyState title="No passport selected" body="A scored task will generate the passport card." />;
  }
  const summary = passport.public_summary ?? {};
  const breakdown = summary.score_breakdown ?? {};
  return (
    <article className={publicView ? "passport public" : "passport"}>
      <div className="passport-top">
        <div>
          <span className="eyebrow">Skill passport #{passport.id}</span>
          <h2>{summary.headline ?? "Customer support skill passport"}</h2>
          <p>{summary.summary ?? "Generated from customer support task evidence."}</p>
        </div>
        <strong>{summary.overall_score ?? "N/A"}</strong>
      </div>
      <div className="metric-row compact">
        <Metric value={summary.confidence_band ?? "N/A"} label="confidence" />
        <Metric value={summary.recommended_action ?? "Review"} label="action" />
        <Metric value={summary.human_review_required ? "Yes" : "No"} label="human review" />
      </div>
      {Object.keys(breakdown).length ? (
        <div className="breakdown">
          {Object.entries(breakdown).map(([label, value]) => <Metric key={label} value={value} label={formatLabel(label)} />)}
        </div>
      ) : null}
      <div className="passport-columns">
        <ReviewList title="Strengths" items={passport.strengths} />
        <ReviewList title="Gaps" items={passport.gaps} />
      </div>
      <ReviewList title="Evidence quotes" items={summary.evidence_quotes ?? []} />
      <div className="evidence">
        <strong>Submitted evidence</strong>
        <p>{passport.evidence_preview}</p>
      </div>
      {summary.ethics_note ? <p className="ethics">{summary.ethics_note}</p> : null}
    </article>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Toast({ tone, message }: { tone: "neutral" | "error"; message: string }) {
  return <div className={`toast ${tone}`}>{message}</div>;
}

function ReviewList({ title, items }: { title: string; items: Array<string | Record<string, unknown>> }) {
  if (!items.length) return null;
  return (
    <div className="review-list">
      <h3>{title}</h3>
      <ul>{items.map((item) => {
        const text = formatReviewItem(item);
        return <li key={text}>{text}</li>;
      })}</ul>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatReviewItem(item: string | Record<string, unknown>) {
  if (typeof item === "string") {
    return item;
  }
  const action = typeof item.action === "string" ? item.action : "";
  const description = typeof item.description === "string" ? item.description : "";
  const competency = typeof item.competency === "string" ? item.competency : "";
  const evidence = typeof item.evidence === "string" ? item.evidence : "";
  const gap = typeof item.gap === "string" ? item.gap : "";
  return [competency || gap, description || action, evidence].filter(Boolean).join(": ");
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default App;
