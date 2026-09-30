// =====================================================================================================
// Payer Gateway DTR form API, used by the questionnaire app:
//   GET  {gateway}/api/v1/dtr/forms/{formId}           the questions (+ answers saved so far)
//   POST {gateway}/api/v1/dtr/forms/{formId}/answers   save answers -> FHIR QuestionnaireResponse at the Provider FHIR API
// The gateway URL, API key and formId come from the link the EHR opened (query string).
// =====================================================================================================

/** Reads formId, gateway and apiKey from the page URL. */
export function readLaunchParameters() {
  const query = new URLSearchParams(window.location.search);
  return {
    formId: query.get("formId") || "",
    gatewayUrl: (query.get("gateway") || "http://localhost:5200").replace(/\/$/, ""),
    apiKey: query.get("apiKey") || ""
  };
}

/** Error with the gateway's message and details list. */
export class GatewayError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || [];
  }
}

async function send(launch, path, method, body) {
  const headers = { Accept: "application/json" };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (launch.apiKey) {
    headers["X-Api-Key"] = launch.apiKey;
  }

  let response;
  try {
    response = await fetch(launch.gatewayUrl + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
  } catch (networkError) {
    throw new GatewayError("Cannot reach the Payer Gateway at " + launch.gatewayUrl + ".", 0, []);
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (parseError) {
    json = null;
  }
  if (!response.ok) {
    const message = json && json.error ? json.error : "The gateway returned HTTP " + response.status + ".";
    throw new GatewayError(message, response.status, json && json.details ? json.details : []);
  }
  return json;
}

/** The form: questions, status, saved answers. */
export function loadForm(launch) {
  return send(launch, "/api/v1/dtr/forms/" + encodeURIComponent(launch.formId), "GET", null);
}

/** Saves answers. complete = true -> status completed (all required questions must be answered). */
export function saveAnswers(launch, answers, complete) {
  return send(launch, "/api/v1/dtr/forms/" + encodeURIComponent(launch.formId) + "/answers", "POST", {
    answers: answers,
    complete: complete
  });
}
