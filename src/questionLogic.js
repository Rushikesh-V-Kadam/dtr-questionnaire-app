// =====================================================================================================
// Which questions to show (showWhen) and helpers for answer values. Same rules as the gateway's
// QuestionnaireResponseBuilder: numbers compare as numbers, everything else as text.
// =====================================================================================================

/** Starting values: saved answers, else the payer's default values. linkId -> [text values]. */
export function initialValues(form) {
  const values = {};
  for (let i = 0; i < form.questions.length; i++) {
    const question = form.questions[i];
    if (question.currentValues && question.currentValues.length > 0) {
      values[question.linkId] = question.currentValues.slice();
    } else if (question.defaultValues && question.defaultValues.length > 0) {
      values[question.linkId] = question.defaultValues.slice();
    } else {
      values[question.linkId] = [];
    }
  }
  return values;
}

/** True when the question should be shown for the current answers. */
export function isVisible(question, values) {
  const rules = question.showWhen || [];
  if (rules.length === 0) {
    return true;
  }
  const any = question.showWhenBehavior === "any";
  for (let i = 0; i < rules.length; i++) {
    const matches = ruleMatches(rules[i], values);
    if (any && matches) {
      return true;
    }
    if (!any && !matches) {
      return false;
    }
  }
  return !any;
}

/** One showWhen rule. */
function ruleMatches(rule, values) {
  const answers = values[rule.questionLinkId] || [];
  const filled = [];
  for (let i = 0; i < answers.length; i++) {
    if (String(answers[i]).trim() !== "") {
      filled.push(String(answers[i]).trim());
    }
  }

  if (rule.operator === "exists") {
    const expected = String(rule.value).toLowerCase() !== "false";
    return (filled.length > 0) === expected;
  }
  for (let i = 0; i < filled.length; i++) {
    if (compare(filled[i], String(rule.value), rule.operator)) {
      return true;
    }
  }
  return rule.operator === "!=" && filled.length === 0;
}

/** Compares numbers as numbers, text as text. */
function compare(actual, expected, operator) {
  let result;
  const left = Number(actual);
  const right = Number(expected);
  if (actual !== "" && expected !== "" && !isNaN(left) && !isNaN(right)) {
    result = left === right ? 0 : (left > right ? 1 : -1);
  } else if (operator === "=" || operator === "!=") {
    result = actual.toLowerCase() === expected.toLowerCase() ? 0 : 1;
  } else {
    result = actual === expected ? 0 : (actual > expected ? 1 : -1);
  }
  if (operator === "=") return result === 0;
  if (operator === "!=") return result !== 0;
  if (operator === ">") return result > 0;
  if (operator === "<") return result < 0;
  if (operator === ">=") return result >= 0;
  if (operator === "<=") return result <= 0;
  return false;
}

/** Question types that take an answer. */
export function isAnswerable(question) {
  return question.type !== "display" && question.type !== "attachment" && question.type !== "reference";
}

/** True when the question has at least one non-empty value. */
export function hasValue(values, linkId) {
  const list = values[linkId] || [];
  for (let i = 0; i < list.length; i++) {
    if (String(list[i]).trim() !== "") {
      return true;
    }
  }
  return false;
}

/** ISO date-time -> "yyyy-MM-ddTHH:mm" for <input type="datetime-local">. */
export function isoToLocalInput(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().substring(0, 16);
}

/** "yyyy-MM-ddTHH:mm" from the input -> ISO with Z (FHIR dateTime with a time needs a time zone). */
export function localInputToIso(local) {
  if (!local) {
    return "";
  }
  const date = new Date(local);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}
