import React, { useEffect, useState } from "react";
import { readLaunchParameters, loadForm, saveAnswers } from "./api.js";
import { initialValues, isVisible, isAnswerable, hasValue } from "./questionLogic.js";
import QuestionInput from "./components/QuestionInput.jsx";

/**
 * Payer questionnaire (DTR) app - a separate app the EHR opens with ?formId=...&gateway=...
 *   1. loads the form from the Payer Gateway (questions from the payer's Questionnaire)
 *   2. shows the questions; hidden questions (showWhen) appear when their condition is met
 *   3. "Save draft" (in-progress) or "Submit" (completed) -> the gateway builds the FHIR QuestionnaireResponse
 *   4. tells the EHR window (postMessage "dtr-form-saved") so it refreshes the status
 */
export default function App() {
  const launch = readLaunchParameters();
  const [form, setForm] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typedFormId, setTypedFormId] = useState("");
  const [typedGateway, setTypedGateway] = useState(launch.gatewayUrl);

  async function load() {
    if (!launch.formId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadForm(launch);
      setForm(loaded);
      setValues(initialValues(loaded));
    } catch (loadError) {
      setError(loadError);
    }
    setLoading(false);
  }
  function startLoading() {
    load();
  }
  useEffect(startLoading, []);

  function handleValueChange(linkId, newValues) {
    const copy = Object.assign({}, values);
    copy[linkId] = newValues;
    setValues(copy);
    setResult(null);
  }

  /** Visible questions get their values; hidden ones are sent empty so old answers are removed. */
  function buildAnswers() {
    const answers = [];
    for (let i = 0; i < form.questions.length; i++) {
      const question = form.questions[i];
      if (!isAnswerable(question)) {
        continue;
      }
      const visible = isVisible(question, values);
      const list = [];
      const current = values[question.linkId] || [];
      for (let j = 0; j < current.length; j++) {
        if (String(current[j]).trim() !== "") {
          list.push(String(current[j]).trim());
        }
      }
      answers.push({ linkId: question.linkId, values: visible ? list : [] });
    }
    return answers;
  }

  /** Required visible questions without a value (checked here first; the gateway checks again). */
  function missingRequired() {
    const missing = [];
    for (let i = 0; i < form.questions.length; i++) {
      const question = form.questions[i];
      if (question.required && isAnswerable(question) && isVisible(question, values) && !hasValue(values, question.linkId)) {
        missing.push(question.text);
      }
    }
    return missing;
  }

  async function save(complete) {
    setError(null);
    setResult(null);
    if (complete) {
      const missing = missingRequired();
      if (missing.length > 0) {
        setError({ message: "Please answer the required questions:", details: missing });
        return;
      }
    }
    setBusy(true);
    try {
      const saved = await saveAnswers(launch, buildAnswers(), complete);
      setResult(saved);
      if (saved.adaptive && (saved.newQuestions > 0 || saved.moreQuestionsExpected)) {
        // Adaptive: the payer added question(s) after reading our answers - reload them, keep what was typed.
        const reloaded = await loadForm(launch);
        setForm(reloaded);
        setValues(keepTypedValues(initialValues(reloaded), values));
      } else {
        setForm(Object.assign({}, form, { status: saved.status, questionnaireResponseId: saved.questionnaireResponseId, moreQuestionsExpected: false }));
      }
      if (window.opener) {
        window.opener.postMessage({ type: "dtr-form-saved", formId: launch.formId, status: saved.status }, "*");
      }
    } catch (saveError) {
      setError(saveError);
    }
    setBusy(false);
  }

  /** Starts from the defaults of the reloaded form and puts back every value the user already typed. */
  function keepTypedValues(defaults, typed) {
    const merged = Object.assign({}, defaults);
    const keys = Object.keys(typed);
    for (let i = 0; i < keys.length; i++) {
      merged[keys[i]] = typed[keys[i]];
    }
    return merged;
  }

  function handleDraft() {
    save(false);
  }

  function handleSubmit(event) {
    event.preventDefault();
    save(true);
  }

  function handleTypedFormId(event) {
    setTypedFormId(event.target.value);
  }

  function handleTypedGateway(event) {
    setTypedGateway(event.target.value);
  }

  /** Reloads the page with ?formId=...&gateway=... (same link the EHR opens). */
  function handleOpenTyped(event) {
    event.preventDefault();
    window.location.search = "?formId=" + encodeURIComponent(typedFormId.trim()) + "&gateway=" + encodeURIComponent(typedGateway.trim());
  }

  function handleClose() {
    window.close();
  }

  // ------------------------------------------------------------ renderers
  function renderDetail(detail, index) {
    return <li key={index}>{String(detail)}</li>;
  }

  function renderQuestions() {
    const rows = [];
    let lastGroup = null;
    for (let i = 0; i < form.questions.length; i++) {
      const question = form.questions[i];
      if (!isVisible(question, values)) {
        continue;
      }
      if (question.groupText && question.groupText !== lastGroup) {
        rows.push(<h3 key={"group-" + i} className="q-group">{question.groupText}</h3>);
        lastGroup = question.groupText;
      }
      if (question.type === "display") {
        rows.push(<p key={question.linkId} className="question-display">{question.text}</p>);
        continue;
      }
      rows.push(
        <div key={question.linkId} className="question">
          <div className="question-text">
            {question.text}
            {question.required ? <span className="required" title="required">*</span> : null}
            <span className="question-meta">{question.type}{question.repeats ? ", several allowed" : ""}{question.readOnly ? ", filled by the payer" : ""}</span>
          </div>
          <QuestionInput question={question} values={values[question.linkId]} onChange={handleValueChange} />
        </div>
      );
    }
    return rows;
  }

  function countAnswered() {
    let answered = 0;
    let total = 0;
    for (let i = 0; i < form.questions.length; i++) {
      const question = form.questions[i];
      if (isAnswerable(question) && isVisible(question, values)) {
        total++;
        if (hasValue(values, question.linkId)) {
          answered++;
        }
      }
    }
    return answered + " of " + total + " answered";
  }

  // ------------------------------------------------------------ page
  let body;
  if (!launch.formId) {
    body = (
      <form className="card form" onSubmit={handleOpenTyped}>
        <h2>No questionnaire selected</h2>
        <p>Open this app from the EHR: order &rarr; <strong>Prior auth</strong> &rarr; <strong>Open questionnaire</strong>
          (in the coverage card, or in step 2 after <strong>Get questionnaire</strong>).</p>
        <div className="grid">
          <label>Form id<input value={typedFormId} onChange={handleTypedFormId} placeholder="frm-..." /></label>
          <label>Payer Gateway URL<input value={typedGateway} onChange={handleTypedGateway} /></label>
        </div>
        <div className="actions"><button type="submit" className="primary" disabled={!typedFormId.trim()}>Open form</button></div>
      </form>
    );
  } else if (loading) {
    body = <p className="muted">Loading questionnaire...</p>;
  } else if (!form) {
    body = null;
  } else {
    body = (
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="facts">
            <div><span>Patient</span><strong>{form.patientId}</strong></div>
            <div><span>Orders</span><strong>{form.orderIds.join(", ")}</strong></div>
            <div><span>Insurance plan id</span><strong>{form.piInsurancePlanId}</strong></div>
            <div><span>Status</span><span className={"badge " + (form.status === "completed" ? "badge-good" : "badge-warn")}>{form.status}</span></div>
          </div>
          <div className="small muted mono">{form.questionnaireUrl}</div>
        </div>

        {form.adaptive ? (
          <div className="alert alert-info">
            <strong>Adaptive questionnaire.</strong> The payer sends the questions step by step: answer what you see and press
            {" "}<strong>Send answers / next questions</strong>. When the payer has no more questions, the form can be submitted.
          </div>
        ) : null}

        {form.questions.length === 0 ? (
          <div className="alert alert-warn">
            The payer returned this questionnaire without questions. Check the Payer Gateway log for the $next-question call.
          </div>
        ) : (
          <div className="card">{renderQuestions()}</div>
        )}

        {result ? (
          <div className="alert alert-info">
            <strong>Saved as {result.status}.</strong> QuestionnaireResponse <span className="mono">{result.questionnaireResponseId}</span> ({result.answeredCount} answers).
            {result.adaptive && result.newQuestions > 0 ? " The payer added " + result.newQuestions + " new question(s) below. Answer them and send again." : ""}
            {result.status === "completed" ? " It will be attached to the prior authorization request. You can close this window." : ""}
            {result.missingRequired && result.missingRequired.length > 0 ? <div>Still required: {result.missingRequired.join("; ")}</div> : null}
            {result.warnings && result.warnings.length > 0 ? <ul>{result.warnings.map(renderDetail)}</ul> : null}
          </div>
        ) : null}

        <div className="sticky-actions">
          <button type="button" onClick={handleDraft} disabled={busy}>Save draft</button>
          <button type="submit" className="primary" disabled={busy}>{busy ? "Saving..." : (form.moreQuestionsExpected ? "Send answers / next questions" : "Submit questionnaire")}</button>
          {result && result.status === "completed" ? <button type="button" onClick={handleClose}>Close window</button> : null}
          <span className="progress">{countAnswered()}</span>
        </div>
      </form>
    );
  }

  return (
    <div>
      <header className="q-header">
        <h1>{form && form.title ? form.title : "Payer questionnaire"}</h1>
        <div className="muted small">Documentation Templates and Rules (DTR) &middot; form {launch.formId || "-"}</div>
      </header>
      <main className="q-page">
        {error ? (
          <div className="alert alert-error" role="alert">
            <strong>{error.message}</strong>
            {error.details && error.details.length > 0 ? <ul>{error.details.map(renderDetail)}</ul> : null}
          </div>
        ) : null}
        {body}
      </main>
    </div>
  );
}
