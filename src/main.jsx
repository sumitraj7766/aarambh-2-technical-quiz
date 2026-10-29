import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { Timer, GraduationCap, ShieldCheck, Download, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Trophy, ClipboardList } from "lucide-react";
import "./style.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const db = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const BRANCHES = ["EEE", "ECE", "CSE", "ME", "CE", "IT", "Other"];
const fmt = (seconds) => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2,"0")}:${String(Math.max(0, seconds) % 60).padStart(2,"0")}`;

function App() {
  const [page, setPage] = useState("home");
  const [form, setForm] = useState({ name:"", roll:"", branch:"EEE", examDate:new Date().toISOString().slice(0,10) });
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(1200);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRows, setAdminRows] = useState([]);
  const [adminQuestions, setAdminQuestions] = useState([]);
  const [questionStatus, setQuestionStatus] = useState("");
  const [adminReady, setAdminReady] = useState(false);

  useEffect(() => {
    if (page !== "exam" || !exam) return;
    const tick = async () => {
      const left = Math.max(0, Math.floor((new Date(exam.deadline_at).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0 && !exam.submitted) await submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [page, exam?.id, exam?.deadline_at]);

  const answeredCount = Object.values(answers).filter(Boolean).length;

  function updateForm(k, v) { setForm(p => ({...p, [k]:v})); }

  async function startExam(e) {
    e.preventDefault(); setError("");
    if (!db) return setError("Supabase setup missing. Follow README deployment steps and add your environment variables.");
    if (!form.name.trim() || !form.roll.trim() || !form.branch || !form.examDate) return setError("Please fill in all registration fields.");
    setBusy(true);
    try {
      const { data, error: err } = await db.rpc("start_aarambh_exam", {
        p_name: form.name.trim(), p_roll: form.roll.trim(), p_branch: form.branch, p_exam_date: form.examDate
      });
      if (err) throw err;
      const started = Array.isArray(data) ? data[0] : data;
      if (!started?.attempt_id) throw new Error(started?.message || "Could not start the exam.");
      const { data: qsData, error: qerr } = await db.rpc("get_aarambh_questions");
      if (qerr) throw qerr;
      const qs = Array.isArray(qsData) ? qsData : (qsData || []);
      if (qs.length !== 50) throw new Error(`Quiz setup has ${qs.length} questions; exactly 50 are required.`);
      setExam({ id: started.attempt_id, deadline_at: started.deadline_at, submitted:false });
      setQuestions(qs); setAnswers({}); setRemaining(1200); setPage("exam");
    } catch (err) { setError(err.message || "Could not start the exam."); }
    finally { setBusy(false); }
  }

  async function submit(auto = false) {
    if (!db || !exam || exam.submitted || busy) return;
    setBusy(true); setError("");
    try {
      const { data, error: err } = await db.rpc("submit_aarambh_exam", {
        p_attempt_id: exam.id,
        p_answers: Object.entries(answers).map(([question_id, option_id]) => ({ question_id, option_id })),
        p_auto_submit: auto
      });
      if (err) throw err;
      const row = Array.isArray(data) ? data[0] : data;
      setResult(row);
      setExam(p => ({...p, submitted:true}));
      setPage("result");
    } catch (err) { setError(err.message || "Submission failed. Please try again."); }
    finally { setBusy(false); }
  }

  async function loadAdmin(e) {
    e?.preventDefault(); setError(""); setBusy(true);
    try {
      if (!db) throw new Error("Supabase setup missing. See README.");
      const { data, error: err } = await db.rpc("admin_aarambh_results", { p_password: adminPassword });
      if (err) throw err;
      setAdminRows(data || []); setAdminReady(true);
      const { data: qdata, error: qerr } = await db.rpc("admin_aarambh_questions", { p_password: adminPassword });
      if (qerr) throw qerr;
      setAdminQuestions((qdata || []).map(q => ({id:q.id,question_text:q.question_text,options:Array.isArray(q.options)?q.options:[],correct_option_id:q.correct_option_id})));
    } catch (err) { setAdminReady(false); setError(err.message || "Could not load results."); }
    finally { setBusy(false); }
  }

  async function loadAdminQuestions() {
    setError(""); setQuestionStatus(""); setBusy(true);
    try {
      if (!db) throw new Error("Supabase setup missing. See README.");
      const { data, error: err } = await db.rpc("admin_aarambh_questions", { p_password: adminPassword });
      if (err) throw err;
      setAdminQuestions((data || []).map(q => ({
        id: q.id, question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_option_id: q.correct_option_id
      })));
    } catch (err) { setError(err.message || "Could not load questions."); }
    finally { setBusy(false); }
  }

  function updateAdminQuestion(qIndex, field, value) {
    setAdminQuestions(prev => prev.map((q, i) => i === qIndex ? ({...q, [field]:value}) : q));
  }
  function updateAdminOption(qIndex, optionIndex, value) {
    setAdminQuestions(prev => prev.map((q, i) => i === qIndex ? ({
      ...q, options:q.options.map((opt,j) => j === optionIndex ? ({...opt,label:value}) : opt)
    }) : q));
  }
  async function saveAdminQuestions() {
    setError(""); setQuestionStatus("");
    if (adminQuestions.length !== 50) return setError("Exactly 50 questions are required.");
    for (let i=0;i<adminQuestions.length;i++) {
      const q=adminQuestions[i];
      if (!q.question_text.trim() || q.options.length !== 4 || q.options.some(o=>!o.label?.trim()) || !q.options.some(o=>o.id===q.correct_option_id)) {
        return setError(`Check Question ${i+1}: enter the question, all four options, and choose a correct answer.`);
      }
    }
    setBusy(true);
    try {
      const payload = adminQuestions.map(q => ({
        id:q.id, question_text:q.question_text.trim(),
        options:q.options.map(o=>({id:o.id,label:o.label.trim()})),
        correct_option_id:q.correct_option_id
      }));
      const { data, error: err } = await db.rpc("admin_save_aarambh_questions", {
        p_password: adminPassword, p_questions: payload
      });
      if (err) throw err;
      setQuestionStatus("All 50 questions saved successfully.");
    } catch (err) { setError(err.message || "Could not save questions."); }
    finally { setBusy(false); }
  }

  function downloadCsv() {
    const cols = ["student_name","roll_number","branch","exam_date","started_at","submitted_at","auto_submitted","score","total_questions","correct_count","answered_count"];
    const quote = v => `"${String(v ?? "").replaceAll('"','""')}"`;
    const csv = [cols.join(","), ...adminRows.map(r => cols.map(c => quote(r[c])).join(","))].join("\r\n");
    const blob = new Blob(["\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "aarambh-2-results.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => { if (page !== "exam") {setPage("home"); setError("");} }} aria-label="Aarambh home">
        <span className="brand-mark"><GraduationCap size={24}/></span>
        <span><b>AARAMBH <em>2.0</em></b><small>TECHNICAL QUIZ CHALLENGE</small></span>
      </button>
      <button className="admin-link" onClick={() => { if (page !== "exam") {setPage("admin");setError("");setAdminReady(false);} }}>Organizer dashboard ↗</button>
    </header>

    <main>
      {page === "home" && <section className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow"><span className="live-dot"/> ONLINE EXAMINATION</span>
          <h1>Think fast.<br/><span>Build the future.</span></h1>
          <p className="lead">Welcome to the Aarambh 2.0 Technical Quiz. Test your technical knowledge in a focused, timed challenge.</p>
          <div className="stats-row">
            <div className="stat"><ClipboardList/><b>50</b><small>Questions</small></div>
            <div className="stat"><Timer/><b>20 min</b><small>Time limit</small></div>
            <div className="stat"><ShieldCheck/><b>1 attempt</b><small>Per roll number</small></div>
          </div>
        </div>
        <form className="panel registration" onSubmit={startExam}>
          <div className="panel-heading"><div><span className="eyebrow">GET STARTED</span><h2>Student registration</h2></div><span className="step-pill">STEP 01</span></div>
          <label>Full name<input value={form.name} onChange={e=>updateForm("name",e.target.value)} placeholder="Enter your full name" maxLength="100" required /></label>
          <label>College roll number<input value={form.roll} onChange={e=>updateForm("roll",e.target.value)} placeholder="Enter your roll number" maxLength="40" required /></label>
          <div className="form-two">
            <label>Branch<select value={form.branch} onChange={e=>updateForm("branch",e.target.value)}>{BRANCHES.map(b=><option key={b}>{b}</option>)}</select></label>
            <label>Exam date<input type="date" value={form.examDate} onChange={e=>updateForm("examDate",e.target.value)} required /></label>
          </div>
          <div className="notice"><ShieldCheck size={18}/><span>Timer starts immediately when you begin. You have 20 minutes to submit.</span></div>
          {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
          <button className="primary-btn" disabled={busy} type="submit">{busy ? "Preparing exam…" : "Start exam"} <ArrowRight size={18}/></button>
          <p className="fineprint">By starting, you confirm the registration details are correct. One attempt per roll number.</p>
        </form>
      </section>}

      {page === "exam" && <section className="exam-wrap">
        <div className="exam-head">
          <div><span className="eyebrow">AARAMBH 2.0 · LIVE EXAM</span><h1>Technical Quiz</h1><p>{form.name} · {form.roll} · {form.branch}</p></div>
          <div className={`timer-box ${remaining < 120 ? "urgent" : ""}`}><Timer size={21}/><span><small>TIME REMAINING</small><b>{fmt(remaining)}</b></span></div>
        </div>
        <div className="progress-line"><span style={{width:`${answeredCount/50*100}%`}}/></div>
        <div className="exam-meta"><span>{answeredCount} of 50 answered</span><span>Choose one option for each question</span></div>
        {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
        <div className="question-grid">{questions.map((q,i)=><article className="question-card" id={`q-${i+1}`} key={q.id}>
          <div className="q-title"><span className="q-number">Q{i+1}</span><p>{q.question_text}</p></div>
          <div className="options">{q.options.map((opt,j)=><label className={`option ${answers[q.id]===opt.id?"selected":""}`} key={opt.id}>
            <input type="radio" name={`q-${q.id}`} checked={answers[q.id]===opt.id} onChange={()=>setAnswers(p=>({...p,[q.id]:opt.id}))}/>
            <span className="option-letter">{String.fromCharCode(65+j)}</span><span>{opt.label}</span>
          </label>)}</div>
        </article>)}</div>
        <div className="submit-bar"><div><b>{answeredCount}/50 answered</b><small>{50-answeredCount} unanswered</small></div><button className="primary-btn" disabled={busy} onClick={()=>{if(window.confirm("Submit your quiz now? You cannot change answers after submission.")) submit(false);}}>{busy?"Submitting…":"Submit quiz"} <ArrowRight size={18}/></button></div>
      </section>}

      {page === "result" && <section className="result-panel panel thank-you-panel">
        <div className="result-icon"><CheckCircle2 size={36}/></div>
        <span className="eyebrow">SUBMISSION CONFIRMED</span>
        <h1>Thank you, {form.name}!</h1>
        <p className="thank-you-message">Your Aarambh 2.0 technical quiz has been submitted successfully.</p>
        <div className="thank-you-note">
          <GraduationCap size={24}/>
          <div><b>Best of luck with your results!</b><span>Your performance will be reviewed by the event organizers. Thank you for participating.</span></div>
        </div>
        <p className="privacy-note">Your submission has been recorded for the organizers. Your score will not be displayed here.</p>
        <button className="secondary-btn" onClick={()=>{setPage("home");setForm(p=>({...p,name:"",roll:"",branch:"EEE",examDate:new Date().toISOString().slice(0,10)}));setError("");setResult(null);setAnswers({});setQuestions([]);setExam(null);}}>Back to home</button>
      </section>}

      {page === "admin" && <section className="admin-wrap">
        <div className="exam-head"><div><span className="eyebrow">RESTRICTED ACCESS</span><h1>Organizer dashboard</h1><p>View submissions and export results for Aarambh 2.0.</p></div><span className="admin-shield"><ShieldCheck size={25}/></span></div>
        {!adminReady ? <form className="panel admin-login" onSubmit={loadAdmin}><h2>Organizer sign in</h2><p>Enter the dashboard password configured during setup.</p><label>Dashboard password<input type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} required placeholder="Enter organizer password"/></label>{error&&<div className="error"><AlertTriangle size={17}/>{error}</div>}<button className="primary-btn" disabled={busy}>{busy?"Checking…":"View results"} <ArrowRight size={18}/></button></form> :
          <div className="panel results-panel"><div className="results-toolbar"><div><h2>Quiz submissions</h2><p>{adminRows.length} recorded attempts</p></div><div className="toolbar-actions"><button className="secondary-btn" onClick={()=>loadAdmin()}><RefreshCw size={16}/> Refresh results</button><button className="primary-btn compact" onClick={downloadCsv}><Download size={16}/> Export CSV</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>Student</th><th>Roll no.</th><th>Branch</th><th>Score</th><th>Attempted</th><th>Status</th><th>Submitted</th></tr></thead><tbody>{adminRows.map((r,i)=><tr key={r.attempt_id||i}><td>{r.student_name}</td><td>{r.roll_number}</td><td>{r.branch}</td><td><b>{r.score}/50</b></td><td>{r.answered_count}/50</td><td><span className="status">{r.auto_submitted?"Auto-submit":"Submitted"}</span></td><td>{r.submitted_at?new Date(r.submitted_at).toLocaleString():"—"}</td></tr>)}</tbody></table>{!adminRows.length&&<p className="empty">No submissions yet.</p>}</div>
          </div>}
        {adminReady && <section className="panel question-editor">
          <div className="results-toolbar"><div><h2>Question editor</h2><p>Edit question text, options and answer key. Save to publish changes.</p></div><button className="secondary-btn" onClick={loadAdminQuestions} disabled={busy}><RefreshCw size={16}/> Reload questions</button></div>
          {questionStatus && <div className="success"><CheckCircle2 size={17}/>{questionStatus}</div>}
          {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
          <div className="editor-list">{adminQuestions.map((q,i)=><article className="editor-card" key={q.id}>
            <div className="editor-title"><span className="q-number">Q{i+1}</span><b>Question {i+1}</b></div>
            <label>Question text<textarea value={q.question_text} onChange={e=>updateAdminQuestion(i,"question_text",e.target.value)} rows="2" /></label>
            <div className="editor-options">{q.options.map((opt,j)=><label key={opt.id} className="editor-option"><span>{opt.id}</span><input value={opt.label} onChange={e=>updateAdminOption(i,j,e.target.value)} /><input type="radio" aria-label={`Set option ${opt.id} as correct`} name={`correct-${q.id}`} checked={q.correct_option_id===opt.id} onChange={()=>updateAdminQuestion(i,"correct_option_id",opt.id)}/><small>Correct</small></label>)}</div>
          </article>)}</div>
          <button className="primary-btn save-questions" onClick={saveAdminQuestions} disabled={busy || adminQuestions.length!==50}>{busy?"Saving…":"Save all 50 questions"} <CheckCircle2 size={17}/></button>
          <p className="fineprint">Question changes apply to new attempts. Existing submissions and scores are not recalculated.</p>
        </section>}
      </section>}
    </main>
    <footer><span>© Aarambh 2.0 · Technical Quiz</span><span>Built for learning, designed for focus.</span></footer>
  </div>;
}

createRoot(document.getElementById("root")).render(<App />);
