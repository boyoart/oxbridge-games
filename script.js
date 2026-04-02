const QUESTION_TIME = 15;
const STARTING_LIVES = 3;

const flags = [
  { country: 'France', file: 'assets/flags/france.svg' },
  { country: 'Germany', file: 'assets/flags/germany.svg' },
  { country: 'Italy', file: 'assets/flags/italy.svg' },
  { country: 'Japan', file: 'assets/flags/japan.svg' },
  { country: 'Sweden', file: 'assets/flags/sweden.svg' },
  { country: 'Brazil', file: 'assets/flags/brazil.svg' },
  { country: 'Canada', file: 'assets/flags/canada.svg' },
  { country: 'Nigeria', file: 'assets/flags/nigeria.svg' },
  { country: 'India', file: 'assets/flags/india.svg' },
  { country: 'Mexico', file: 'assets/flags/mexico.svg' },
  { country: 'South Korea', file: 'assets/flags/south-korea.svg' },
  { country: 'Argentina', file: 'assets/flags/argentina.svg' },
  { country: 'Turkey', file: 'assets/flags/turkey.svg' },
  { country: 'United States', file: 'assets/flags/usa.svg' },
  { country: 'Australia', file: 'assets/flags/australia.svg' },
  { country: 'Spain', file: 'assets/flags/spain.svg' }
];

const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const endScreen = document.getElementById('endScreen');
const startGameBtn = document.getElementById('startGameBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const questionCount = document.getElementById('questionCount');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const flagImage = document.getElementById('flagImage');
const answersEl = document.getElementById('answers');
const feedbackEl = document.getElementById('feedback');
const finalMessage = document.getElementById('finalMessage');
const finalScore = document.getElementById('finalScore');

let questions = [];
let currentIndex = 0;
let score = 0;
let lives = STARTING_LIVES;
let secondsLeft = QUESTION_TIME;
let timerId = null;
let acceptingInput = false;


function handleMissingLogo(img) {
  img.classList.add('is-hidden');
  const container = img.closest('.brand-mark-wrap, .end-brand-wrap');
  if (container) {
    container.classList.add('logo-missing');
  }
}

function initializeBrandLogos() {
  const logos = document.querySelectorAll('.brand-logo');
  logos.forEach((img) => {
    const checkAndHandle = () => {
      if (!img.complete || img.naturalWidth > 0) return;
      handleMissingLogo(img);
    };

    img.addEventListener('error', () => handleMissingLogo(img), { once: true });

    if (img.complete) {
      checkAndHandle();
    } else {
      img.addEventListener('load', checkAndHandle, { once: true });
    }
  });
}

function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setScreen(active) {
  startScreen.classList.toggle('active', active === 'start');
  gameScreen.classList.toggle('active', active === 'game');
  endScreen.classList.toggle('active', active === 'end');
}

function makeChoices(correctCountry) {
  const wrong = shuffle(flags.filter((f) => f.country !== correctCountry)).slice(0, 3);
  const choices = shuffle([correctCountry, ...wrong.map((item) => item.country)]);
  return choices;
}

function updateHud() {
  questionCount.textContent = `Question ${currentIndex + 1} / ${questions.length}`;
  scoreDisplay.textContent = `Score: ${score}`;
  livesDisplay.textContent = `Lives: ${'❤'.repeat(lives)}${'♡'.repeat(STARTING_LIVES - lives)}`;
  timerDisplay.textContent = `Time: ${secondsLeft}s`;
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  stopTimer();
  secondsLeft = QUESTION_TIME;
  timerDisplay.classList.remove('urgent');
  timerDisplay.textContent = `Time: ${secondsLeft}s`;

  timerId = setInterval(() => {
    secondsLeft -= 1;
    timerDisplay.textContent = `Time: ${secondsLeft}s`;

    if (secondsLeft <= 5) {
      timerDisplay.classList.add('urgent');
    }

    if (secondsLeft <= 0) {
      handleTimeout();
    }
  }, 1000);
}

function renderQuestion() {
  feedbackEl.textContent = '';

  if (currentIndex >= questions.length || lives <= 0) {
    endGame();
    return;
  }

  const current = questions[currentIndex];
  const choices = makeChoices(current.country);

  flagImage.src = current.file;
  flagImage.alt = 'Flag to identify';
  answersEl.innerHTML = '';

  choices.forEach((choice) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answer-btn';
    btn.textContent = choice;
    btn.addEventListener('click', () => handleAnswer(choice, current.country));
    answersEl.appendChild(btn);
  });

  acceptingInput = true;
  updateHud();
  startTimer();
}

function disableAnswers() {
  const buttons = answersEl.querySelectorAll('button');
  buttons.forEach((btn) => { btn.disabled = true; });
}

function decorateAnswers(correctCountry, selectedChoice) {
  const buttons = answersEl.querySelectorAll('button');
  buttons.forEach((btn) => {
    if (btn.textContent === correctCountry) {
      btn.classList.add('correct');
    } else if (selectedChoice && btn.textContent === selectedChoice) {
      btn.classList.add('wrong');
    }
  });
}

function nextQuestionSoon() {
  setTimeout(() => {
    currentIndex += 1;
    renderQuestion();
  }, 1000);
}

function handleAnswer(choice, correctCountry) {
  if (!acceptingInput) return;

  acceptingInput = false;
  stopTimer();
  disableAnswers();

  if (choice === correctCountry) {
    score += 1;
    feedbackEl.textContent = '✅ Correct!';
  } else {
    lives -= 1;
    feedbackEl.textContent = `❌ Incorrect. Correct answer: ${correctCountry}`;
  }

  decorateAnswers(correctCountry, choice);
  updateHud();

  if (lives <= 0) {
    setTimeout(endGame, 1000);
    return;
  }

  nextQuestionSoon();
}

function handleTimeout() {
  if (!acceptingInput) return;

  acceptingInput = false;
  stopTimer();
  lives -= 1;

  const current = questions[currentIndex];
  feedbackEl.textContent = `⏰ Time's up! Correct answer: ${current.country}`;

  disableAnswers();
  decorateAnswers(current.country, null);
  updateHud();

  if (lives <= 0) {
    setTimeout(endGame, 1000);
    return;
  }

  nextQuestionSoon();
}

function endGame() {
  stopTimer();
  setScreen('end');

  const finishedAll = currentIndex >= questions.length;
  if (lives <= 0) {
    finalMessage.textContent = 'You ran out of lives!';
  } else if (finishedAll) {
    finalMessage.textContent = 'Great job! You completed all flags.';
  } else {
    finalMessage.textContent = 'Game ended.';
  }

  finalScore.textContent = `Final Score: ${score} / ${questions.length}`;
}

function startGame() {
  questions = shuffle(flags);
  currentIndex = 0;
  score = 0;
  lives = STARTING_LIVES;
  secondsLeft = QUESTION_TIME;

  setScreen('game');
  renderQuestion();
}

async function toggleFullscreen() {
  const root = document.documentElement;
  try {
    if (!document.fullscreenElement) {
      await root.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    // Some browsers block fullscreen in embedded contexts without user permission.
  }
}

startGameBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', startGame);
fullscreenBtn.addEventListener('click', toggleFullscreen);

initializeBrandLogos();
setScreen('start');
