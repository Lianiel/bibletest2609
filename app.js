(function () {
  'use strict';

  const BANK_SIZE = QUESTIONS.length;
  const TEST_SIZE = 50;
  const STORAGE_KEY = 'daily-water-quiz-202609-v1';
  let currentTest = null;
  let currentIndex = 0;
  let answers = {};
  let submitted = false;

  const $ = (id) => document.getElementById(id);

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { usedIds: [], runs: [] };
    } catch (_) {
      return { usedIds: [], runs: [] };
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function chooseQuestions() {
    const state = readState();
    const available = QUESTIONS.filter((q) => !state.usedIds.includes(q.id));
    let selected;
    let nextUsed;
    let roundReset = false;

    if (available.length >= TEST_SIZE) {
      selected = shuffle(available).slice(0, TEST_SIZE);
      nextUsed = state.usedIds.concat(selected.map((q) => q.id));
    } else {
      roundReset = true;
      const remaining = shuffle(available);
      const oldPool = shuffle(QUESTIONS.filter((q) => !remaining.some((r) => r.id === q.id)));
      selected = remaining.concat(oldPool).slice(0, TEST_SIZE);
      nextUsed = selected.map((q) => q.id);
    }

    const run = { id: Date.now(), questionIds: selected.map((q) => q.id), score: null, roundReset };
    writeState({ usedIds: nextUsed, runs: state.runs.concat(run).slice(-100) });
    return selected;
  }

  function renderTest() {
    $('start-panel').classList.add('hidden');
    $('quiz-panel').classList.remove('hidden');
    $('result-panel').classList.add('hidden');
    $('new-test-button').classList.add('hidden');
    $('submit-button').disabled = false;
    $('previous-button').classList.remove('hidden');
    $('next-button').classList.remove('hidden');
    $('score-label').textContent = '尚未交卷';
    submitted = false;
    currentIndex = 0;
    answers = {};
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderQuestion() {
    const q = currentTest[currentIndex];
    const form = $('quiz-form');
    const selectedAnswer = answers[q.id] || '';
    const hasAnswer = Object.prototype.hasOwnProperty.call(answers, q.id);
    const isCorrect = hasAnswer && selectedAnswer === q.answer;
    const options = q.options.map((option, i) => {
      const letter = String.fromCharCode(65 + i);
      let stateClass = '';
      if (hasAnswer) {
        stateClass = letter === q.answer ? 'answer-correct' : (letter === selectedAnswer ? 'answer-wrong' : 'answer-muted');
      }
      return `<label class="option ${stateClass}"><input type="radio" name="${q.id}" value="${letter}" ${selectedAnswer === letter ? 'checked' : ''} ${hasAnswer || submitted ? 'disabled' : ''}>${letter} ${option}</label>`;
    }).join('');
    const correct = hasAnswer && selectedAnswer === q.answer;
    const feedback = hasAnswer ? `<p class="answer-note">${correct ? '答對' : `答錯；正確答案：${q.answer} ${q.options[q.answer.charCodeAt(0) - 65]}`}</p>` : '';
    form.innerHTML = `<article class="question-card ${hasAnswer ? (isCorrect ? 'correct' : 'incorrect') : ''}" data-question-id="${q.id}"><h2>${currentIndex + 1}. ${q.question}</h2>${options}${feedback}</article>`;
    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        if (!Object.prototype.hasOwnProperty.call(answers, q.id)) {
          answers[q.id] = input.value;
          renderQuestion();
        }
      });
    });
    $('progress-label').textContent = `第${currentIndex + 1}題／共${TEST_SIZE}題`;
    const answered = currentTest.filter((item) => Object.prototype.hasOwnProperty.call(answers, item.id));
    const correctCount = answered.filter((item) => answers[item.id] === item.answer).length;
    const wrongCount = answered.length - correctCount;
    $('score-label').textContent = submitted ? `得分 ${correctCount}/${TEST_SIZE}` : `答對 ${correctCount}｜答錯 ${wrongCount}`;
    $('previous-button').disabled = currentIndex === 0;
    $('next-button').textContent = '下一題 →';
    $('next-button').classList.toggle('hidden', currentIndex === TEST_SIZE - 1 || !hasAnswer);
    $('submit-button').classList.toggle('hidden', currentIndex !== TEST_SIZE - 1 || !hasAnswer || submitted);
    if (submitted) {
      $('previous-button').disabled = currentIndex === 0;
      $('previous-button').classList.remove('hidden');
      $('next-button').classList.toggle('hidden', currentIndex === TEST_SIZE - 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitTest() {
    if (submitted) return;
    if (currentTest.some((q) => !Object.prototype.hasOwnProperty.call(answers, q.id))) return;
    submitted = true;
    let score = 0;
    const details = [];
    currentTest.forEach((q, index) => {
      const answer = answers[q.id] || '';
      const correct = answer === q.answer;
      if (correct) score += 1;
      if (!correct) details.push(`第${index + 1}題 ${q.id}：正確答案 ${q.answer} ${q.options[q.answer.charCodeAt(0) - 65]}`);
    });

    const state = readState();
    const lastRun = state.runs[state.runs.length - 1];
    if (lastRun) lastRun.score = score;
    writeState(state);
    $('score-label').textContent = `得分 ${score}/${TEST_SIZE}`;
    $('submit-button').disabled = true;
    $('submit-button').classList.add('hidden');
    $('next-button').classList.toggle('hidden', currentIndex === TEST_SIZE - 1);
    $('new-test-button').classList.remove('hidden');
    $('result-panel').classList.remove('hidden');
    $('result-summary').textContent = `本次答對 ${score} 題，共 ${TEST_SIZE} 題。`;
    $('result-details').innerHTML = details.length ? details.slice(0, 20).map((d) => `<div class="result-item">${d}</div>`).join('') : '<div class="result-item">全部答對，太棒了！</div>';
    $('result-title').textContent = score === TEST_SIZE ? '全部答對' : '測驗完成';
    renderQuestion();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  function refreshStats() {
    const state = readState();
    $('bank-count').textContent = BANK_SIZE;
    $('used-count').textContent = state.usedIds.length;
    $('status-message').textContent = state.runs.length ? `已完成 ${state.runs.length} 次測驗；下一次會優先抽取本輪尚未出現的題目。` : '尚未有測驗紀錄。';
  }

  $('start-button').addEventListener('click', () => { currentTest = chooseQuestions(); renderTest(); });
  $('submit-button').addEventListener('click', submitTest);
  $('previous-button').addEventListener('click', () => { if (currentIndex > 0) { currentIndex -= 1; renderQuestion(); } });
  $('next-button').addEventListener('click', () => { if (currentIndex < TEST_SIZE - 1) { currentIndex += 1; renderQuestion(); } });
  $('new-test-button').addEventListener('click', () => { currentTest = chooseQuestions(); refreshStats(); renderTest(); });
  refreshStats();
})();
