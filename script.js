const QUESTION_TIME = 15;
const STARTING_LIVES = 3;
const POINTS_PER_CORRECT = 10;
const QUESTIONS_PER_SESSION = 20;

// Country dataset definition (full master pool mapped to local SVG files).
const countrySlugs = [
  'afghanistan','albania','algeria','angola','argentina','armenia','australia','austria','azerbaijan','bahamas','bahrain','bangladesh','belarus','belgium','belize','benin','bhutan','bolivia','botswana','brazil','brunei-darussalam','bulgaria','burundi','cambodia','cameroon','canada','central-african-republic','chad','chile','china','colombia','comoros','costa-rica','cote-divoire','croatia','cuba','cyprus','czech-republic','democratic-republic-of-the-congo','denmark','djibouti','dominica','dominican-republic','ecuador','egypt','el-salvador','equatorial-guinea','eritrea','estonia','ethiopia','fiji','finland','france','gabon','gambia','georgia','germany','ghana','greece','grenada','guatemala','guinea','guinea-bissau','guyana','haiti','honduras','hungary','iceland','india','indonesia','iran','iraq','ireland','israel','italy','jamaica','japan','jordan','kazakhstan','kenya','kiribati','kuwait','kyrgyzstan','laos','latvia','lebanon','lesotho','liberia','libya','liechtenstein','lithuania','luxembourg','madagascar','malawi','malaysia','maldives','mali','malta','marshall-islands','mauritania','mauritius','mexico','micronesia','moldova','monaco','mongolia','montenegro','morocco','mozambique','myanmar','namibia','nauru','nepal','netherlands','new-zealand','nicaragua','niger','nigeria','north-korea','north-macedonia','norway','oman','pakistan','panama','papua-new-guinea','paraguay','peru','philippines','poland','portugal','qatar','republic-of-the-congo','romania','russian-federation','rwanda','saint-kitts-and-nevis','saint-lucia','saint-vincent-and-the-grenadines','samoa','san-marino','sao-tome-and-principe','saudi-arabia','senegal','seychelles','sierra-leone','singapore','slovakia','slovenia','solomon-islands','somalia','south-africa','south-korea','south-sudan','spain','sri-lanka','sudan','suriname','swaziland','sweden','switzerland','syrian-arab-republic','taiwan','tajikistan','tanzania','thailand','timor-leste','togo','tonga','trinidad-and-tobago','tunisia','turkey','turkmenistan','tuvalu','uganda','ukraine','united-arab-emirates','united-kingdom','united-states','uruguay','uzbekistan','vanuatu','vatican-city','venezuela','vietnam','yemen','zambia','zimbabwe'
];

const specialNames = {
  'brunei-darussalam': 'Brunei Darussalam',
  'central-african-republic': 'Central African Republic',
  'cote-divoire': "Cote d'Ivoire",
  'democratic-republic-of-the-congo': 'Democratic Republic of the Congo',
  'north-korea': 'North Korea',
  'republic-of-the-congo': 'Republic of the Congo',
  'russian-federation': 'Russian Federation',
  'saint-kitts-and-nevis': 'Saint Kitts and Nevis',
  'saint-lucia': 'Saint Lucia',
  'saint-vincent-and-the-grenadines': 'Saint Vincent and the Grenadines',
  'sao-tome-and-principe': 'Sao Tome and Principe',
  'syrian-arab-republic': 'Syrian Arab Republic',
  'timor-leste': 'Timor-Leste',
  'united-arab-emirates': 'United Arab Emirates',
  'united-kingdom': 'United Kingdom',
  'united-states': 'United States',
  'vatican-city': 'Vatican City'
};

function toDisplayName(slug) {
  if (specialNames[slug]) return specialNames[slug];
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const countries = countrySlugs.map((slug) => ({
  name: toDisplayName(slug),
  flag: `assets/flags/${slug}.svg`
}));

const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const endScreen = document.getElementById('endScreen');
const startGameBtn = document.getElementById('startGameBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const questionCount = document.getElementById('questionCount');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const flagImage = document.getElementById('flagImage');
const answersEl = document.getElementById('answers');
const feedbackEl = document.getElementById('feedback');
const finalMessage = document.getElementById('finalMessage');
const finalScore = document.getElementById('finalScore');

let sessionQuestions = [];
let currentIndex = 0;
let score = 0;
let lives = STARTING_LIVES;
let secondsLeft = QUESTION_TIME;
let timerId = null;
let acceptingInput = false;
let soundEnabled = true;

const sounds = {
  correct: new Audio('assets/sounds/correct.mp3'),
  wrong: new Audio('assets/sounds/wrong.mp3'),
  click: new Audio('assets/sounds/click.mp3'),
  start: new Audio('assets/sounds/start.mp3'),
  end: new Audio('assets/sounds/end.mp3')
};

Object.values(sounds).forEach((audio) => {
  audio.preload = 'auto';
  audio.addEventListener('error', () => {
    audio.datasetUnavailable = 'true';
  });
});

function playSound(name) {
  // Sounds trigger here; gracefully skip if file is missing or sound is off.
  const sound = sounds[name];
  if (!soundEnabled || !sound || sound.datasetUnavailable === 'true') return;
  try {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch (_error) {
    // Ignore unsupported playback errors.
  }
}

function setScreen(activeScreen) {
  startScreen.classList.toggle('active', activeScreen === 'start');
  gameScreen.classList.toggle('active', activeScreen === 'game');
  endScreen.classList.toggle('active', activeScreen === 'end');
}

function shuffle(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateHud() {
  questionCount.textContent = `Question ${Math.min(currentIndex + 1, sessionQuestions.length)} / ${sessionQuestions.length}`;
  // Score updates happen here.
  scoreDisplay.textContent = `Score: ${score}`;
  // Lives update happens here.
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

  // Timer logic runs here.
  timerId = setInterval(() => {
    secondsLeft -= 1;
    timerDisplay.textContent = `Time: ${secondsLeft}s`;
    if (secondsLeft <= 5) timerDisplay.classList.add('urgent');
    if (secondsLeft <= 0) handleTimeout();
  }, 1000);
}

function createChoices(correctCountryName) {
  const wrongPool = countries.filter((country) => country.name !== correctCountryName);
  const wrongChoices = shuffle(wrongPool).slice(0, 3).map((country) => country.name);
  // Answer choices are randomized here.
  return shuffle([correctCountryName, ...wrongChoices]);
}

function disableAnswers() {
  answersEl.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
}

function decorateAnswers(correctName, selectedName) {
  answersEl.querySelectorAll('button').forEach((button) => {
    if (button.textContent === correctName) {
      button.classList.add('correct');
    } else if (selectedName && button.textContent === selectedName) {
      button.classList.add('wrong');
    }
  });
}

function queueNextQuestion() {
  setTimeout(() => {
    currentIndex += 1;
    renderQuestion();
  }, 900);
}

function endGame() {
  stopTimer();
  setScreen('end');
  playSound('end'); // End sound trigger.

  if (lives <= 0) {
    finalMessage.textContent = 'You ran out of lives. Keep practicing and try again!';
  } else {
    finalMessage.textContent = 'Excellent work! You completed your session.';
  }

  finalScore.textContent = `Final Score: ${score} / ${sessionQuestions.length * POINTS_PER_CORRECT}`;
}

function renderQuestion() {
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

  if (currentIndex >= sessionQuestions.length || lives <= 0) {
    endGame();
    return;
  }

  const question = sessionQuestions[currentIndex];
  const choices = createChoices(question.name);

  flagImage.src = question.flag;
  flagImage.alt = `Flag of ${question.name}`;

  answersEl.innerHTML = '';
  choices.forEach((choice) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-btn';
    button.textContent = choice;
    button.addEventListener('click', () => handleAnswer(choice, question.name));
    answersEl.appendChild(button);
  });

  acceptingInput = true;
  updateHud();
  startTimer();
}

function handleAnswer(selectedName, correctName) {
  if (!acceptingInput) return;

  acceptingInput = false;
  stopTimer();
  disableAnswers();

  if (selectedName === correctName) {
    score += POINTS_PER_CORRECT;
    feedbackEl.textContent = '✅ Correct!';
    feedbackEl.classList.add('ok');
    playSound('correct'); // Correct answer sound trigger.
  } else {
    lives -= 1;
    feedbackEl.textContent = `❌ Incorrect. Correct answer: ${correctName}`;
    feedbackEl.classList.add('error');
    playSound('wrong'); // Wrong answer sound trigger.
  }

  decorateAnswers(correctName, selectedName);
  updateHud();

  if (lives <= 0) {
    setTimeout(endGame, 900);
    return;
  }

  queueNextQuestion();
}

function handleTimeout() {
  if (!acceptingInput) return;

  acceptingInput = false;
  stopTimer();
  lives -= 1;

  const question = sessionQuestions[currentIndex];
  feedbackEl.textContent = `⏰ Time up. Correct answer: ${question.name}`;
  feedbackEl.classList.add('error');

  disableAnswers();
  decorateAnswers(question.name, null);
  updateHud();
  playSound('wrong'); // Timeout uses wrong sound trigger.

  if (lives <= 0) {
    setTimeout(endGame, 900);
    return;
  }

  queueNextQuestion();
}

function startGame() {
  // Session question pool is created here from full dataset.
  // Question order is shuffled here so each game starts differently.
  sessionQuestions = shuffle(countries).slice(0, QUESTIONS_PER_SESSION);
  // Repeat prevention is enforced by consuming each sessionQuestions item once via currentIndex.

  currentIndex = 0;
  score = 0;
  lives = STARTING_LIVES;
  secondsLeft = QUESTION_TIME;

  setScreen('game');
  playSound('start'); // Start sound trigger.
  renderQuestion();
}

async function toggleFullscreen() {
  const container = document.getElementById('gameApp');
  try {
    // Fullscreen starts here.
    if (!document.fullscreenElement) {
      await container.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    // Fullscreen can fail in some mobile/embedded browser contexts.
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundToggleBtn.textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';
  soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled));
  playSound('click'); // UI click sound trigger.
}

function setupLogoFallbacks() {
  document.querySelectorAll('[data-logo-wrap]').forEach((wrap) => {
    const img = wrap.querySelector('[data-brand-logo]');
    if (!img) return;

    const showFallback = () => {
      wrap.classList.add('logo-missing');
    };

    img.addEventListener('error', showFallback, { once: true });

    if (img.complete && img.naturalWidth === 0) {
      showFallback();
    }
  });
}

startGameBtn.addEventListener('click', () => {
  playSound('click');
  startGame();
});

playAgainBtn.addEventListener('click', () => {
  playSound('click');
  startGame();
});

fullscreenBtn.addEventListener('click', () => {
  playSound('click');
  toggleFullscreen();
});

soundToggleBtn.addEventListener('click', toggleSound);

setupLogoFallbacks();
setScreen('start');
