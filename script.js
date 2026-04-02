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

  // Explicit self-hosted sound files. If any file is missing or fails to load,
  // the game keeps working and silently skips that sound.
  const soundFiles = {
    // Used when any control button is clicked.
    click: "assets/sounds/click.mp3",
    // Used when a card is flipped.
    flip: "assets/sounds/flip.mp3",
    // Used when two cards match.
    match: "assets/sounds/match.mp3",
    // Used when two cards do not match.
    wrong: "assets/sounds/wrong.mp3",
    // Used when the player wins the game.
    win: "assets/sounds/win.mp3",
    // Used for optional button hover feedback.
    hover: "assets/sounds/hover.mp3"
  };

  const createSound = (src) => {
    const audio = new Audio(src);
    audio.preload = "auto";

    let available = true;

    audio.addEventListener("error", () => {
      available = false;
    });

    return {
      play() {
        if (!soundOn || !available) return;
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Autoplay restrictions or missing files should not break gameplay.
        });
      }
    };
  };

  const sounds = {
    click: createSound(soundFiles.click),
    flip: createSound(soundFiles.flip),
    match: createSound(soundFiles.match),
    wrong: createSound(soundFiles.wrong),
    win: createSound(soundFiles.win),
    hover: createSound(soundFiles.hover)
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
        <span class="card-face card-front" aria-hidden="true"></span>
        <span class="card-face card-back" aria-hidden="true">${symbol}</span>
      </span>
    `;

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
    // Play win sound when all pairs are matched.
    sounds.win.play();
    endMessage.textContent = `Completed in ${moves} moves and ${formatTime(seconds)}.`;
    endScreen.classList.remove("hidden");
  };

  const unflipOpenCards = () => {
    lockBoard = true;
    // Play wrong sound when selected cards do not match.
    sounds.wrong.play();
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
    // Play match sound when a pair is found.
    sounds.match.play();

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
    // Play flip sound each time a card opens.
    sounds.flip.play();

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
    // Play click sound for fullscreen button.
    sounds.click.play();

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

  const actionControls = [startBtn, restartBtn, fullscreenBtn, returnBtn, playAgainBtn, soundToggle, difficultySelect];

  actionControls.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      // Optional hover sound.
      sounds.hover.play();
    });
  });

  startBtn.addEventListener("click", () => {
    // Play click sound on Start Game.
    sounds.click.play();
    newGame();
  });

  restartBtn.addEventListener("click", () => {
    // Play click sound on Restart Game.
    sounds.click.play();
    newGame();
  });

  playAgainBtn.addEventListener("click", () => {
    // Play click sound on end screen Play Again.
    sounds.click.play();
    newGame();
  });

  difficultySelect.addEventListener("change", () => {
    // Play click sound when changing difficulty.
    sounds.click.play();
    newGame();
  });

  fullscreenBtn.addEventListener("click", toggleFullscreen);

  returnBtn.addEventListener("click", () => {
    // Play click sound on Return to Games.
    sounds.click.play();
  });

  soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? "On" : "Off";
    // Click feedback when toggling sound state.
    sounds.click.play();
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
