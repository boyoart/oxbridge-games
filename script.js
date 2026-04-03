(() => {
  const symbols = ["📚", "🔬", "🌍", "✏️", "🏆", "🎵", "🧮", "🚩", "🧠", "📝", "🧪", "📐"];
  const difficulties = {
    easy: { rows: 4, cols: 4 },
    medium: { rows: 4, cols: 5 },
    hard: { rows: 4, cols: 6 }
  };

  const app = document.getElementById("gameApp");
  const board = document.getElementById("gameBoard");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const returnBtn = document.getElementById("returnBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const soundToggle = document.getElementById("soundToggle");
  const difficultySelect = document.getElementById("difficulty");
  const movesCount = document.getElementById("movesCount");
  const matchedCount = document.getElementById("matchedCount");
  const totalPairs = document.getElementById("totalPairs");
  const timeCount = document.getElementById("timeCount");
  const endScreen = document.getElementById("endScreen");
  const endMessage = document.getElementById("endMessage");
  const schoolLogo = document.getElementById("schoolLogo");
  const logoFallback = document.getElementById("logoFallback");

  let cards = [];
  let openCards = [];
  let moves = 0;
  let matches = 0;
  let total = 0;
  let timer = null;
  let seconds = 0;
  let lockBoard = false;
  let gameActive = false;
  let soundOn = true;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const playTone = (type, duration = 0.08, frequency = 440, volume = 0.03) => {
    if (!soundOn) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();

    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    oscillator.stop(audioCtx.currentTime + duration);
  };

  const sounds = {
    button: () => playTone("square", 0.06, 300),
    flip: () => playTone("triangle", 0.05, 540),
    match: () => {
      playTone("sine", 0.09, 640);
      setTimeout(() => playTone("sine", 0.11, 850), 55);
    },
    mismatch: () => playTone("sawtooth", 0.1, 180, 0.025),
    win: () => {
      [660, 880, 1100].forEach((freq, i) => setTimeout(() => playTone("triangle", 0.12, freq, 0.035), i * 120));
    }
  };

  schoolLogo.addEventListener("error", () => {
    schoolLogo.style.display = "none";
    logoFallback.style.display = "block";
  });

  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const formatTime = (s) => {
    const mins = Math.floor(s / 60).toString().padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const updateStats = () => {
    movesCount.textContent = moves;
    matchedCount.textContent = matches;
    totalPairs.textContent = total;
    timeCount.textContent = formatTime(seconds);
  };

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const startTimer = () => {
    stopTimer();
    timer = setInterval(() => {
      seconds += 1;
      timeCount.textContent = formatTime(seconds);
    }, 1000);
  };

  const makeCard = (symbol, index) => {
    const cardBtn = document.createElement("button");
    cardBtn.className = "card";
    cardBtn.type = "button";
    cardBtn.dataset.value = symbol;
    cardBtn.dataset.index = String(index);
    cardBtn.setAttribute("aria-label", "Memory card");

    cardBtn.innerHTML = `
      <span class="card-inner">
        <span class="card-face card-front" aria-hidden="true">
          <span class="card-front-badge">
            <img
              src="assets/logo/logo.png"
              alt=""
              class="card-front-logo"
              loading="lazy"
            />
            <span class="card-front-fallback">Oxbridge Tutorial College</span>
          </span>
        </span>
        <span class="card-face card-back" aria-hidden="true">${symbol}</span>
      </span>
    `;

    const frontLogo = cardBtn.querySelector(".card-front-logo");
    const frontFallback = cardBtn.querySelector(".card-front-fallback");
    if (frontLogo && frontFallback) {
      frontLogo.addEventListener("error", () => {
        frontLogo.style.display = "none";
        frontFallback.style.display = "block";
      });
    }

    cardBtn.addEventListener("click", () => flipCard(cardBtn));
    return cardBtn;
  };

  const applyGrid = ({ rows, cols }) => {
    board.style.gridTemplateColumns = `repeat(${cols}, minmax(58px, 1fr))`;
    board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  };

  const resetState = () => {
    cards = [];
    openCards = [];
    moves = 0;
    matches = 0;
    seconds = 0;
    lockBoard = false;
    gameActive = true;
    updateStats();
    endScreen.classList.add("hidden");
  };

  const buildDeck = () => {
    const difficulty = difficulties[difficultySelect.value] || difficulties.easy;
    const pairCount = (difficulty.rows * difficulty.cols) / 2;
    const selected = symbols.slice(0, pairCount);
    const deck = shuffle([...selected, ...selected]);

    total = pairCount;
    applyGrid(difficulty);

    board.innerHTML = "";
    cards = deck.map((symbol, idx) => makeCard(symbol, idx));
    cards.forEach((card) => board.appendChild(card));
  };

  const allMatched = () => matches === total;

  const endGame = () => {
    stopTimer();
    gameActive = false;
    sounds.win();
    endMessage.textContent = `Completed in ${moves} moves and ${formatTime(seconds)}.`;
    endScreen.classList.remove("hidden");
  };

  const unflipOpenCards = () => {
    lockBoard = true;
    sounds.mismatch();
    setTimeout(() => {
      openCards.forEach((card) => card.classList.remove("flipped"));
      openCards = [];
      lockBoard = false;
    }, 700);
  };

  const markMatched = () => {
    openCards.forEach((card) => {
      card.classList.add("matched");
      card.disabled = true;
    });

    openCards = [];
    matches += 1;
    updateStats();
    sounds.match();

    if (allMatched()) {
      endGame();
    }
  };

  const flipCard = (card) => {
    if (!gameActive || lockBoard || card.disabled || card.classList.contains("flipped")) {
      return;
    }

    if (moves === 0 && openCards.length === 0) {
      startTimer();
    }

    card.classList.add("flipped");
    openCards.push(card);
    sounds.flip();

    if (openCards.length < 2) return;

    moves += 1;
    updateStats();

    const [first, second] = openCards;
    if (first.dataset.value === second.dataset.value) {
      markMatched();
    } else {
      unflipOpenCards();
    }
  };

  const newGame = () => {
    resetState();
    stopTimer();
    buildDeck();
    updateStats();
  };

  const toggleFullscreen = async () => {
    sounds.button();

    if (!document.fullscreenElement) {
      try {
        await app.requestFullscreen();
      } catch (_) {
        // No-op for browsers that block fullscreen without user permissions.
      }
    } else {
      await document.exitFullscreen();
    }
  };

  startBtn.addEventListener("click", () => {
    sounds.button();
    newGame();
  });

  restartBtn.addEventListener("click", () => {
    sounds.button();
    newGame();
  });

  playAgainBtn.addEventListener("click", () => {
    sounds.button();
    newGame();
  });

  difficultySelect.addEventListener("change", () => {
    sounds.button();
    newGame();
  });

  fullscreenBtn.addEventListener("click", toggleFullscreen);

  returnBtn.addEventListener("click", () => {
    sounds.button();
  });

  soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? "On" : "Off";
    sounds.button();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameActive) {
      stopTimer();
    } else if (!document.hidden && gameActive && !allMatched() && moves > 0) {
      startTimer();
    }
  });

  newGame();
})();
