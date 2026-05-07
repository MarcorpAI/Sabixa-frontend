import { useState, useEffect } from "react";
import type { RoleTrack, HiringNeed, SubmissionResult, ShortlistCandidate } from "./api";
import { api } from "./api";
import "./App.css";

type Mode = "start" | "candidate" | "employer";

function App() {
  const [mode, setMode] = useState<Mode>("start");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<RoleTrack[]>([]);
  const [hiringNeed, setHiringNeed] = useState<HiringNeed | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistCandidate[]>([]);
  const [submission, setSubmission] = useState<SubmissionResult | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [aiStatus, setAiStatus] = useState("checking");

  const [profile, setProfile] = useState({ full_name: "Candidate", email: "test@test.com", location: "Nigeria", experience: "Customer support" });
  const [answer, setAnswer] = useState("");

  const task = hiringNeed?.tasks[taskIndex];

  useEffect(() => {
    api.roleTracks().then(setTracks).catch(() => {});
    api.mvpStatus().then((s) => setAiStatus(s.sprint_scope.ai_provider)).catch(() => setAiStatus("unknown"));
  }, []);

  async function startCandidate() {
    if (!profile.full_name || !profile.email || !profile.location) {
      setError("Please fill all fields");
      return;
    }
    setLoading("Preparing...");
    setError("");
    try {
      const seeded = await api.seedDemo();
      const need = await api.hiringNeed(seeded.hiring_need_id);
      await api.candidateAuth({ ...profile, role_track_id: tracks[0]?.id || "customer-support-associate" });
      setHiringNeed(need);
      setShortlist(seeded.shortlist);
      setMode("candidate");
    } catch (e) {
      setError("Failed to start");
    } finally {
      setLoading("");
    }
  }

  async function submitTask() {
    if (!answer.trim()) {
      setError("Please write your response");
      return;
    }
    setLoading("AI is scoring...");
    setError("");
    try {
      const result = await api.submitTask({
        candidate_id: 1,
        hiring_need_id: hiringNeed!.id,
        task_id: task!.id,
        answer,
      });
      setSubmission(result);
      setShortlist(await api.shortlist(hiringNeed!.id));
    } catch (e) {
      setError("Failed to submit");
    } finally {
      setLoading("");
    }
  }

  async function nextTask() {
    if (!hiringNeed) return;
    setTaskIndex((i) => Math.min(i + 1, hiringNeed.tasks.length - 1));
    setSubmission(null);
    setAnswer("");
  }

  return (
    <div className="app">
      <header>
        <h1>Sabixa</h1>
        <span className={`badge ${aiStatus === "configured" ? "ai" : ""}`}>
          {aiStatus === "configured" ? "AI Scoring" : "Fallback"}
        </span>
      </header>

      {loading && <div className="loading">{loading}</div>}
      {error && <div className="error">{error}</div>}

      {mode === "start" && (
        <section className="hero">
          <h2>Prove your support skills.</h2>
          <p>Complete a customer support task, get AI-scored feedback and a skill passport.</p>
          <div className="buttons">
            <button className="primary" onClick={startCandidate}>Start as Candidate</button>
            <button className="secondary" onClick={() => setMode("employer")}>Employer View</button>
          </div>
        </section>
      )}

      {mode === "candidate" && !submission && (
        <section className="task">
          <div className="step">Task {taskIndex + 1} of {hiringNeed?.tasks.length}</div>
          <h3>{task?.title}</h3>
          <p className="scenario">{task?.scenario}</p>
          <p className="instructions">{task?.instructions}</p>
          <textarea
            placeholder="Write your response..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={8}
          />
          <button className="primary" onClick={submitTask}>Submit</button>
        </section>
      )}

      {mode === "candidate" && submission && (
        <section className="result">
          <div className="score-circle">
            <span className="score">{submission.evaluation.parsed_json.overall_score}</span>
            <span className="action">{submission.evaluation.parsed_json.recommended_action}</span>
          </div>
          <div className="passport">
            <h3>Your Skill Passport</h3>
            <div className="strengths">
              <h4>What went well</h4>
              {submission.evaluation.parsed_json.strengths.map((s: string) => (
                <p key={s}>{s}</p>
              ))}
            </div>
            <div className="gaps">
              <h4>Areas to improve</h4>
              {submission.evaluation.parsed_json.gaps.map((g: string) => (
                <p key={g}>{g}</p>
              ))}
            </div>
            <p className="ethics">{submission.evaluation.parsed_json.ethics_note}</p>
          </div>
          <div className="next">
            {taskIndex < (hiringNeed?.tasks.length || 0) - 1 && (
              <button className="primary" onClick={nextTask}>Try Next Task</button>
            )}
            <button className="secondary" onClick={() => setMode("employer")}>See as Employer</button>
          </div>
        </section>
      )}

      {mode === "employer" && (
        <section className="employer">
          <h2>Your Hiring Need</h2>
          <p>{hiringNeed?.role_problem_summary}</p>
          <div className="skills">
            {hiringNeed?.skill_map.slice(0, 5).map((s) => (
              <span key={s.competency}>{s.competency}</span>
            ))}
          </div>
          <h3>Task Pack</h3>
          {hiringNeed?.tasks.map((t) => (
            <div key={t.id} className="task-item">
              <strong>{t.title}</strong>
              <span>{t.time_limit_minutes}m</span>
            </div>
          ))}
          <h3>Ranked Candidates</h3>
          {shortlist.length === 0 ? (
            <p>No candidates yet</p>
          ) : (
            shortlist.map((c) => (
              <div key={c.candidate_id} className="candidate">
                <strong>{c.candidate_name}</strong>
                <span>{c.average_score}</span>
                <small>{c.recommended_action}</small>
              </div>
            ))
          )}
          <button className="secondary" onClick={() => setMode("start")}>Back</button>
        </section>
      )}
    </div>
  );
}

export default App;