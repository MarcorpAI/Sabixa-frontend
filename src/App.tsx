import { startTransition, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  API_BASE_URL,
  api,
  type Candidate,
  type HiringNeed,
  type IntakeAnswers,
  type MvpStatus,
  type PrototypeFeedback,
  type RoleTrack,
  type ShortlistCandidate,
  type SubmissionResult,
  type TrialTaskReview,
  type EmployerProfile,
} from "./api";
import "./App.css";

type View = "overview" | "employer" | "candidate" | "evidence" | "feedback";

const channels = ["WhatsApp", "Email", "Calls", "Live chat", "Social DMs"];
const prioritySkills = [
  "Empathy",
  "Clarity",
  "Escalation judgement",
  "Speed",
  "Accuracy",
  "Ownership",
  "Follow-up quality",
];

const initialEmployerForm = {
  full_name: "Ada Nwosu",
  email: "ada@sabixa.africa",
  company_name: "Kori Market",
  company_type: "Seed-stage ecommerce startup",
  sector: "Retail ecommerce",
  support_channel: ["WhatsApp", "Email"],
  customer_volume: "250 to 400 messages weekly",
};

const initialIntake: IntakeAnswers = {
  why_hiring_now:
    "Support queues are rising after a product push and delayed replies are causing refunds.",
  company_stage: "Growth-stage African ecommerce business serving high-volume mobile-first buyers.",
  channels: ["WhatsApp", "Email"],
  common_issues: "Delayed deliveries, refund pressure, missing updates, and wrong item complaints.",
  weekly_ticket_volume: "250 to 400 messages weekly",
  bad_hire_cost:
    "A weak hire increases refund losses, churn, angry public reviews, and escalation backlog.",
  first_30_days:
    "Own first-response complaints, resolve simple delivery issues, and escalate urgent refunds correctly.",
  tools_or_processes: "WhatsApp Business, Google Sheets, internal refund checklist, courier handoff notes.",
  priority_skills: ["Empathy", "Clarity", "Ownership", "Escalation judgement"],
};

const initialCandidateForm = {
  full_name: "Zainab Afolayan",
  email: "zainab@sabixa.africa",
  location: "Lagos, Nigeria",
  experience: "Handled customer complaints for a campus logistics business and a small online store.",
};

const initialFeedbackForm = {
  tester_type: "candidate" as const,
  observations: "",
  doubts: "",
  trust_signals: "",
  changes_made: "",
};

function App() {
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [status, setStatus] = useState<MvpStatus | null>(null);
  const [tracks, setTracks] = useState<RoleTrack[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<PrototypeFeedback[]>([]);
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [hiringNeed, setHiringNeed] = useState<HiringNeed | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [candidateAnswer, setCandidateAnswer] = useState("");
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [trialTaskText, setTrialTaskText] = useState(
    "Write a follow-up task for a candidate handling a public refund complaint after an unresolved delivery delay."
  );
  const [trialReview, setTrialReview] = useState<TrialTaskReview | null>(null);
  const [employerForm, setEmployerForm] = useState(initialEmployerForm);
  const [intakeForm, setIntakeForm] = useState<IntakeAnswers>(initialIntake);
  const [candidateForm, setCandidateForm] = useState(initialCandidateForm);
  const [feedbackForm, setFeedbackForm] = useState(initialFeedbackForm);
  const currentTrack = tracks[0] ?? null;
  const selectedTask = hiringNeed?.tasks.find((task) => task.id === selectedTaskId) ?? null;

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedTaskId && hiringNeed?.tasks[0]) {
      setSelectedTaskId(hiringNeed.tasks[0].id);
    }
  }, [hiringNeed, selectedTaskId]);

  async function loadBaseData() {
    try {
      const [nextStatus, nextTracks, nextFeedback] = await Promise.all([
        api.mvpStatus(),
        api.roleTracks(),
        api.listFeedback().catch(() => []),
      ]);
      setStatus(nextStatus);
      setTracks(nextTracks);
      setFeedbackItems(nextFeedback);
    } catch (loadError) {
      setError(readError(loadError, "Failed to load backend status."));
    }
  }

  async function startDemoWorkspace() {
    setBusy("Seeding demo workspace");
    setError("");
    try {
      const demo = await api.seedDemo();
      const [nextNeed, nextShortlist, nextFeedback] = await Promise.all([
        api.hiringNeed(demo.hiring_need_id),
        api.shortlist(demo.hiring_need_id),
        api.listFeedback(),
      ]);
      setEmployer((current) =>
        current ?? {
          id: demo.employer_id,
          user_id: 0,
          company_name: "Demo employer",
          company_type: "Sprint demo",
          sector: "Customer support hiring",
          support_channel: ["WhatsApp", "Email"],
          customer_volume: "Seeded dataset",
          created_at: new Date().toISOString(),
        }
      );
      setHiringNeed(nextNeed);
      setShortlist(nextShortlist);
      setFeedbackItems(nextFeedback);
      setSubmissionResult(null);
      setCandidate(null);
      setCandidateAnswer("");
      setTrialReview(null);
      startTransition(() => setView("employer"));
    } catch (seedError) {
      setError(readError(seedError, "Unable to create demo data."));
    } finally {
      setBusy("");
    }
  }

  async function handleEmployerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("Creating employer hiring need");
    setError("");
    try {
      const nextEmployer = await api.employerAuth({
        user: {
          full_name: employerForm.full_name,
          email: employerForm.email,
          role: "employer",
        },
        company_name: employerForm.company_name,
        company_type: employerForm.company_type,
        sector: employerForm.sector,
        support_channel: employerForm.support_channel,
        customer_volume: employerForm.customer_volume,
      });
      const nextNeed = await api.createHiringNeed({
        employer_id: nextEmployer.id,
        rough_jd:
          "Entry-level customer support hire for mobile-first ecommerce complaints, refunds, and handoff summaries.",
        intake_answers: intakeForm,
      });
      const nextShortlist = await api.shortlist(nextNeed.id);
      setEmployer(nextEmployer);
      setHiringNeed(nextNeed);
      setShortlist(nextShortlist);
      setSubmissionResult(null);
      setTrialReview(null);
      startTransition(() => setView("candidate"));
    } catch (submitError) {
      setError(readError(submitError, "Failed to create the employer flow."));
    } finally {
      setBusy("");
    }
  }

  async function handleCandidateStart() {
    if (!currentTrack) {
      setError("Role tracks are still loading.");
      return;
    }
    if (!hiringNeed) {
      setError("Create or seed a hiring need first.");
      return;
    }
    setBusy("Starting candidate track");
    setError("");
    try {
      const auth = await api.candidateAuth({
        ...candidateForm,
        email: uniqueEmail(candidateForm.email),
        role_track_id: currentTrack.id,
      });
      setCandidate(auth.candidate);
      setSubmissionResult(null);
    } catch (candidateError) {
      setError(readError(candidateError, "Could not create the candidate profile."));
    } finally {
      setBusy("");
    }
  }

  async function handleSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidate || !hiringNeed || !selectedTask) {
      setError("Start candidate onboarding and pick a task first.");
      return;
    }
    if (!candidateAnswer.trim()) {
      setError("Write a candidate response before scoring.");
      return;
    }
    setBusy("Scoring candidate work sample");
    setError("");
    try {
      const result = await api.submitTask({
        candidate_id: candidate.id,
        hiring_need_id: hiringNeed.id,
        task_id: selectedTask.id,
        answer: candidateAnswer.trim(),
      });
      const nextShortlist = await api.shortlist(hiringNeed.id);
      setSubmissionResult(result);
      setShortlist(nextShortlist);
      startTransition(() => setView("evidence"));
    } catch (submissionError) {
      setError(readError(submissionError, "Submission failed."));
    } finally {
      setBusy("");
    }
  }

  async function handleTrialCheck() {
    if (!hiringNeed) {
      setError("Create or seed a hiring need first.");
      return;
    }
    setBusy("Checking trial-task overlap");
    setError("");
    try {
      const review = await api.trialTaskReconcile({
        hiring_need_id: hiringNeed.id,
        trial_task_text: trialTaskText,
      });
      setTrialReview(review);
    } catch (reviewError) {
      setError(readError(reviewError, "Overlap check failed."));
    } finally {
      setBusy("");
    }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("Saving feedback");
    setError("");
    try {
      await api.createFeedback(feedbackForm);
      const nextFeedback = await api.listFeedback();
      setFeedbackItems(nextFeedback);
      setFeedbackForm(initialFeedbackForm);
    } catch (feedbackError) {
      setError(readError(feedbackError, "Could not save feedback."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="topbar">
        <div>
          <p className="eyebrow">Sabixa Sprint 2 MVP</p>
          <h1>AI proof-of-skill frontend for customer-support hiring.</h1>
        </div>
        <div className="topbar-meta">
          <span className="chip chip-outline">Frontend repo</span>
          <span className="chip">{status?.sprint_scope.ai_provider ?? "checking AI"}</span>
        </div>
      </header>

      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">
            Employer need -&gt; task evidence -&gt; shortlist confidence
          </p>
          <h2>
            A deployable frontend that mirrors the backend loop already built for the Sabixa MVP.
          </h2>
          <p className="hero-text">
            This interface runs the exact Sprint 2 product chain from the PRD: employer intake,
            AI-generated skills and task pack, candidate work sample, scoring, passport, shortlist,
            improvement route, and trial-task reconciliation.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={startDemoWorkspace}>
              Seed demo workspace
            </button>
            <button
              className="button button-secondary"
              onClick={() => startTransition(() => setView("employer"))}
            >
              Build a fresh hiring need
            </button>
          </div>
        </div>
        <div className="hero-aside">
          <div className="stat-card">
            <span>Backend</span>
            <strong>{API_BASE_URL}</strong>
          </div>
          <div className="stat-grid">
            <article>
              <span>Users</span>
              <strong>{status?.counts.users ?? 0}</strong>
            </article>
            <article>
              <span>Hiring needs</span>
              <strong>{status?.counts.hiring_needs ?? 0}</strong>
            </article>
            <article>
              <span>Submissions</span>
              <strong>{status?.counts.submissions ?? 0}</strong>
            </article>
            <article>
              <span>Passports</span>
              <strong>{status?.counts.skill_passports ?? 0}</strong>
            </article>
          </div>
        </div>
      </section>

      <nav className="view-tabs" aria-label="Workspace sections">
        {[
          ["overview", "Overview"],
          ["employer", "Employer"],
          ["candidate", "Candidate"],
          ["evidence", "Evidence"],
          ["feedback", "Feedback"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`tab ${view === value ? "tab-active" : ""}`}
            onClick={() => startTransition(() => setView(value as View))}
          >
            {label}
          </button>
        ))}
      </nav>

      {busy ? <div className="notice notice-busy">{busy}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}

      <main className="workspace">
        {view === "overview" ? (
          <section className="overview-grid">
            <article className="panel panel-tall">
              <div className="panel-heading">
                <p className="eyebrow">Product statement</p>
                <h3>MVP coverage from the live backend</h3>
              </div>
              <p className="lead">{status?.product_statement}</p>
              <div className="criteria-list">
                {status?.acceptance_criteria.map((criterion) => (
                  <div className="criterion-row" key={criterion.criterion}>
                    <div>
                      <strong>{criterion.criterion}</strong>
                      <p>{criterion.primary_endpoint}</p>
                    </div>
                    <span className="chip chip-ok">
                      {criterion.backend_support ? "supported" : "missing"}
                    </span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Role track</p>
                <h3>{currentTrack?.title ?? "Loading track"}</h3>
              </div>
              <p>{currentTrack?.summary}</p>
              <div className="pill-row">
                {currentTrack?.competencies.map((competency) => (
                  <span className="pill" key={competency}>
                    {competency}
                  </span>
                ))}
              </div>
              <p className="meta-copy">
                Benchmark: {currentTrack?.benchmark ?? "Waiting on backend"}.
              </p>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Frontend entrypoints</p>
                <h3>Pages represented in this build</h3>
              </div>
              <ul className="route-list">
                {status?.frontend_entrypoints.map((entrypoint) => (
                  <li key={entrypoint}>{entrypoint}</li>
                ))}
              </ul>
            </article>
          </section>
        ) : null}

        {view === "employer" ? (
          <section className="stack">
            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Employer intake</p>
                <h3>Create a hiring need from the backend schema</h3>
              </div>
              <form className="form-grid" onSubmit={handleEmployerSubmit}>
                <label>
                  Employer name
                  <input
                    value={employerForm.full_name}
                    onChange={(event) =>
                      setEmployerForm({ ...employerForm, full_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Work email
                  <input
                    value={employerForm.email}
                    onChange={(event) =>
                      setEmployerForm({ ...employerForm, email: event.target.value })
                    }
                  />
                </label>
                <label>
                  Company name
                  <input
                    value={employerForm.company_name}
                    onChange={(event) =>
                      setEmployerForm({ ...employerForm, company_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Company type
                  <input
                    value={employerForm.company_type}
                    onChange={(event) =>
                      setEmployerForm({ ...employerForm, company_type: event.target.value })
                    }
                  />
                </label>
                <label>
                  Sector
                  <input
                    value={employerForm.sector}
                    onChange={(event) =>
                      setEmployerForm({ ...employerForm, sector: event.target.value })
                    }
                  />
                </label>
                <label>
                  Weekly volume
                  <input
                    value={employerForm.customer_volume}
                    onChange={(event) =>
                      setEmployerForm({ ...employerForm, customer_volume: event.target.value })
                    }
                  />
                </label>
                <fieldset className="full-span">
                  <legend>Support channels</legend>
                  <div className="check-row">
                    {channels.map((channel) => (
                      <label className="check-chip" key={channel}>
                        <input
                          type="checkbox"
                          checked={employerForm.support_channel.includes(channel)}
                          onChange={() =>
                            setEmployerForm({
                              ...employerForm,
                              support_channel: toggleValue(
                                employerForm.support_channel,
                                channel
                              ),
                            })
                          }
                        />
                        <span>{channel}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="full-span">
                  Why are you hiring now?
                  <textarea
                    rows={3}
                    value={intakeForm.why_hiring_now}
                    onChange={(event) =>
                      setIntakeForm({ ...intakeForm, why_hiring_now: event.target.value })
                    }
                  />
                </label>
                <label>
                  Company stage
                  <textarea
                    rows={3}
                    value={intakeForm.company_stage}
                    onChange={(event) =>
                      setIntakeForm({ ...intakeForm, company_stage: event.target.value })
                    }
                  />
                </label>
                <label>
                  Common issues
                  <textarea
                    rows={3}
                    value={intakeForm.common_issues}
                    onChange={(event) =>
                      setIntakeForm({ ...intakeForm, common_issues: event.target.value })
                    }
                  />
                </label>
                <label>
                  First 30 days
                  <textarea
                    rows={3}
                    value={intakeForm.first_30_days}
                    onChange={(event) =>
                      setIntakeForm({ ...intakeForm, first_30_days: event.target.value })
                    }
                  />
                </label>
                <label>
                  Bad hire cost
                  <textarea
                    rows={3}
                    value={intakeForm.bad_hire_cost}
                    onChange={(event) =>
                      setIntakeForm({ ...intakeForm, bad_hire_cost: event.target.value })
                    }
                  />
                </label>
                <label>
                  Tools or processes
                  <textarea
                    rows={3}
                    value={intakeForm.tools_or_processes}
                    onChange={(event) =>
                      setIntakeForm({ ...intakeForm, tools_or_processes: event.target.value })
                    }
                  />
                </label>
                <label>
                  Ticket volume
                  <input
                    value={intakeForm.weekly_ticket_volume}
                    onChange={(event) =>
                      setIntakeForm({
                        ...intakeForm,
                        weekly_ticket_volume: event.target.value,
                      })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Priority skills</legend>
                  <div className="check-row">
                    {prioritySkills.map((skill) => (
                      <label className="check-chip" key={skill}>
                        <input
                          type="checkbox"
                          checked={intakeForm.priority_skills.includes(skill)}
                          onChange={() =>
                            setIntakeForm({
                              ...intakeForm,
                              priority_skills: toggleValue(intakeForm.priority_skills, skill),
                            })
                          }
                        />
                        <span>{skill}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <button className="button button-primary full-span" type="submit">
                  Generate skill map and task pack
                </button>
              </form>
            </article>

            {hiringNeed ? (
              <article className="panel">
                <div className="panel-heading">
                  <p className="eyebrow">Generated employer view</p>
                  <h3>{employer?.company_name ?? "Employer"} hiring board</h3>
                </div>
                <p className="lead">{hiringNeed.role_problem_summary}</p>
                <div className="skill-grid">
                  {hiringNeed.skill_map.map((skill) => (
                    <div className="skill-card" key={skill.competency}>
                      <div className="skill-header">
                        <strong>{skill.competency}</strong>
                        <span>{skill.weight}%</span>
                      </div>
                      <p>{skill.why_it_matters}</p>
                    </div>
                  ))}
                </div>
                <div className="task-pack">
                  {hiringNeed.tasks.map((task, index) => (
                    <article className="task-card" key={task.id}>
                      <p className="eyebrow">Task {index + 1}</p>
                      <h4>{task.title}</h4>
                      <p>{task.scenario}</p>
                      <div className="pill-row">
                        {task.competencies.map((competency) => (
                          <span className="pill" key={competency}>
                            {competency}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {view === "candidate" ? (
          <section className="stack">
            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Candidate onboarding</p>
                <h3>Start the assessment track</h3>
              </div>
              <div className="candidate-toolbar">
                <div>
                  <strong>{currentTrack?.title ?? "Loading track"}</strong>
                  <p>{currentTrack?.summary}</p>
                </div>
                <button className="button button-secondary" onClick={handleCandidateStart}>
                  {candidate ? "Create another candidate" : "Start candidate"}
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Candidate name
                  <input
                    value={candidateForm.full_name}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, full_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Candidate email
                  <input
                    value={candidateForm.email}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, email: event.target.value })
                    }
                  />
                </label>
                <label>
                  Location
                  <input
                    value={candidateForm.location}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, location: event.target.value })
                    }
                  />
                </label>
                <label>
                  Experience snapshot
                  <textarea
                    rows={3}
                    value={candidateForm.experience}
                    onChange={(event) =>
                      setCandidateForm({ ...candidateForm, experience: event.target.value })
                    }
                  />
                </label>
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Live work sample</p>
                <h3>Show the rubric before submission</h3>
              </div>
              {hiringNeed ? (
                <form className="stack" onSubmit={handleSubmission}>
                  <div className="task-selector">
                    {hiringNeed.tasks.map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        className={`task-switch ${selectedTaskId === task.id ? "task-switch-active" : ""}`}
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setSubmissionResult(null);
                        }}
                      >
                        <span>{task.title}</span>
                        <small>{task.time_limit_minutes} mins</small>
                      </button>
                    ))}
                  </div>
                  {selectedTask ? (
                    <>
                      <div className="task-brief">
                        <h4>{selectedTask.title}</h4>
                        <p>{selectedTask.scenario}</p>
                        <p className="meta-copy">{selectedTask.instructions}</p>
                      </div>
                      <div className="rubric-grid">
                        {selectedTask.rubric.map((item) => (
                          <div className="rubric-card" key={item.criterion}>
                            <strong>{item.criterion}</strong>
                            <p>{item.description}</p>
                            <span>
                              {item.points} pts {item.critical ? "critical" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                      <label>
                        Candidate answer
                        <textarea
                          rows={9}
                          value={candidateAnswer}
                          onChange={(event) => setCandidateAnswer(event.target.value)}
                          placeholder="Write the customer response or internal summary here..."
                        />
                      </label>
                      <button className="button button-primary" type="submit">
                        Score submission
                      </button>
                    </>
                  ) : null}
                </form>
              ) : (
                <p className="empty-state">
                  No hiring need yet. Seed demo data or create a hiring need from the employer tab.
                </p>
              )}
            </article>
          </section>
        ) : null}

        {view === "evidence" ? (
          <section className="overview-grid">
            <article className="panel panel-tall">
              <div className="panel-heading">
                <p className="eyebrow">Candidate score and passport</p>
                <h3>Evidence view</h3>
              </div>
              {submissionResult ? (
                <div className="evidence-stack">
                  <div className="score-banner">
                    <div>
                      <span className="score-label">Overall score</span>
                      <strong>{submissionResult.evaluation.parsed_json.overall_score}</strong>
                    </div>
                    <div>
                      <span className="score-label">Recommendation</span>
                      <strong>{submissionResult.evaluation.parsed_json.recommended_action}</strong>
                    </div>
                    <div>
                      <span className="score-label">Confidence</span>
                      <strong>{submissionResult.evaluation.parsed_json.confidence_band}</strong>
                    </div>
                  </div>
                  <div className="two-col">
                    <div>
                      <h4>Strengths</h4>
                      <ul className="detail-list">
                        {submissionResult.evaluation.parsed_json.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Gaps</h4>
                      <ul className="detail-list">
                        {submissionResult.evaluation.parsed_json.gaps.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="two-col">
                    <div>
                      <h4>Rubric breakdown</h4>
                      <ul className="detail-list">
                        {submissionResult.evaluation.parsed_json.rubric_breakdown.map((row) => (
                          <li key={row.criterion}>
                            {row.criterion}: {row.score} {row.critical ? "(critical)" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4>Improvement route</h4>
                      <ul className="detail-list">
                        {submissionResult.improvement_route.practice_focus.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                      <p className="meta-copy">
                        Next task: {submissionResult.improvement_route.recommended_next_task}
                      </p>
                    </div>
                  </div>
                  <p className="ethics-note">
                    {submissionResult.evaluation.parsed_json.ethics_note}
                  </p>
                </div>
              ) : (
                <p className="empty-state">
                  Score a candidate submission from the candidate tab to populate this area.
                </p>
              )}
            </article>

            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Ranked shortlist</p>
                <h3>Employer comparison view</h3>
              </div>
              {shortlist.length > 0 ? (
                <div className="shortlist">
                  {shortlist.map((row, index) => (
                    <article className="shortlist-row" key={row.submission_id}>
                      <div>
                        <p className="rank-label">#{index + 1}</p>
                        <strong>{row.candidate_name}</strong>
                        <p>{row.recommended_action}</p>
                      </div>
                      <div className="shortlist-score">
                        <span>{row.average_score}</span>
                        <small>{row.confidence_band}</small>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No shortlist data yet.</p>
              )}
            </article>

            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">Trial-task reconciliation</p>
                <h3>Check overlap before adding more work</h3>
              </div>
              <label>
                Proposed trial task
                <textarea
                  rows={6}
                  value={trialTaskText}
                  onChange={(event) => setTrialTaskText(event.target.value)}
                />
              </label>
              <button className="button button-secondary" onClick={handleTrialCheck}>
                Run overlap check
              </button>
              {trialReview ? (
                <div className="review-card">
                  <strong>
                    {trialReview.recommendation} ({trialReview.overlap_score}% overlap)
                  </strong>
                  <p>{trialReview.suggested_adjustment}</p>
                  <p className="meta-copy">
                    Repeated: {trialReview.repeated_competencies.join(", ") || "none"}
                  </p>
                  <p className="meta-copy">
                    New: {trialReview.new_competencies.join(", ") || "none"}
                  </p>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}

        {view === "feedback" ? (
          <section className="overview-grid">
            <article className="panel">
              <div className="panel-heading">
                <p className="eyebrow">User testing log</p>
                <h3>Capture prototype feedback</h3>
              </div>
              <form className="stack" onSubmit={handleFeedbackSubmit}>
                <label>
                  Tester type
                  <select
                    value={feedbackForm.tester_type}
                    onChange={(event) =>
                      setFeedbackForm({
                        ...feedbackForm,
                        tester_type: event.target.value as typeof feedbackForm.tester_type,
                      })
                    }
                  >
                    <option value="candidate">Candidate</option>
                    <option value="employer">Employer</option>
                    <option value="trainer">Trainer</option>
                  </select>
                </label>
                <label>
                  Observations
                  <textarea
                    rows={3}
                    value={feedbackForm.observations}
                    onChange={(event) =>
                      setFeedbackForm({ ...feedbackForm, observations: event.target.value })
                    }
                  />
                </label>
                <label>
                  Doubts
                  <textarea
                    rows={3}
                    value={feedbackForm.doubts}
                    onChange={(event) =>
                      setFeedbackForm({ ...feedbackForm, doubts: event.target.value })
                    }
                  />
                </label>
                <label>
                  Trust signals
                  <textarea
                    rows={3}
                    value={feedbackForm.trust_signals}
                    onChange={(event) =>
                      setFeedbackForm({ ...feedbackForm, trust_signals: event.target.value })
                    }
                  />
                </label>
                <label>
                  Changes made
                  <textarea
                    rows={3}
                    value={feedbackForm.changes_made}
                    onChange={(event) =>
                      setFeedbackForm({ ...feedbackForm, changes_made: event.target.value })
                    }
                  />
                </label>
                <button className="button button-primary" type="submit">
                  Save feedback
                </button>
              </form>
            </article>

            <article className="panel panel-tall">
              <div className="panel-heading">
                <p className="eyebrow">Existing notes</p>
                <h3>Feedback records from the backend</h3>
              </div>
              <div className="feedback-list">
                {feedbackItems.map((item) => (
                  <article className="feedback-card" key={item.id}>
                    <div className="feedback-head">
                      <strong>{item.tester_type}</strong>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <p>{item.observations}</p>
                    <p className="meta-copy">Doubts: {item.doubts}</p>
                    <p className="meta-copy">Trust: {item.trust_signals}</p>
                    <p className="meta-copy">Change: {item.changes_made}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function toggleValue(values: string[], next: string) {
  return values.includes(next) ? values.filter((value) => value !== next) : [...values, next];
}

function uniqueEmail(email: string) {
  const [name, domain = "sabixa.africa"] = email.split("@");
  return `${name}+${Date.now()}@${domain}`;
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default App;
