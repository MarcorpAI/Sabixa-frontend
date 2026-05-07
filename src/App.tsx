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
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [passport, setPassport] = useState<SkillPassport | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<SkillPassport | null>(null);

  const currentTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0] ?? null;
  const currentTask = hiringNeed?.tasks[taskIndex] ?? null;
  const passportUrl = passport
    ? `${window.location.origin}${window.location.pathname}?passport=${passport.id}`
    : "";

  useEffect(() => {
    void loadTracks();
    void loadSharedPassportFromUrl();
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

  async function ensureDemoData() {
    if (hiringNeed) {
      return hiringNeed;
    }

    const seed = await api.seedDemo();
    const [nextNeed, nextShortlist] = await Promise.all([
      api.hiringNeed(seed.hiring_need_id),
      api.shortlist(seed.hiring_need_id),
    ]);
    setHiringNeed(nextNeed);
    setShortlist(nextShortlist);
    setTaskIndex(0);
    return nextNeed;
  }

  async function startCandidate() {
    setError("");
    setView("candidate");
    setCandidateStep("onboarding");
  }

  async function loginCandidate() {
    if (!currentTrack) {
      setError("Role category is still loading.");
      return;
    }

    setLoading("Setting up your task");
    setError("");
    try {
      await ensureDemoData();
      const auth = await api.candidateAuth({
        ...candidateForm,
        email: uniqueEmail(candidateForm.email),
        role_track_id: currentTrack.id,
      });
      setCandidate(auth.candidate);
      setCandidateStep("task");
      setTaskIndex(0);
      setAnswer("");
      setSubmission(null);
      setPassport(null);
      clearShareUrl();
    } catch (candidateError) {
      setError(readError(candidateError, "Could not start candidate task."));
    } finally {
      setLoading("");
    }
  }

  async function submitTask() {
    if (!candidate || !hiringNeed || !currentTask) {
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
        hiring_need_id: hiringNeed.id,
        task_id: currentTask.id,
        answer: answer.trim(),
      });
      const [nextShortlist, nextPassport] = await Promise.all([
        api.shortlist(hiringNeed.id),
        api.getPassport(result.passport.id),
      ]);
      setSubmission(result);
      setPassport(nextPassport);
      setShortlist(nextShortlist);
      setCandidateStep("score");
    } catch (submissionError) {
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
      setTaskIndex((index) => index + 1);
      setAnswer("");
      setSubmission(null);
      setCandidateStep("task");
      return;
    }

    if (passport) {
      updateShareUrl(passport.id);
    }
    setCandidateStep("passport");
  }

  function skipToPassport() {
    if (passport) {
      updateShareUrl(passport.id);
      setCandidateStep("passport");
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
      const nextShortlist = await api.shortlist(nextNeed.id);
      setHiringNeed(nextNeed);
      setShortlist(nextShortlist);
      setSelectedPassport(null);
      setEmployerStep("shortlist");
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
      const nextShortlist = await api.shortlist(hiringNeed.id);
      setShortlist(nextShortlist);
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

  return (
    <div className="app-shell">
      {view !== "home" ? (
        <header className="topbar">
          <button className="brand-button" onClick={() => setView("home")}>
            Sabixa
          </button>
          <div className="topbar-actions">
            <button onClick={startCandidate}>Candidate</button>
            <button onClick={startEmployer}>Employer</button>
          </div>
        </header>
      ) : null}

      {loading ? <div className="notice">{loading}</div> : null}
      {error ? <div className="notice notice-error">{error}</div> : null}

      {view === "home" ? (
        <main className="hero">
          <p className="brand">Sabixa</p>
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
              <button className="primary" onClick={loginCandidate}>
                Continue to task
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
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Write your customer response here..."
                />
              </label>
              <button className="primary" onClick={submitTask}>
                Submit for AI review
              </button>
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
                <button className="primary" onClick={continueAfterScore}>
                  {taskIndex + 1 < (hiringNeed?.tasks.length ?? 0) ? "Next task" : "Next"}
                </button>
                <button onClick={skipToPassport}>View passport now</button>
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
                <button onClick={copyShareLink}>{copied ? "Copied" : "Copy link"}</button>
              </div>
              <PassportCard passport={passport} />
              <input className="share-input" readOnly value={passportUrl} />
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
                  {tracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary" onClick={loginEmployer}>
                Continue
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
                  {tracks.map((track) => (
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
              <button className="primary" onClick={submitHiringNeed}>
                Generate shortlist view
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
                  <button onClick={refreshShortlist}>Refresh</button>
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

function PassportCard({ passport }: { passport: SkillPassport }) {
  const summary = passport.public_summary ?? {};

  return (
    <div className="passport">
      <div className="passport-top">
        <div>
          <h3>{summary.headline ?? "Customer support skill passport"}</h3>
          <p>{summary.summary ?? "Generated from completed customer support task evidence."}</p>
        </div>
        <span>#{passport.id}</span>
      </div>
      <div className="passport-columns">
        <ReviewList title="Strengths" items={passport.strengths} />
        <ReviewList title="Gaps" items={passport.gaps} />
      </div>
      <div className="portfolio-evidence">
        <strong>Portfolio evidence</strong>
        <p>{passport.evidence_preview}</p>
      </div>
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

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default App;
