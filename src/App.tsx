import { useEffect, useState } from "react";
import {
  api,
  type Candidate,
  type EmployerProfile,
  type HiringNeed,
  type PrototypeFeedback,
  type RoleTrack,
  type ShortlistCandidate,
  type SubmissionResult,
  type SkillPassport,
} from "./api";
import "./App.css";

type View = "candidate" | "employer";

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
  company_type: "Growth-stage ecommerce startup",
  sector: "Retail ecommerce",
  support_channel: ["WhatsApp", "Email"],
  customer_volume: "250 to 400 messages weekly",
};

function App() {
  const [view, setView] = useState<View>("candidate");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<RoleTrack[]>([]);
  const [candidateForm, setCandidateForm] = useState(candidateDefaults);
  const [employerForm, setEmployerForm] = useState(employerDefaults);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [hiringNeed, setHiringNeed] = useState<HiringNeed | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [passport, setPassport] = useState<SkillPassport | null>(null);
  const [selectedPassport, setSelectedPassport] = useState<SkillPassport | null>(null);
  const [feedback, setFeedback] = useState<PrototypeFeedback[]>([]);

  const track = tracks[0] ?? null;
  const selectedTask = hiringNeed?.tasks.find((taskItem) => taskItem.id === selectedTaskId) ?? null;

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const passportId = new URLSearchParams(window.location.search).get("passport");
    if (passportId) {
      void loadSharedPassport(Number(passportId));
    }
  }, []);

  async function bootstrap() {
    try {
      const [nextTracks, nextFeedback] = await Promise.all([
        api.roleTracks(),
        api.listFeedback().catch(() => []),
      ]);
      setTracks(nextTracks);
      setFeedback(nextFeedback);
    } catch (loadError) {
      setError(readError(loadError, "Failed to load the app."));
    }
  }

  async function loadSharedPassport(passportId: number) {
    setLoading("Loading shared passport");
    setError("");
    try {
      const sharedPassport = await api.getPassport(passportId);
      setPassport(sharedPassport);
    } catch (passportError) {
      setError(readError(passportError, "Could not load passport."));
    } finally {
      setLoading("");
    }
  }

  async function seedDemo() {
    setLoading("Seeding demo data");
    setError("");
    try {
      const seed = await api.seedDemo();
      const [nextNeed, nextShortlist, nextFeedback] = await Promise.all([
        api.hiringNeed(seed.hiring_need_id),
        api.shortlist(seed.hiring_need_id),
        api.listFeedback(),
      ]);
      setHiringNeed(nextNeed);
      setShortlist(nextShortlist);
      setFeedback(nextFeedback);
      setSelectedTaskId(nextNeed.tasks[0]?.id ?? null);
      if (seed.passport_ids[0]) {
        const firstPassport = await api.getPassport(seed.passport_ids[0]);
        setSelectedPassport(firstPassport);
      }
      setView("employer");
    } catch (seedError) {
      setError(readError(seedError, "Could not seed demo data."));
    } finally {
      setLoading("");
    }
  }

  async function loginCandidate() {
    if (!track) {
      setError("Role track is still loading.");
      return;
    }
    if (!hiringNeed) {
      await seedDemo();
    }
    setLoading("Logging in candidate");
    setError("");
    try {
      const auth = await api.candidateAuth({
        ...candidateForm,
        email: uniqueEmail(candidateForm.email),
        role_track_id: track.id,
      });
      setCandidate(auth.candidate);
    } catch (candidateError) {
      setError(readError(candidateError, "Could not login candidate."));
    } finally {
      setLoading("");
    }
  }

  async function submitTask() {
    if (!candidate || !hiringNeed || !selectedTask) {
      setError("Login as candidate and load a task first.");
      return;
    }
    if (!answer.trim()) {
      setError("Write your task response first.");
      return;
    }
    setLoading("Scoring task");
    setError("");
    try {
      const result = await api.submitTask({
        candidate_id: candidate.id,
        hiring_need_id: hiringNeed.id,
        task_id: selectedTask.id,
        answer: answer.trim(),
      });
      const [nextShortlist, nextPassport] = await Promise.all([
        api.shortlist(hiringNeed.id),
        api.getPassport(result.passport.id),
      ]);
      setSubmission(result);
      setPassport(nextPassport);
      setShortlist(nextShortlist);
      updateShareUrl(result.passport.id);
    } catch (submissionError) {
      setError(readError(submissionError, "Could not score submission."));
    } finally {
      setLoading("");
    }
  }

  async function loginEmployer() {
    setLoading("Logging in employer");
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
      setEmployer(nextEmployer);
      if (!hiringNeed) {
        await seedDemo();
      } else {
        const nextShortlist = await api.shortlist(hiringNeed.id);
        setShortlist(nextShortlist);
      }
      setView("employer");
    } catch (employerError) {
      setError(readError(employerError, "Could not login employer."));
    } finally {
      setLoading("");
    }
  }

  async function refreshEmployerData() {
    if (!hiringNeed) {
      setError("Seed demo data first.");
      return;
    }
    setLoading("Refreshing shortlist");
    setError("");
    try {
      const [nextShortlist, nextFeedback] = await Promise.all([
        api.shortlist(hiringNeed.id),
        api.listFeedback().catch(() => feedback),
      ]);
      setShortlist(nextShortlist);
      setFeedback(nextFeedback);
    } catch (refreshError) {
      setError(readError(refreshError, "Could not refresh shortlist."));
    } finally {
      setLoading("");
    }
  }

  async function openPassport(passportId: number) {
    setLoading("Loading passport");
    setError("");
    try {
      const nextPassport = await api.getPassport(passportId);
      setSelectedPassport(nextPassport);
    } catch (passportError) {
      setError(readError(passportError, "Could not load candidate passport."));
    } finally {
      setLoading("");
    }
  }

  async function copyShareLink() {
    if (!passport) {
      return;
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}?passport=${passport.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      setError("Could not copy link.");
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Sabixa MVP</h1>
          <p>Candidate tasks, AI scoring, passport, employer shortlist.</p>
        </div>
        <div className="header-actions">
          <button
            className={view === "candidate" ? "active" : ""}
            onClick={() => setView("candidate")}
          >
            Candidate
          </button>
          <button
            className={view === "employer" ? "active" : ""}
            onClick={() => setView("employer")}
          >
            Employer
          </button>
          <button onClick={seedDemo}>Seed demo</button>
        </div>
      </header>

      {loading ? <div className="banner">{loading}</div> : null}
      {error ? <div className="banner error">{error}</div> : null}

      {passport ? (
        <section className="card share-card">
          <div className="row-between">
            <div>
              <h2>Shareable Passport</h2>
              <p>Public link ready for portfolio sharing.</p>
            </div>
            <button onClick={copyShareLink}>Copy link</button>
          </div>
          <PassportCard passport={passport} />
        </section>
      ) : null}

      {view === "candidate" ? (
        <main className="grid">
          <section className="card">
            <h2>Candidate Login</h2>
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
            <button onClick={loginCandidate}>
              {candidate ? "Create another candidate" : "Login as candidate"}
            </button>
          </section>

          <section className="card">
            <h2>Take Task</h2>
            {!hiringNeed ? <p>Seed demo first to load tasks.</p> : null}
            {candidate ? (
              <p className="muted">
                Logged in as <strong>{candidateForm.full_name}</strong>
              </p>
            ) : null}
            {hiringNeed && hiringNeed.tasks.length > 0 ? (
              <>
                <div className="task-tabs">
                  {hiringNeed.tasks.map((task) => (
                    <button
                      key={task.id}
                      className={selectedTaskId === task.id ? "active" : ""}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
                {selectedTask ? (
                  <>
                    <div className="task-box">
                      <h3>{selectedTask.title}</h3>
                      <p>{selectedTask.scenario}</p>
                      <p className="muted">{selectedTask.instructions}</p>
                    </div>
                    <div className="rubric">
                      {selectedTask.rubric.map((item) => (
                        <div key={item.criterion} className="rubric-item">
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
                      />
                    </label>
                    <button onClick={submitTask}>Submit for AI scoring</button>
                  </>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="card full">
            <h2>Score Result</h2>
            {submission ? (
              <div className="score-layout">
                <div className="score-box">
                  <span>Overall</span>
                  <strong>{submission.evaluation.parsed_json.overall_score}</strong>
                  <small>{submission.evaluation.parsed_json.recommended_action}</small>
                </div>
                <div>
                  <h3>Strengths</h3>
                  <ul>
                    {submission.evaluation.parsed_json.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Gaps</h3>
                  <ul>
                    {submission.evaluation.parsed_json.gaps.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p>No score yet.</p>
            )}
          </section>
        </main>
      ) : null}

      {view === "employer" ? (
        <main className="grid">
          <section className="card">
            <h2>Employer Login</h2>
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
              Email
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
            <button onClick={loginEmployer}>
              {employer ? "Refresh employer session" : "Login as employer"}
            </button>
            <button className="secondary" onClick={refreshEmployerData}>
              Refresh rated candidates
            </button>
          </section>

          <section className="card">
            <div className="row-between">
              <h2>Rated Candidates</h2>
              <span>{shortlist.length}</span>
            </div>
            {shortlist.length === 0 ? <p>No rated candidates yet.</p> : null}
            <div className="list">
              {shortlist.map((item) => (
                <button
                  key={item.submission_id}
                  className="list-item"
                  onClick={() => openPassport(item.passport_id)}
                >
                  <div>
                    <strong>{item.candidate_name}</strong>
                    <p>{item.recommended_action}</p>
                  </div>
                  <div className="right">
                    <strong>{item.average_score}</strong>
                    <small>{item.confidence_band}</small>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="card full">
            <h2>Candidate Passport</h2>
            {selectedPassport ? <PassportCard passport={selectedPassport} /> : <p>Select a candidate.</p>}
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
      <div className="passport-head">
        <div>
          <h3>{summary.headline ?? "Skill Passport"}</h3>
          <p>{summary.summary ?? "Performance summary generated from task evidence."}</p>
        </div>
        <div className="passport-id">Passport #{passport.id}</div>
      </div>
      <div className="passport-grid">
        <div>
          <h4>Strengths</h4>
          <ul>
            {passport.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Gaps</h4>
          <ul>
            {passport.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="portfolio">
        <h4>Portfolio Evidence</h4>
        <p>{passport.evidence_preview}</p>
      </div>
    </div>
  );
}

function uniqueEmail(email: string) {
  const [name, domain = "sabixa.africa"] = email.split("@");
  return `${name}+${Date.now()}@${domain}`;
}

function updateShareUrl(passportId: number) {
  const nextUrl = `${window.location.pathname}?passport=${passportId}`;
  window.history.replaceState({}, "", nextUrl);
}

function readError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default App;
