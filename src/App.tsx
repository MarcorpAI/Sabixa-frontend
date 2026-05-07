import { useEffect, useState } from "react";
import {
  api,
  type Candidate,
  type EmployerProfile,
  type HiringNeed,
  type IntakeAnswers,
  type RoleTrack,
  type ShortlistCandidate,
  type SkillPassport,
  type SubmissionResult,
} from "./api";
import "./App.css";

type View = "home" | "candidate" | "employer" | "shared-passport";
type CandidateStep = "onboarding" | "task" | "score" | "passport";
type EmployerStep = "login" | "intake" | "shortlist";

type CandidateSession = {
  candidate: Candidate;
  candidateForm: typeof candidateDefaults;
  hiringNeed: HiringNeed;
  shortlist: ShortlistCandidate[];
  taskIndex: number;
  answerDrafts: Record<number, string>;
  submissions: SubmissionResult[];
  passport: SkillPassport | null;
  candidateStep: CandidateStep;
};

type EmployerSession = {
  employer: EmployerProfile;
  employerForm: typeof employerDefaults;
  intakeForm: IntakeAnswers;
  hiringNeed: HiringNeed | null;
  shortlist: ShortlistCandidate[];
  selectedTrackId: string;
  employerStep: EmployerStep;
};

const candidateDefaults = {
  full_name: "Zainab Afolayan",
  email: "zainab@sabixa.africa",
  location: "Lagos, Nigeria",
  experience: "Entry-level customer support and complaint handling experience.",
};

const employerDefaults = {
  full_name: "Ada Nwosu",
  email: "ada@sabixa.africa",
  company_name: "Kori Market",
};

const fallbackTrack: RoleTrack = {
  id: "customer-support-associate",
  title: "Customer Support Associate",
  role_family: "Customer support / customer operations",
  summary: "Customer support task track.",
  task_count: 3,
  benchmark: "2 tasks with 70+ average",
  competencies: ["Empathy", "Clarity", "Ownership", "Escalation judgement"],
};

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

const candidateSessionKey = "sabixa:candidate-session";
const employerSessionKey = "sabixa:employer-session";

function App() {
  const [view, setView] = useState<View>("home");
  const [candidateStep, setCandidateStep] = useState<CandidateStep>("onboarding");
  const [employerStep, setEmployerStep] = useState<EmployerStep>("login");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tracks, setTracks] = useState<RoleTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState("customer-support-associate");
  const [candidateForm, setCandidateForm] = useState(candidateDefaults);
  const [employerForm, setEmployerForm] = useState(employerDefaults);
  const [intakeForm, setIntakeForm] = useState<IntakeAnswers>(intakeDefaults);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [hiringNeed, setHiringNeed] = useState<HiringNeed | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [candidateSubmissions, setCandidateSubmissions] = useState<SubmissionResult[]>([]);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [passport, setPassport] = useState<SkillPassport | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<SkillPassport | null>(null);

  const roleTrackOptions = tracks.length > 0 ? tracks : [fallbackTrack];
  const currentTrack =
    roleTrackOptions.find((track) => track.id === selectedTrackId) ?? roleTrackOptions[0];
  const currentTask = hiringNeed?.tasks[taskIndex] ?? null;
  const passportUrl = passport
    ? `${window.location.origin}${window.location.pathname}?passport=${passport.id}`
    : "";

  useEffect(() => {
    void loadTracks();
    void loadSharedPassportFromUrl();
    restoreSessions();
  }, []);

  async function loadTracks() {
    try {
      const nextTracks = await api.roleTracks();
      setTracks(nextTracks);
      setSelectedTrackId(nextTracks[0]?.id ?? "customer-support-associate");
    } catch (loadError) {
      setError(readError(loadError, "Could not load role categories."));
    }
  }

  async function loadSharedPassportFromUrl() {
    const passportId = new URLSearchParams(window.location.search).get("passport");
    if (!passportId) {
      return;
    }
    setView("shared-passport");
    setLoading("Loading passport");
    try {
      const sharedPassport = await api.getPassport(Number(passportId));
      setSelectedPassport(sharedPassport);
    } catch (passportError) {
      setError(readError(passportError, "Could not load shared passport."));
    } finally {
      setLoading("");
    }
  }

  async function createCandidateHiringNeed() {
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
    const nextNeed = await api.createHiringNeed({
      employer_id: poolEmployer.id,
      rough_jd: `${currentTrack?.title ?? "Customer support"} assessment pool`,
      intake_answers: intakeDefaults,
    });
    const nextShortlist = await api.globalShortlist();
    setHiringNeed(nextNeed);
    setShortlist(nextShortlist);
    setTaskIndex(0);
    return nextNeed;
  }

  async function startCandidate() {
    setError("");
    setView("candidate");
    setCandidateStep(candidate ? candidateStep : "onboarding");
  }

  async function loginCandidate() {
    if (!currentTrack) {
      setError("Role category is still loading.");
      return;
    }

    setLoading("Setting up your task");
    setError("");
    try {
      const activeNeed = await createCandidateHiringNeed();
      const activeShortlist = await api.globalShortlist();
      const auth = await api.candidateAuth({
        ...candidateForm,
        email: uniqueEmail(candidateForm.email),
        role_track_id: currentTrack.id,
      });
      setCandidate(auth.candidate);
      setCandidateStep("task");
      setTaskIndex(0);
      setAnswer("");
      setAnswerDrafts({});
      setCandidateSubmissions([]);
      setSubmission(null);
      setPassport(null);
      clearShareUrl();
      saveCandidateSession({
        candidate: auth.candidate,
        candidateForm,
        hiringNeed: activeNeed,
        shortlist: activeShortlist,
        taskIndex: 0,
        answerDrafts: {},
        submissions: [],
        passport: null,
        candidateStep: "task",
      });
    } catch (candidateError) {
      setError(readError(candidateError, "Could not start candidate task."));
    } finally {
      setLoading("");
    }
  }

  async function submitTask() {
    let activeNeed = hiringNeed;
    let activeTask = currentTask;

    if (!activeNeed || !activeTask) {
      activeNeed = await createCandidateHiringNeed();
      activeTask = activeNeed.tasks[taskIndex] ?? activeNeed.tasks[0] ?? null;
    }

    if (!candidate || !activeNeed || !activeTask) {
      setError("Start candidate onboarding first.");
      return;
    }
    if (!answer.trim()) {
      setError("Write your response before submitting.");
      return;
    }

    setLoading("AI is scoring your task");
    setError("");
    try {
      const result = await api.submitTask({
        candidate_id: candidate.id,
        hiring_need_id: activeNeed.id,
        task_id: activeTask.id,
        answer: answer.trim(),
      });
      const [nextShortlist, nextPassport] = await Promise.all([
        api.globalShortlist(),
        api.getPassport(result.passport.id),
      ]);
      const nextSubmissions = upsertSubmission(candidateSubmissions, result);
      setSubmission(result);
      setPassport(nextPassport);
      setShortlist(nextShortlist);
      setCandidateSubmissions(nextSubmissions);
      setCandidateStep("score");
      saveCandidateSession({
        candidate,
        candidateForm,
        hiringNeed: activeNeed,
        shortlist: nextShortlist,
        taskIndex,
        answerDrafts: { ...answerDrafts, [activeTask.id]: answer },
        submissions: nextSubmissions,
        passport: nextPassport,
        candidateStep: "score",
      });
    } catch (submissionError) {
      if (readError(submissionError, "").toLowerCase().includes("hiring need not found")) {
        setHiringNeed(null);
        setSelectedPassport(null);
        setError("The demo hiring need expired. Continue again to reload the task.");
        return;
      }
      setError(readError(submissionError, "Could not score this task."));
    } finally {
      setLoading("");
    }
  }

  function continueAfterScore() {
    if (!hiringNeed) {
      return;
    }

    const hasNextTask = taskIndex + 1 < hiringNeed.tasks.length;
    if (hasNextTask) {
      const nextIndex = taskIndex + 1;
      const nextTask = hiringNeed.tasks[nextIndex];
      const nextAnswer = nextTask ? answerDrafts[nextTask.id] ?? "" : "";
      setTaskIndex(nextIndex);
      setAnswer(nextAnswer);
      setSubmission(null);
      setCandidateStep("task");
      if (candidate) {
        saveCandidateSession({
          candidate,
          candidateForm,
          hiringNeed,
          shortlist,
          taskIndex: nextIndex,
          answerDrafts,
          submissions: candidateSubmissions,
          passport,
          candidateStep: "task",
        });
      }
      return;
    }

    if (passport) {
      updateShareUrl(passport.id);
    }
    setCandidateStep("passport");
    persistCandidateStep("passport");
  }

  function skipToPassport() {
    if (passport) {
      updateShareUrl(passport.id);
      setCandidateStep("passport");
      persistCandidateStep("passport");
    }
  }

  function goToPreviousTask() {
    if (!hiringNeed || taskIndex === 0) {
      return;
    }

    const nextIndex = taskIndex - 1;
    const nextTask = hiringNeed.tasks[nextIndex];
    const nextAnswer = nextTask ? answerDrafts[nextTask.id] ?? "" : "";
    setTaskIndex(nextIndex);
    setAnswer(nextAnswer);
    setSubmission(candidateSubmissions.find((item) => item.submission.task_id === nextTask?.id) ?? null);
    setCandidateStep("task");
    persistCandidateWork(nextIndex, nextAnswer, "task");
  }

  function returnToCurrentTask() {
    setCandidateStep("task");
    persistCandidateStep("task");
  }

  function updateAnswer(nextAnswer: string) {
    setAnswer(nextAnswer);
    if (currentTask) {
      const nextDrafts = { ...answerDrafts, [currentTask.id]: nextAnswer };
      setAnswerDrafts(nextDrafts);
      if (candidate && hiringNeed) {
        saveCandidateSession({
          candidate,
          candidateForm,
          hiringNeed,
          shortlist,
          taskIndex,
          answerDrafts: nextDrafts,
          submissions: candidateSubmissions,
          passport,
          candidateStep,
        });
      }
    }
  }

  async function startEmployer() {
    setError("");
    setView("employer");
    setEmployerStep("login");
  }

  async function loginEmployer() {
    setLoading("Starting employer session");
    setError("");
    try {
      const nextEmployer = await api.employerAuth({
        user: {
          full_name: employerForm.full_name,
          email: employerForm.email,
          role: "employer",
        },
        company_name: employerForm.company_name,
        company_type: "SME or startup",
        sector: "Customer support",
        support_channel: ["WhatsApp", "Email"],
        customer_volume: "Hiring pipeline",
      });
      setEmployer(nextEmployer);
      setEmployerStep("intake");
      saveEmployerSession({
        employer: nextEmployer,
        employerForm,
        intakeForm,
        hiringNeed,
        shortlist,
        selectedTrackId,
        employerStep: "intake",
      });
    } catch (employerError) {
      setError(readError(employerError, "Could not start employer session."));
    } finally {
      setLoading("");
    }
  }

  async function submitHiringNeed() {
    if (!employer) {
      setError("Login as employer first.");
      return;
    }

    setLoading("Generating task pack");
    setError("");
    try {
      const nextNeed = await api.createHiringNeed({
        employer_id: employer.id,
        rough_jd: `${currentTrack?.title ?? "Customer support"} role for ${employerForm.company_name}`,
        intake_answers: intakeForm,
      });
      const nextShortlist = await api.globalShortlist();
      setHiringNeed(nextNeed);
      setShortlist(nextShortlist);
      setSelectedPassport(null);
      setEmployerStep("shortlist");
      saveEmployerSession({
        employer,
        employerForm,
        intakeForm,
        hiringNeed: nextNeed,
        shortlist: nextShortlist,
        selectedTrackId,
        employerStep: "shortlist",
      });
    } catch (intakeError) {
      setError(readError(intakeError, "Could not create hiring need."));
    } finally {
      setLoading("");
    }
  }

  async function refreshShortlist() {
    if (!hiringNeed) {
      setError("Choose a role category first.");
      return;
    }

    setLoading("Refreshing candidates");
    setError("");
    try {
      const nextShortlist = await api.globalShortlist();
      setShortlist(nextShortlist);
      if (employer) {
        saveEmployerSession({
          employer,
          employerForm,
          intakeForm,
          hiringNeed,
          shortlist: nextShortlist,
          selectedTrackId,
          employerStep,
        });
      }
    } catch (refreshError) {
      setError(readError(refreshError, "Could not refresh candidates."));
    } finally {
      setLoading("");
    }
  }

  async function openPassport(passportId: number) {
    setLoading("Opening passport");
    setError("");
    try {
      const nextPassport = await api.getPassport(passportId);
      setSelectedPassport(nextPassport);
    } catch (passportError) {
      setError(readError(passportError, "Could not open passport."));
    } finally {
      setLoading("");
    }
  }

  async function copyShareLink() {
    if (!passportUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(passportUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy link.");
    }
  }

  function logoutCandidate() {
    localStorage.removeItem(candidateSessionKey);
    setCandidate(null);
    setCandidateStep("onboarding");
    setTaskIndex(0);
    setAnswer("");
    setAnswerDrafts({});
    setSubmission(null);
    setCandidateSubmissions([]);
    setPassport(null);
    clearShareUrl();
  }

  function logoutEmployer() {
    localStorage.removeItem(employerSessionKey);
    setEmployer(null);
    setEmployerStep("login");
    setSelectedPassport(null);
  }

  function persistCandidateStep(nextStep: CandidateStep) {
    if (!candidate || !hiringNeed) {
      return;
    }
    saveCandidateSession({
      candidate,
      candidateForm,
      hiringNeed,
      shortlist,
      taskIndex,
      answerDrafts,
      submissions: candidateSubmissions,
      passport,
      candidateStep: nextStep,
    });
  }

  function persistCandidateWork(nextTaskIndex: number, nextAnswer: string, nextStep: CandidateStep) {
    if (!candidate || !hiringNeed) {
      return;
    }
    const task = hiringNeed.tasks[nextTaskIndex];
    const nextDrafts = task ? { ...answerDrafts, [task.id]: nextAnswer } : answerDrafts;
    setAnswerDrafts(nextDrafts);
    saveCandidateSession({
      candidate,
      candidateForm,
      hiringNeed,
      shortlist,
      taskIndex: nextTaskIndex,
      answerDrafts: nextDrafts,
      submissions: candidateSubmissions,
      passport,
      candidateStep: nextStep,
    });
  }

  function restoreSessions() {
    const candidateSession = readSession<CandidateSession>(candidateSessionKey);
    if (candidateSession) {
      setCandidate(candidateSession.candidate);
      setCandidateForm(candidateSession.candidateForm);
      setHiringNeed(candidateSession.hiringNeed);
      setShortlist(candidateSession.shortlist);
      setTaskIndex(candidateSession.taskIndex);
      setAnswerDrafts(candidateSession.answerDrafts);
      setCandidateSubmissions(candidateSession.submissions);
      setPassport(candidateSession.passport);
      setCandidateStep(candidateSession.candidateStep);
      const task = candidateSession.hiringNeed.tasks[candidateSession.taskIndex];
      setAnswer(task ? candidateSession.answerDrafts[task.id] ?? "" : "");
      setSubmission(
        candidateSession.submissions.find((item) => item.submission.task_id === task?.id) ?? null
      );
    }

    const employerSession = readSession<EmployerSession>(employerSessionKey);
    if (employerSession) {
      setEmployer(employerSession.employer);
      setEmployerForm(employerSession.employerForm);
      setIntakeForm(employerSession.intakeForm);
      setSelectedTrackId(employerSession.selectedTrackId);
      setHiringNeed((current) => current ?? employerSession.hiringNeed);
      setShortlist((current) => (current.length > 0 ? current : employerSession.shortlist));
      setEmployerStep(employerSession.employerStep);
    }
  }

  return (
    <div className="app-shell">
      {loading ? (
        <div className="loading-overlay" role="status" aria-live="polite">
          <span className="spinner" />
          {loading}
        </div>
      ) : null}

      <header className="topbar">
        <button className="brand-button" onClick={() => setView("home")}>
          <img src="/sabixalogo.svg" alt="Sabixa" />
        </button>
        <div className="topbar-actions">
          <button onClick={startCandidate}>Candidate</button>
          <button onClick={startEmployer}>Employer</button>
          {view === "candidate" && candidate ? <button onClick={logoutCandidate}>Logout</button> : null}
          {view === "employer" && employer ? <button onClick={logoutEmployer}>Logout</button> : null}
        </div>
      </header>

      {error ? <div className="notice notice-error">{error}</div> : null}

      {view === "home" ? (
        <main className="hero">
          <h1>Proof-of-skill passports for customer support hiring.</h1>
          <p>
            Candidates complete real support tasks. AI scores the work and turns the result into
            a shareable passport employers can review.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={startCandidate}>
              Get started as candidate
            </button>
            <button onClick={startEmployer}>Employer</button>
          </div>
        </main>
      ) : null}

      {view === "candidate" ? (
        <main className="page">
          <Progress
            steps={["Onboarding", "Task", "Score", "Passport"]}
            active={["onboarding", "task", "score", "passport"].indexOf(candidateStep)}
          />

          {candidateStep === "onboarding" ? (
            <section className="panel narrow">
              <h2>Candidate onboarding</h2>
              <p className="muted">Start with the customer support associate task track.</p>
              <label>
                Job category
                <select
                  value={selectedTrackId}
                  onChange={(event) => setSelectedTrackId(event.target.value)}
                >
                  {roleTrackOptions.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Full name
                <input
                  value={candidateForm.full_name}
                  onChange={(event) =>
                    setCandidateForm({ ...candidateForm, full_name: event.target.value })
                  }
                />
              </label>
              <label>
                Email
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
                Experience
                <textarea
                  rows={3}
                  value={candidateForm.experience}
                  onChange={(event) =>
                    setCandidateForm({ ...candidateForm, experience: event.target.value })
                  }
                />
              </label>
              <button className="primary" onClick={loginCandidate} disabled={Boolean(loading)}>
                {loading ? "Setting up..." : candidate ? "Continue session" : "Continue to task"}
              </button>
            </section>
          ) : null}

          {candidateStep === "task" && currentTask ? (
            <section className="panel task-panel">
              <div className="section-head">
                <div>
                  <span className="small-label">
                    Task {taskIndex + 1} of {hiringNeed?.tasks.length ?? 1}
                  </span>
                  <h2>{currentTask.title}</h2>
                </div>
                <span className="time">{currentTask.time_limit_minutes} min</span>
              </div>
              <div className="task-brief">
                <p>{currentTask.scenario}</p>
                <p className="muted">{currentTask.instructions}</p>
              </div>
              <div className="rubric-list">
                {currentTask.rubric.map((item) => (
                  <div key={item.criterion}>
                    <strong>{item.criterion}</strong>
                    <span>{item.points} pts</span>
                  </div>
                ))}
              </div>
              <label>
                Your answer
                <textarea
                  rows={9}
                  value={answer}
                  onChange={(event) => updateAnswer(event.target.value)}
                  placeholder="Write your customer response here..."
                />
              </label>
              <div className="button-row">
                {taskIndex > 0 ? (
                  <button onClick={goToPreviousTask} disabled={Boolean(loading)}>
                    Previous task
                  </button>
                ) : null}
                <button className="primary" onClick={submitTask} disabled={Boolean(loading)}>
                  {loading ? "Scoring..." : "Submit for AI review"}
                </button>
              </div>
            </section>
          ) : null}

          {candidateStep === "score" && submission ? (
            <section className="panel">
              <div className="score-header">
                <div>
                  <span className="small-label">AI score</span>
                  <h2>{submission.evaluation.parsed_json.overall_score}/100</h2>
                </div>
                <span className="status-pill">
                  {submission.evaluation.parsed_json.recommended_action}
                </span>
              </div>
              <div className="review-grid">
                <ReviewList title="What worked" items={submission.evaluation.parsed_json.strengths} />
                <ReviewList title="Improve next" items={submission.evaluation.parsed_json.gaps} />
              </div>
              <div className="review-note">
                <strong>AI review</strong>
                <p>{submission.evaluation.parsed_json.confidence_reason}</p>
              </div>
              <div className="button-row">
                <button onClick={returnToCurrentTask} disabled={Boolean(loading)}>
                  Back to task
                </button>
                <button className="primary" onClick={continueAfterScore} disabled={Boolean(loading)}>
                  {taskIndex + 1 < (hiringNeed?.tasks.length ?? 0) ? "Next task" : "Next"}
                </button>
                <button onClick={skipToPassport} disabled={Boolean(loading)}>
                  View passport now
                </button>
              </div>
            </section>
          ) : null}

          {candidateStep === "passport" && passport ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <span className="small-label">Shareable portfolio</span>
                  <h2>Your skill passport</h2>
                </div>
                <button onClick={copyShareLink} disabled={Boolean(loading)}>
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <PassportCard passport={passport} />
              {candidateSubmissions.length > 0 ? (
                <TaskHistory submissions={candidateSubmissions} />
              ) : null}
              <input className="share-input" readOnly value={passportUrl} />
              <div className="button-row">
                <button onClick={returnToCurrentTask} disabled={Boolean(loading)}>
                  Back to tasks
                </button>
              </div>
            </section>
          ) : null}
        </main>
      ) : null}

      {view === "employer" ? (
        <main className="page">
          {employerStep === "login" ? (
            <section className="panel narrow">
              <h2>Employer login</h2>
              <p className="muted">
                Choose the role category you are hiring for and review rated candidate passports.
              </p>
              <label>
                Full name
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
                Company
                <input
                  value={employerForm.company_name}
                  onChange={(event) =>
                    setEmployerForm({ ...employerForm, company_name: event.target.value })
                  }
                />
              </label>
              <label>
                Job category
                <select
                  value={selectedTrackId}
                  onChange={(event) => setSelectedTrackId(event.target.value)}
                >
                  {roleTrackOptions.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" onClick={loginEmployer} disabled={Boolean(loading)}>
                {loading ? "Starting..." : "Continue"}
              </button>
            </section>
          ) : null}

          {employerStep === "intake" ? (
            <section className="panel narrow intake-panel">
              <h2>Hiring need intake</h2>
              <p className="muted">
                Describe the support problem behind the role. Sabixa uses this to generate the
                assessment context.
              </p>
              <label>
                Job category
                <select
                  value={selectedTrackId}
                  onChange={(event) => setSelectedTrackId(event.target.value)}
                >
                  {roleTrackOptions.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
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
                Common customer issues
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
                Weekly ticket volume
                <input
                  value={intakeForm.weekly_ticket_volume}
                  onChange={(event) =>
                    setIntakeForm({ ...intakeForm, weekly_ticket_volume: event.target.value })
                  }
                />
              </label>
              <button className="primary" onClick={submitHiringNeed} disabled={Boolean(loading)}>
                {loading ? "Generating..." : "Generate shortlist view"}
              </button>
            </section>
          ) : null}

          {employerStep === "shortlist" ? (
            <section className="employer-layout">
              <div className="panel">
                <div className="section-head">
                  <div>
                    <span className="small-label">Rated candidates</span>
                    <h2>{currentTrack?.title ?? "Customer Support Associate"}</h2>
                    {hiringNeed ? <p className="muted">{hiringNeed.role_problem_summary}</p> : null}
                  </div>
                  <button onClick={refreshShortlist} disabled={Boolean(loading)}>
                    {loading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                {hiringNeed ? (
                  <div className="skill-strip">
                    {hiringNeed.skill_map.slice(0, 4).map((skill) => (
                      <span key={skill.competency}>{skill.competency}</span>
                    ))}
                  </div>
                ) : null}
                <div className="candidate-list">
                  {shortlist.length === 0 ? <p className="muted">No rated candidates yet.</p> : null}
                  {shortlist.map((candidateItem) => (
                    <button
                      className="candidate-row"
                      key={candidateItem.submission_id}
                      onClick={() => openPassport(candidateItem.passport_id)}
                      disabled={Boolean(loading)}
                    >
                      <span>
                        <strong>{candidateItem.candidate_name}</strong>
                        <small>{candidateItem.recommended_action}</small>
                      </span>
                      <span className="rating">
                        {candidateItem.average_score}
                        <small>{candidateItem.confidence_band}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="section-head">
                  <div>
                    <span className="small-label">Passport</span>
                    <h2>Candidate evidence</h2>
                  </div>
                </div>
                {selectedPassport ? (
                  <PassportCard passport={selectedPassport} />
                ) : (
                  <p className="muted">Select a candidate to view their passport.</p>
                )}
              </div>
            </section>
          ) : null}
        </main>
      ) : null}

      {view === "shared-passport" ? (
        <main className="page">
          <section className="panel">
            <span className="small-label">Shared passport</span>
            {selectedPassport ? (
              <PassportCard passport={selectedPassport} />
            ) : (
              <p className="muted">Passport not found.</p>
            )}
          </section>
        </main>
      ) : null}
    </div>
  );
}

function TaskHistory({ submissions }: { submissions: SubmissionResult[] }) {
  return (
    <div className="task-history">
      <h3>Completed tasks</h3>
      {submissions.map((item) => (
        <div key={item.submission.id}>
          <span>Task #{item.submission.task_id}</span>
          <strong>{item.evaluation.parsed_json.overall_score}/100</strong>
          <small>{item.evaluation.parsed_json.recommended_action}</small>
        </div>
      ))}
    </div>
  );
}

function PassportCard({ passport }: { passport: SkillPassport }) {
  const summary = passport.public_summary ?? {};
  const scoreBreakdown = summary.score_breakdown ?? {};

  return (
    <div className="passport">
      <div className="passport-top">
        <div>
          <h3>{summary.headline ?? "Customer support skill passport"}</h3>
          <p>{summary.summary ?? "Generated from completed customer support task evidence."}</p>
        </div>
        <span>#{passport.id}</span>
      </div>
      <div className="passport-score">
        <div>
          <small>Overall score</small>
          <strong>{summary.overall_score ?? "N/A"}</strong>
        </div>
        <div>
          <small>Confidence</small>
          <strong>{summary.confidence_band ?? "N/A"}</strong>
        </div>
        <div>
          <small>Action</small>
          <strong>{summary.recommended_action ?? "Review"}</strong>
        </div>
      </div>
      {Object.keys(scoreBreakdown).length > 0 ? (
        <div className="breakdown-grid">
          {Object.entries(scoreBreakdown).map(([label, score]) => (
            <div key={label}>
              <span>{formatLabel(label)}</span>
              <strong>{score}</strong>
            </div>
          ))}
        </div>
      ) : null}
      <div className="passport-columns">
        <ReviewList title="Strengths" items={passport.strengths} />
        <ReviewList title="Gaps" items={passport.gaps} />
      </div>
      {summary.evidence_quotes && summary.evidence_quotes.length > 0 ? (
        <ReviewList title="Evidence notes" items={summary.evidence_quotes} />
      ) : null}
      <div className="portfolio-evidence">
        <strong>Portfolio evidence</strong>
        <p>{passport.evidence_preview}</p>
      </div>
      {summary.ethics_note ? <p className="ethics-note">{summary.ethics_note}</p> : null}
    </div>
  );
}

function ReviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Progress({ steps, active }: { steps: string[]; active: number }) {
  return (
    <div className="progress">
      {steps.map((step, index) => (
        <span className={index <= active ? "done" : ""} key={step}>
          {step}
        </span>
      ))}
    </div>
  );
}

function uniqueEmail(email: string) {
  const [name, domain = "sabixa.africa"] = email.split("@");
  return `${name}+${Date.now()}@${domain}`;
}

function updateShareUrl(passportId: number) {
  window.history.replaceState({}, "", `${window.location.pathname}?passport=${passportId}`);
}

function clearShareUrl() {
  window.history.replaceState({}, "", window.location.pathname);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function upsertSubmission(items: SubmissionResult[], nextItem: SubmissionResult) {
  const withoutTask = items.filter((item) => item.submission.task_id !== nextItem.submission.task_id);
  return [...withoutTask, nextItem].sort((a, b) => a.submission.task_id - b.submission.task_id);
}

function saveCandidateSession(session: CandidateSession) {
  localStorage.setItem(candidateSessionKey, JSON.stringify(session));
}

function saveEmployerSession(session: EmployerSession) {
  localStorage.setItem(employerSessionKey, JSON.stringify(session));
}

function readSession<T>(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default App;
