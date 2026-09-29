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
    const feedback = hasAnswer
      ? `<p class="answer-note">${correct ? '<span class="feedback-correct">答對</span>' : `<span class="feedback-wrong">答錯</span><span class="feedback-answer-row"><span class="feedback-label">正確答案：</span><span class="feedback-answer">${q.answer} ${q.options[q.answer.charCodeAt(0) - 65]}</span></span>`}</p>`
      : '';
    // Keep feedback and navigation immediately above the answer choices, matching
    // the established mobile quiz layout.
    $('actions').appendChild($('next-button'));
    $('actions').appendChild($('submit-button'));
    document.querySelector('.quiz-toolbar').appendChild($('score-block'));
    form.innerHTML = `<article class="question-card ${hasAnswer ? (isCorrect ? 'correct' : 'incorrect') : ''}" data-question-id="${q.id}"><h2>${currentIndex + 1}. ${q.question}<span class="question-inline-nav"></span></h2><div class="question-nav-slot"></div>${options}</article>`;
    const questionCard = form.querySelector('.question-card');
    const questionInlineNav = questionCard.querySelector('.question-inline-nav');
    const questionNavSlot = questionCard.querySelector('.question-nav-slot');
    if (hasAnswer && !submitted) {
      questionInlineNav.appendChild(currentIndex < TEST_SIZE - 1 ? $('next-button') : $('submit-button'));
    }
    if (hasAnswer) questionNavSlot.insertAdjacentHTML('beforeend', feedback);
    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        if (!Object.prototype.hasOwnProperty.call(answers, q.id)) {
          answers[q.id] = input.value;
          renderQuestion();
        }
      });
    });
    $('progress-label').textContent = `${currentIndex + 1} / ${TEST_SIZE}`;
    const answered = currentTest.filter((item) => Object.prototype.hasOwnProperty.call(answers, item.id));
    const correctCount = answered.filter((item) => answers[item.id] === item.answer).length;
    const wrongCount = answered.length - correctCount;
    $('correct-count').textContent = correctCount;
    $('wrong-count').textContent = wrongCount;
    $('previous-button').disabled = currentIndex === 0;
    $('next-button').textContent = '下一題';
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
    readState();
  }

  function setupLineBrowserPrompt() {
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const isLine = /Line\//i.test(ua);
    const prompt = $('browser-prompt');
    if (!prompt || !isMobile || !isLine || sessionStorage.getItem('daily-water-browser-prompt-seen')) return;

    prompt.classList.remove('hidden');
    $('stay-in-line').addEventListener('click', () => {
      sessionStorage.setItem('daily-water-browser-prompt-seen', '1');
      prompt.classList.add('hidden');
    });
    $('open-default-browser').addEventListener('click', () => {
      sessionStorage.setItem('daily-water-browser-prompt-seen', '1');
      const current = new URL(window.location.href);
      const target = `${current.host}${current.pathname}${current.search}${current.hash}`;
      if (/Android/i.test(ua)) {
        window.location.href = `intent://${target}#Intent;scheme=https;end`;
      } else if (/iPhone|iPad|iPod/i.test(ua)) {
        window.location.href = `x-safari-https://${target}`;
      } else {
        window.open(window.location.href, '_blank', 'noopener');
      }
    });
  }

  $('start-button').addEventListener('click', () => { currentTest = chooseQuestions(); renderTest(); });
  $('submit-button').addEventListener('click', submitTest);
  $('previous-button').addEventListener('click', () => { if (currentIndex > 0) { currentIndex -= 1; renderQuestion(); } });
  $('next-button').addEventListener('click', () => { if (currentIndex < TEST_SIZE - 1) { currentIndex += 1; renderQuestion(); } });
  $('new-test-button').addEventListener('click', () => { currentTest = chooseQuestions(); refreshStats(); renderTest(); });
  refreshStats();
  setupLineBrowserPrompt();
})();
