import React from "react";
import { isoToLocalInput, localInputToIso } from "../questionLogic.js";

/**
 * The input for one question, chosen by its type:
 *   boolean -> Yes / No        integer / decimal -> number       date / time / dateTime -> pickers
 *   string / url -> text       text -> multi-line               quantity -> "12 mL/min"
 *   choice -> radio / select / checkboxes (repeats)            open-choice -> text with suggestions
 * Repeating non-choice questions take one value per line.
 * props: question, values (array of text), onChange(linkId, values).
 */
export default function QuestionInput(props) {
  const question = props.question;
  const values = props.values || [];
  const first = values.length > 0 ? values[0] : "";
  const disabled = question.readOnly;
  const options = question.options || [];

  function setOne(value) {
    props.onChange(question.linkId, value === "" ? [] : [value]);
  }

  function handleText(event) {
    setOne(event.target.value);
  }

  function handleLines(event) {
    const lines = event.target.value.split("\n");
    props.onChange(question.linkId, lines);
  }

  function handleDateTime(event) {
    setOne(localInputToIso(event.target.value));
  }

  function handleRadio(event) {
    setOne(event.target.value);
  }

  function handleClear() {
    props.onChange(question.linkId, []);
  }

  function handleCheckbox(event) {
    const code = event.target.value;
    const copy = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== code) {
        copy.push(values[i]);
      }
    }
    if (event.target.checked) {
      copy.push(code);
    }
    props.onChange(question.linkId, copy);
  }

  // ------------------------------------------------------------ option renderers
  function renderRadio(option) {
    return (
      <label key={option.code} className="check">
        <input type="radio" name={question.linkId} value={option.code} checked={first === option.code} onChange={handleRadio} disabled={disabled} />
        {option.display || option.code}
      </label>
    );
  }
  function renderCheckbox(option) {
    return (
      <label key={option.code} className="check">
        <input type="checkbox" value={option.code} checked={values.indexOf(option.code) >= 0} onChange={handleCheckbox} disabled={disabled} />
        {option.display || option.code}
      </label>
    );
  }
  function renderOption(option) {
    return <option key={option.code} value={option.code}>{option.display || option.code}</option>;
  }
  function renderDataOption(option) {
    return <option key={option.code} value={option.code}>{option.display}</option>;
  }

  // ------------------------------------------------------------ boolean
  if (question.type === "boolean") {
    return (
      <div className="options">
        <label className="check"><input type="radio" name={question.linkId} value="true" checked={first === "true"} onChange={handleRadio} disabled={disabled} /> Yes</label>
        <label className="check"><input type="radio" name={question.linkId} value="false" checked={first === "false"} onChange={handleRadio} disabled={disabled} /> No</label>
        {first !== "" && !disabled ? <button type="button" className="link" onClick={handleClear}>clear</button> : null}
      </div>
    );
  }

  // ------------------------------------------------------------ choice with listed options
  if (question.type === "choice" && options.length > 0) {
    if (question.repeats) {
      return <div className="options">{options.map(renderCheckbox)}</div>;
    }
    if (options.length <= 5) {
      return (
        <div className="options">
          {options.map(renderRadio)}
          {first !== "" && !disabled ? <button type="button" className="link" onClick={handleClear}>clear</button> : null}
        </div>
      );
    }
    return (
      <select value={first} onChange={handleText} disabled={disabled}>
        <option value="">(choose)</option>
        {options.map(renderOption)}
      </select>
    );
  }

  // ------------------------------------------------------------ open-choice: free text with suggestions
  if (question.type === "open-choice") {
    const listId = "options-" + question.linkId;
    return (
      <div>
        <input list={listId} value={first} onChange={handleText} disabled={disabled} placeholder="choose or type" />
        <datalist id={listId}>{options.map(renderDataOption)}</datalist>
      </div>
    );
  }

  // ------------------------------------------------------------ repeating free-text questions: one value per line
  if (question.repeats) {
    return <textarea rows={3} value={values.join("\n")} onChange={handleLines} disabled={disabled} placeholder="one answer per line" />;
  }

  // ------------------------------------------------------------ single values
  if (question.type === "integer") {
    return <input type="number" step="1" value={first} onChange={handleText} disabled={disabled} />;
  }
  if (question.type === "decimal") {
    return <input type="number" step="any" value={first} onChange={handleText} disabled={disabled} />;
  }
  if (question.type === "date") {
    return <input type="date" value={first} onChange={handleText} disabled={disabled} />;
  }
  if (question.type === "dateTime") {
    return <input type="datetime-local" value={isoToLocalInput(first)} onChange={handleDateTime} disabled={disabled} />;
  }
  if (question.type === "time") {
    return <input type="time" step="1" value={first} onChange={handleText} disabled={disabled} />;
  }
  if (question.type === "text") {
    return <textarea rows={3} value={first} onChange={handleText} disabled={disabled} maxLength={question.maxLength || undefined} />;
  }
  if (question.type === "url") {
    return <input type="url" value={first} onChange={handleText} disabled={disabled} placeholder="https://" />;
  }
  if (question.type === "quantity") {
    return <input value={first} onChange={handleText} disabled={disabled} placeholder="number and unit, e.g. 12 mL/min" />;
  }
  if (question.type === "choice") {
    return <input value={first} onChange={handleText} disabled={disabled} placeholder={"code from " + (question.optionsValueSet || "the payer value set")} />;
  }
  if (question.type === "attachment" || question.type === "reference") {
    return <p className="muted small">This question type ({question.type}) is not supported here; the payer's own process applies.</p>;
  }
  return <input value={first} onChange={handleText} disabled={disabled} maxLength={question.maxLength || undefined} />;
}
