const WEB3FORMS_ACCESS_KEY = "4246d9d8-447f-41fa-a923-4d14a9850a37";
const SUBMISSION_TIMEOUT_MS = 15_000;

const form = document.querySelector("#interest-form");
const gearChoices = document.querySelector("#gear-choices");
const gearError = document.querySelector("#gear-error");
const contactError = document.querySelector("#contact-error");
const result = document.querySelector("#submit-result");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");

const instrumentInputs = [...document.querySelectorAll('input[name="instrument"]')];

function updateGearChoices() {
  const selected = instrumentInputs.filter((input) => input.checked);
  gearChoices.replaceChildren();

  for (const input of selected) {
    if (input.value === "Singing") continue;

    const choice = document.createElement("div");
    choice.className = "gear-choice";
    const prompt = document.createElement("p");
    prompt.textContent = `For ${input.value}:`;
    choice.append(prompt);

    if (input.dataset.available) {
      const note = document.createElement("p");
      note.className = "available-note";
      note.textContent = input.dataset.available;
      choice.append(note);
    }

    const options = document.createElement("div");
    options.className = "choice-options";
    options.setAttribute("role", "radiogroup");
    options.setAttribute("aria-label", `Will you bring your own ${input.value}?`);
    const groupName = `gear-${instrumentInputs.indexOf(input)}`;
    const ownLabel = document.createElement("label");
    const ownInput = document.createElement("input");
    ownInput.type = "radio";
    ownInput.name = groupName;
    ownInput.value = "I'll bring my own instrument";
    ownInput.required = true;
    ownLabel.append(ownInput, " I'll bring my own");

    const borrowLabel = document.createElement("label");
    const borrowInput = document.createElement("input");
    borrowInput.type = "radio";
    borrowInput.name = groupName;
    borrowInput.value = input.dataset.available ? "I'd like to use the instrument available here" : "I don't need an instrument / I'd like to borrow one";
    borrowInput.required = true;
    borrowLabel.append(borrowInput, input.dataset.available ? " I'd like to use the instrument available here" : " I don't need an instrument / I'd like to borrow one");

    options.append(ownLabel, borrowLabel);
    choice.append(options);
    gearChoices.append(choice);
  }
}

function buildMessage() {
  const data = new FormData(form);
  const instruments = instrumentInputs.filter((input) => input.checked).map((input) => {
    if (input.value === "Singing") return `- ${input.value}`;

    const gearChoice = form.querySelector(`input[name="gear-${instrumentInputs.indexOf(input)}"]:checked`);
    return `- ${input.value}: ${gearChoice?.value ?? "no preference given"}`;
  });
  const availability = data.getAll("availability");

  return [
    "Hi! I'm interested in the woonkamer jam in Nijmegen.",
    "",
    "What I play or would like to try:",
    instruments.length ? instruments.join("\n") : "- No instrument chosen yet / I might come to listen",
    "",
    `Availability: ${availability.length ? availability.join(", ") : "no preference given"}`,
    `Email: ${data.get("email") || "not provided"}`,
    `Phone: ${data.get("phone") || "not provided"}`,
    "",
    "Anything else:",
    data.get("note") || "nothing to add",
  ].join("\n");
}

form.addEventListener("change", (event) => {
  if (event.target.matches('input[name="instrument"]')) {
    updateGearChoices();
    gearError.hidden = true;
  } else if (event.target.matches('input[type="radio"]')) {
    const allChoicesMade = instrumentInputs.filter((input) => input.checked && input.value !== "Singing").every((input) =>
      form.querySelector(`input[name="gear-${instrumentInputs.indexOf(input)}"]:checked`),
    );
    if (allChoicesMade) gearError.hidden = true;
  }
});

form.addEventListener("input", () => {
  const email = emailInput.value.trim();
  const phone = form.elements.namedItem("phone").value.trim();
  if (nameInput.value.trim() && (email || phone) && (!email || emailInput.checkValidity())) {
    contactError.hidden = true;
    nameInput.removeAttribute("aria-invalid");
    emailInput.removeAttribute("aria-invalid");
    form.elements.namedItem("phone").removeAttribute("aria-invalid");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = form.elements.namedItem("phone").value.trim();

  const instrumentsWithoutGearChoice = instrumentInputs.filter((input) =>
    input.checked && input.value !== "Singing" && !form.querySelector(`input[name="gear-${instrumentInputs.indexOf(input)}"]:checked`),
  );
  if (instrumentsWithoutGearChoice.length) {
    gearError.hidden = false;
    form.querySelector(`input[name="gear-${instrumentInputs.indexOf(instrumentsWithoutGearChoice[0])}"]`).focus();
    return;
  }

  if (!name || (!email && !phone) || (email && !emailInput.checkValidity())) {
    contactError.textContent = !name
      ? "Please enter your name."
      : !email && !phone
        ? "Please provide an email address or phone number so we can get in touch."
        : "Please check that your email address is valid.";
    contactError.hidden = false;
    if (!name) {
      nameInput.setAttribute("aria-invalid", "true");
      nameInput.focus();
    } else if (!email && !phone) {
      emailInput.setAttribute("aria-invalid", "true");
      form.elements.namedItem("phone").setAttribute("aria-invalid", "true");
      emailInput.focus();
    } else {
      emailInput.setAttribute("aria-invalid", "true");
      nameInput.removeAttribute("aria-invalid");
      emailInput.focus();
    }
    return;
  }

  contactError.hidden = true;
  nameInput.removeAttribute("aria-invalid");
  emailInput.removeAttribute("aria-invalid");
  form.elements.namedItem("phone").removeAttribute("aria-invalid");
  const message = buildMessage();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Sending…";
  result.replaceChildren();
  result.hidden = false;
  result.textContent = "Sending your interest…";
  result.focus();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUBMISSION_TIMEOUT_MS);

  try {
    const formData = new FormData(form);
    formData.set("name", name);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("subject", "Interest in the woonkamer jam");
    formData.set("message", message);
    formData.append("access_key", WEB3FORMS_ACCESS_KEY);

    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      throw new Error("The form service returned an unreadable response. Please try again later.");
    }

    if (!response.ok || !responseData || !responseData.success) {
      throw new Error(responseData?.message || "The form service could not send your message. Please try again later.");
    }

    const heading = document.createElement("h3");
    heading.textContent = "Thanks for getting in touch!";
    const explanation = document.createElement("p");
    explanation.textContent = "Your interest has been sent. The jam organiser will be in touch.";
    result.replaceChildren(heading, explanation);
    form.reset();
    updateGearChoices();
  } catch (error) {
    const heading = document.createElement("h3");
    const explanation = document.createElement("p");
    if (error instanceof Error && error.name === "AbortError") {
      heading.textContent = "We couldn't confirm your submission";
      explanation.textContent = "The form service did not respond within 15 seconds, so we can't tell whether it received your message.";
    } else {
      heading.textContent = "Your message could not be sent";
      explanation.textContent = error instanceof Error
        ? `${error.message} Your details are still in the form, so you can retry.`
        : "An unexpected error occurred. Your details are still in the form, so you can retry.";
    }
    result.replaceChildren(heading, explanation);
  } finally {
    clearTimeout(timeoutId);
    submitButton.disabled = false;
    submitButton.innerHTML = 'Send my interest <span aria-hidden="true">↗</span>';
  }

  result.hidden = false;
});

updateGearChoices();
