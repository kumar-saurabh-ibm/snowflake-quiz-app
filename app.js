const API = {
  categories: "https://vcykge5cy9.execute-api.us-west-2.amazonaws.com/Stage-1/",
  questions: "https://coavjcqfvd.execute-api.us-west-2.amazonaws.com/Stage-1"
};

const state = {
  allQuestions: [],
  questions: [],
  answers: [],
  current: 0,
  timerId: null,
  remainingSeconds: 0,
  settings: {
    timed: false,
    minutes: 30,
    answerMode: "end"
  }
};

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $("setupScreen"),
  quiz: $("quizScreen"),
  results: $("resultsScreen")
};

function showScreen(name) {
  // Hide or show the next/prev buttons based on the screen
  if(name == 'setup' || name == 'results') {
    $('nextBtn').classList.add('hidden');
    $('prevBtn').classList.add('hidden');
  } else {
    $('nextBtn').classList.remove('hidden');
    $('prevBtn').classList.remove('hidden');
  }

  Object.values(screens).forEach(s => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
  $("restartBtn").classList.toggle("hidden", name === "setup");
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

function normalizeQuestion(q, topic) {
  const rawAnswer = q.Answer ?? q.Anwer ?? q.answer ?? q.anwer ?? [];
  const answers = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
  const options = Array.isArray(q.Options) ? q.Options : [];

  return {
    topic,
    question: String(q.Question ?? ""),
    options,
    answers: answers.map(a => String(a).trim().toUpperCase()).filter(Boolean),
    explanation: String(q.Explanation ?? "")
  };
}

function normalizeCategories(data) {
  if (Array.isArray(data)) return data.map(String);
  if (Array.isArray(data?.categories)) return data.categories.map(String);
  if (Array.isArray(data?.Topics)) return data.Topics.map(String);
  if (typeof data === "object" && data) {
    const possible = Object.values(data).find(v => Array.isArray(v) && v.every(x => typeof x === "string"));
    if (possible) return possible;
  }
  return [];
}

async function loadCategories() {
  try {
    const data = await fetchJSON(API.categories);
    const formattedData = JSON.parse(data?.body); // Ensure it's a plain object
    const categories = normalizeCategories(formattedData['topics']);
    //console.log("Loaded categories:", typeof(formattedData), formattedData['topics'], categories);
    if (!categories.length) throw new Error("The categories API returned no topics.");

    const topics = $("topics");
    topics.innerHTML = "";
    categories.forEach((topic, i) => {
      const id = `topic_${i}`;
      const wrapper = document.createElement("div");
      wrapper.className = "topic-item";
      wrapper.innerHTML = `
        <input type="checkbox" id="${id}" value="${escapeAttr(topic)}">
        <label class="topic-label" for="${id}">
          <span class="topic-check">✓</span>
          <span class="topic-name">${escapeHtml(topic)}</span>
        </label>`;
      topics.appendChild(wrapper);
    });

    $("topicCount").textContent = `${categories.length} available`;
    topics.addEventListener("change", updateQuestionAvailability);
  } catch (error) {
    $("topics").innerHTML = "";
    showSetupError(`Could not load topics. ${error.message}`);
  }
}

async function loadQuestionsForSelectedTopics() {
  const selected = getSelectedTopics();
  if (!selected.length) return [];

  const results = await Promise.all(selected.map(async topic => {
    const url = `${API.questions}?topic=${encodeURIComponent(topic)}`;
    const fetchedData = await fetchJSON(url);
    const data = (fetchedData?.objects)[0]['content']['Data']

    console.log("Loaded questions for topic:", topic, (fetchedData?.objects)[0]['content']['Data']);

    // Expected shape: { Topic, Data: [...] }
    if (Array.isArray(data)) {
      return data.map(q => normalizeQuestion(q, topic));
    }

    return (Array.isArray(data?.Data) ? data.Data : [])
      .map(q => normalizeQuestion(q, data?.Topic || topic));
  }));

  return results.flat().filter(q => q.question && q.options.length);
}

async function updateQuestionAvailability() {
  const selected = getSelectedTopics();
  $("startBtn").disabled = true;
  $("availableCount").textContent = selected.length
    ? "Loading questions…"
    : "Select topics to see available questions.";

  if (!selected.length) {
    $("questionCount").max = 1;
    $("questionCount").value = 1;
    return;
  }

  try {
    state.allQuestions = await loadQuestionsForSelectedTopics();
    const count = state.allQuestions.length;

    $("availableCount").textContent = `${count.toLocaleString()} question${count === 1 ? "" : "s"} available`;
    $("questionCount").max = Math.max(count, 1);

    let current = parseInt($("questionCount").value, 10) || 1;
    current = Math.min(Math.max(current, 1), Math.max(count, 1));
    $("questionCount").value = current;

    $("startBtn").disabled = count === 0;
    if (count === 0) showSetupError("No questions were returned for the selected topic(s).");
    else clearSetupError();
  } catch (error) {
    state.allQuestions = [];
    $("availableCount").textContent = "Could not load questions.";
    $("startBtn").disabled = true;
    showSetupError(`Could not load questions. ${error.message}`);
  }
}

function getSelectedTopics() {
  return [...document.querySelectorAll("#topics input:checked")].map(i => i.value);
}

function showSetupError(message) {
  $("setupError").textContent = message;
  $("setupError").classList.remove("hidden");
}
function clearSetupError() {
  $("setupError").classList.add("hidden");
}

function clampQuestionCount() {
  const max = state.allQuestions.length || parseInt($("questionCount").max, 10) || 1;
  let value = parseInt($("questionCount").value, 10);
  if (!Number.isFinite(value)) value = 1;
  value = Math.min(Math.max(value, 1), max);
  $("questionCount").value = value;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectedAnswerLetters() {
  return [...document.querySelectorAll("#options .option.selected")].map(el => el.dataset.letter);
}

function isCorrect(question, selected) {
  const expected = [...new Set(question.answers)].sort();
  const actual = [...new Set(selected)].sort();
  return expected.length === actual.length && expected.every((x, i) => x === actual[i]);
}

function startQuiz() {
  clampQuestionCount();
  const count = Number($("questionCount").value);

  if (!state.allQuestions.length || count < 1 || count > state.allQuestions.length) return;

  state.questions = shuffle(state.allQuestions).slice(0, count);
  state.answers = Array.from({ length: count }, () => []);
  state.current = 0;
  state.settings.timed = document.querySelector('input[name="timerMode"]:checked').value === "timed";
  state.settings.minutes = Math.max(1, Number($("timerMinutes").value) || 30);
  state.settings.answerMode = document.querySelector('input[name="answerMode"]:checked').value;

  $("quizTopics").textContent = getSelectedTopics().join(" • ");
  $("timerBox").classList.toggle("hidden", !state.settings.timed);
  showScreen("quiz");
  renderQuestion();

  if (state.settings.timed) startTimer();
}

function renderQuestion() {
  const q = state.questions[state.current];
  const multi = q.answers.length > 1;

  $("progressText").textContent = `Question ${state.current + 1} of ${state.questions.length}`;
  $("questionNumber").textContent = String(state.current + 1).padStart(2, "0");
  $("progressBar").style.width = `${((state.current + 1) / state.questions.length) * 100}%`;
  $("questionText").textContent = q.question;
  $("questionType").textContent = multi ? "Multiple answer" : "Single answer";
  $("multipleHint").classList.toggle("hidden", !multi);

  const options = $("options");
  options.innerHTML = "";
  q.options.forEach((text, i) => {
    const letter = String.fromCharCode(65 + i);
    const div = document.createElement("div");
    div.className = "option";
    div.dataset.letter = letter;
    div.innerHTML = `<span class="option-badge">${letter}</span><span class="option-text">${escapeHtml(text)}</span>`;
    div.addEventListener("click", () => selectOption(div, multi));
    options.appendChild(div);
  });

  const saved = state.answers[state.current] || [];
  saved.forEach(letter => {
    const el = options.querySelector(`[data-letter="${CSS.escape(letter)}"]`);
    if (el) el.classList.add("selected");
  });

  $("prevBtn").disabled = state.current === 0;
  $("nextBtn").textContent = state.current === state.questions.length - 1 ? "Finish test ✓" : "Next →";
  $("show-answer").style.display = state.settings.answerMode === "instant" ? "block" : "none";

  $("instantFeedback").className = "feedback hidden";
  $("explanation").classList.add("hidden");

  if (state.settings.answerMode === "instant" && saved.length) {
    revealInstantAnswer();
  }
}

function selectOption(element, multi) {
  if (multi) {
    element.classList.toggle("selected");
  } else {
    document.querySelectorAll("#options .option").forEach(o => o.classList.remove("selected"));
    element.classList.add("selected");
  }

  state.answers[state.current] = selectedAnswerLetters();

  // At the end, update the live score even if not in instant mode, so the user can see their progress.
  updateLiveScore();
}

function revealInstantAnswer() {
  const q = state.questions[state.current];
  const selected = state.answers[state.current] || [];
  const correct = isCorrect(q, selected);

  document.querySelectorAll("#options .option").forEach(el => {
    el.classList.add("disabled");
    if (q.answers.includes(el.dataset.letter)) el.classList.add("correct");
    else if (selected.includes(el.dataset.letter)) el.classList.add("incorrect");
  });

  $("instantFeedback").className = `feedback ${correct ? "correct" : "incorrect"}`;
  $("instantFeedback").textContent = correct
    ? "Correct."
    : `Incorrect. Correct answer${q.answers.length > 1 ? "s" : ""}: ${q.answers.join(", ")}`;

  if (q.explanation.trim()) {
    $("explanationText").textContent = q.explanation;
    $("explanation").classList.remove("hidden");
  }
}

function updateLiveScore() {
  const correct = state.questions.reduce((total, q, i) =>
    total + (state.answers[i]?.length ? (isCorrect(q, state.answers[i]) ? 1 : 0) : 0), 0);
  $("scoreLive").textContent = `${correct} correct`;
}

function nextQuestion() {
  if (!state.answers[state.current]?.length && state.settings.answerMode === "end") {
    // Allow unanswered questions; no blocking.
  }

  if (state.current === state.questions.length - 1) {
    finishQuiz();
    return;
  }
  state.current++;
  renderQuestion();
  updateLiveScore();
}

function previousQuestion() {
  if (state.current > 0) {
    state.current--;
    renderQuestion();
    updateLiveScore();
  }
}

function startTimer() {
  clearInterval(state.timerId);
  state.remainingSeconds = state.settings.minutes * 60;
  updateTimer();

  state.timerId = setInterval(() => {
    state.remainingSeconds--;
    updateTimer();

    if (state.remainingSeconds <= 0) {
      clearInterval(state.timerId);
      finishQuiz(true);
    }
  }, 1000);
}

function updateTimer() {
  const m = Math.floor(state.remainingSeconds / 60);
  const s = state.remainingSeconds % 60;
  $("timerBox").textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  $("timerBox").classList.toggle("warning", state.remainingSeconds <= 60);
}

function finishQuiz(timeUp = false) {
  clearInterval(state.timerId);

  const correct = state.questions.reduce((total, q, i) =>
    total + (isCorrect(q, state.answers[i] || []) ? 1 : 0), 0);
  const answered = state.answers.filter(a => a?.length).length;
  const total = state.questions.length;
  const incorrect = answered - correct;
  const unanswered = total - answered;
  const percent = total ? Math.round((correct / total) * 100) : 0;

  $("resultTitle").textContent = timeUp ? "Time is up." : "Your results";
  $("resultSubtitle").textContent = `${getSelectedTopics().join(", ")} • ${total} questions`;
  $("finalPercent").textContent = `${percent}%`;
  $("scoreRing")?.style.setProperty("--percent", `${percent}%`);
  document.querySelector(".score-ring").style.setProperty("--percent", `${percent}%`);
  $("finalScore").textContent = `${correct} / ${total}`;
  $("correctStat").textContent = correct;
  $("incorrectStat").textContent = incorrect;
  $("unansweredStat").textContent = unanswered;

  renderReview();
  showScreen("results");
}

function renderReview() {
  const list = $("reviewList");
  list.innerHTML = "";

  state.questions.forEach((q, i) => {
    const selected = state.answers[i] || [];
    const correct = isCorrect(q, selected);
    const statusClass = !selected.length ? "unanswered" : (correct ? "correct" : "incorrect");
    const status = !selected.length ? "Unanswered" : (correct ? "Correct" : "Incorrect");

    const item = document.createElement("details");
    item.className = "review-item";
    item.innerHTML = `
      <summary>
        <span class="review-status ${statusClass}">${status}</span>
        Q${i + 1}. ${escapeHtml(q.question)}
      </summary>
      <div class="review-detail">
        <strong>Your answer:</strong> ${selected.length ? selected.join(", ") : "—"}<br>
        <strong>Correct answer${q.answers.length > 1 ? "s" : ""}:</strong> ${q.answers.join(", ")}
        ${q.explanation.trim() ? `<div class="explanation" style="margin-top:10px"><div class="explanation-title">Explanation</div>${escapeHtml(q.explanation)}</div>` : ""}
      </div>`;
    list.appendChild(item);
  });
}

function restart() {
  clearInterval(state.timerId);
  state.current = 0;
  state.questions = [];
  state.answers = [];
  showScreen("setup");
  updateQuestionAvailability();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(value) { return escapeHtml(value); }


// Events
$("show-answer").addEventListener("click", revealInstantAnswer);
$("startBtn").addEventListener("click", startQuiz);
$("nextBtn").addEventListener("click", nextQuestion);
$("prevBtn").addEventListener("click", previousQuestion);
$("restartBtn").addEventListener("click", restart);
$("takeAgainBtn").addEventListener("click", restart);

$("questionCount").addEventListener("input", clampQuestionCount);
$("minusBtn").addEventListener("click", () => {
  $("questionCount").value = Math.max(1, (Number($("questionCount").value) || 1) - 1);
  clampQuestionCount();
});
$("plusBtn").addEventListener("click", () => {
  $("questionCount").value = (Number($("questionCount").value) || 1) + 1;
  clampQuestionCount();
});

document.querySelectorAll('input[name="timerMode"]').forEach(input => {
  input.addEventListener("change", () => {
    $("timerSettings").classList.toggle("hidden", input.value !== "timed" || !input.checked);
  });
});

// Initially diable the next and previous buttons until the quiz starts
  $('nextBtn').classList.add('hidden');
  $('prevBtn').classList.add('hidden');

loadCategories();
