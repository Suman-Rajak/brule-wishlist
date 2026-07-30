/* Paste your deployed Google Apps Script Web App URL here */
const SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbyPxUi88blFVt5PVy6bv_fpsdJVUDV4Oa9NCSPqKGT7hfAZ8svIovYztyGWU9Iqhgf3/exec";

const form       = document.getElementById("waitlistForm");
const submitBtn  = document.getElementById("submitBtn");
const btnLabel   = submitBtn.querySelector(".btn__label");
const successMsg = document.getElementById("successMsg");
const successText = document.getElementById("successText");

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^[0-9]{10}$/;

function setError(field, msg) {
  const input = document.getElementById(field);
  document.getElementById(field + "Err").textContent = msg || "";
  input.closest(".field").classList.toggle("is-invalid", Boolean(msg));
}

function validate(data) {
  const errors = {};

  if (!data.name) errors.name = "Please enter your name.";
  if (!data.email) errors.email = "Please enter your email.";
  else if (!emailRe.test(data.email)) errors.email = "That email doesn't look right.";
  if (data.phone && !phoneRe.test(data.phone)) errors.phone = "Enter a 10-digit number, or leave it blank.";

  ["name", "email", "phone"].forEach((f) => setError(f, errors[f]));

  const firstBad = Object.keys(errors)[0];
  if (firstBad) document.getElementById(firstBad).focus();

  return Object.keys(errors).length === 0;
}

/* Clear a field's error as soon as the user starts fixing it */
["name", "email", "phone"].forEach((f) => {
  document.getElementById(f).addEventListener("input", () => setError(f, ""));
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    name:  document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
  };

  if (!validate(data)) return;

  submitBtn.disabled = true;
  btnLabel.textContent = "Joining…";

  try {
    await fetch(SHEET_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });

    successText.textContent =
      `Thanks ${data.name} — we'll write to ${data.email} the moment Brulé opens.`;
    form.hidden = true;
    successMsg.hidden = false;
    successMsg.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (err) {
    submitBtn.disabled = false;
    btnLabel.textContent = "Join the waitlist";
    setError("email", "Couldn't reach the server. Please try again.");
  }
});

/* Gift images that aren't in place yet fade out and leave the placeholder texture */
document.querySelectorAll(".gift__media img").forEach((img) => {
  img.addEventListener("error", () => img.classList.add("is-missing"));
});

/* FAQ accordion */
document.querySelectorAll(".faq__item").forEach((item) => {
  const btn = item.querySelector(".faq__q");
  btn.addEventListener("click", () => {
    const isOpen = item.classList.contains("is-open");
    item.classList.toggle("is-open", !isOpen);
    btn.setAttribute("aria-expanded", String(!isOpen));
  });
});
