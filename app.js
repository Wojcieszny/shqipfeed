/* app.js
   Draws the screens, wires the buttons, and plays pure human Albanian recordings.
   Card text, spaced-repetition logic, and saving live in data.js.
*/
(function () {
  if (window.__SHQIP_APP_LOADED) return;
  window.__SHQIP_APP_LOADED = true;

  // Active state
  var activeAudio = null;
  var activeRecorder = null;
  var discardRecording = false;
  var session = null;

  // Day Hands-Free Conversation Player state
  var dayPlayer = {
    playing: false,
    kidMode: false,
    filter: "all",
    stepIndex: 0,
    timer: null,
  };

  // Sets Known, Skip, or clears the mark for one card, then saves it.
  function setCardStatus(id, status) {
    var progress = ShqipData.getProgress();
    if (status === null) delete progress[id];
    else progress[id] = status;
    ShqipData.setProgress(progress);
  }

  // Known and Skip share one slot. Tapping the active one turns it off.
  function toggleStatus(id, status) {
    var current = ShqipData.getProgress()[id] || null;
    setCardStatus(id, current === status ? null : status);
  }

  // Reads progress fresh from storage so a reload shows the same marks.
  function getProgress() {
    return ShqipData.getProgress();
  }

  // Clears every Known and Skip mark.
  function resetProgress() {
    ShqipData.resetProgress();
  }

  // Shows the one-line storage warning when this browser will not keep data.
  function updateStorageBanner() {
    var banner = document.getElementById("storage-warning");
    if (!banner) return;
    banner.hidden = ShqipData.storageWorks();
  }

  // Switches between home, the card feed, and the add-island screen.
  function showScreen(name) {
    var home = document.getElementById("home-screen");
    var feed = document.getElementById("feed-screen");
    var add = document.getElementById("add-screen");
    var rules = document.getElementById("rules-screen");
    var day = document.getElementById("day-screen");
    var listen = document.getElementById("listen-screen");
    var back = document.getElementById("back-btn");

    if (home) home.hidden = name !== "home" && name !== "rules";
    if (feed) feed.hidden = name !== "feed";
    if (add) add.hidden = name !== "add";
    if (rules) rules.hidden = false;
    if (day) day.hidden = name !== "day";
    if (listen) listen.hidden = name !== "listen";

    var rulesBox = document.getElementById("show-rules");
    if (rulesBox && rulesBox.checked !== (name === "rules")) {
      rulesBox.checked = name === "rules";
    }

    var root = document.getElementById("shqip-root");
    if (root) root.setAttribute("data-screen", name);

    if (name !== "feed") {
      var progress = document.getElementById("lesson-progress");
      var title = document.getElementById("feed-title");
      if (progress) {
        progress.hidden = true;
        progress.innerHTML = "";
      }
      if (title) title.hidden = true;
    }

    if (name !== "day") {
      stopDayPlayer();
    }

    updateNav();
    window.scrollTo(0, 0);
  }

  // Back steps to previous card. Home leaves the lesson.
  function updateNav() {
    var back = document.getElementById("back-btn");
    var home = document.getElementById("home-btn");
    var root = document.getElementById("shqip-root");
    var screen = root ? root.getAttribute("data-screen") : "home";
    var canBack = false;
    if (screen === "feed" && session && session.steps && session.steps.length) {
      canBack = session.index > 0;
    }
    if (back) back.hidden = !canBack;
    if (home) home.hidden = screen === "home";
  }

  function goHome() {
    stopAudio();
    stopDayPlayer();
    session = null;
    var rulesBox = document.getElementById("show-rules");
    if (rulesBox) rulesBox.checked = false;
    showScreen("home");
    renderHome();
  }

  function goBack() {
    var root = document.getElementById("shqip-root");
    var screen = root ? root.getAttribute("data-screen") : "";
    if (screen !== "feed" || !session) {
      goHome();
      return;
    }
    stopAudio();
    if (session.index > 0) {
      session.index -= 1;
    }
    renderStep();
  }

  // Stops audio and active recording immediately
  function stopAudio() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    if (activeRecorder && activeRecorder.state === "recording") {
      discardRecording = true;
      try { activeRecorder.stop(); } catch (err) { /* already stopped */ }
    }
    var words = document.querySelectorAll(".word.is-now");
    for (var i = 0; i < words.length; i++) words[i].classList.remove("is-now");
  }

  function stopDayPlayer() {
    dayPlayer.playing = false;
    if (dayPlayer.timer) {
      window.clearTimeout(dayPlayer.timer);
      dayPlayer.timer = null;
    }
    var playBtn = document.getElementById("day-play-btn");
    if (playBtn) playBtn.textContent = "▶ Play All";
    var turns = document.querySelectorAll(".turn.is-playing");
    for (var t = 0; t < turns.length; t++) turns[t].classList.remove("is-playing");
  }

  // Strips punctuation so a tapped word matches its sound file.
  function cleanWord(token) {
    return String(token || "").replace(/^[«»"'“”.,!?¿;:()]+|[«»"'“”.,!?¿;:()]+$/g, "");
  }

  function renderWordToken(token) {
    var word = cleanWord(token);
    if (!word) return document.createTextNode(token + " ");
    var lower = word.toLowerCase();
    var hasHuman = window.ShqipHuman && (window.ShqipHuman[lower] || window.ShqipHuman[word]);
    if (hasHuman) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word";
      btn.setAttribute("data-word", word);
      btn.textContent = token;
      return btn;
    } else {
      var span = document.createElement("span");
      span.className = "word word-plain";
      span.textContent = token;
      return span;
    }
  }

  // Shows the Albanian words and the next step once sound has started.
  function revealWords() {
    var cardEl = document.querySelector(".card.is-recall-wait");
    if (cardEl) cardEl.classList.remove("is-recall-wait");
    var words = document.querySelector(".card-words");
    if (words) words.hidden = false;
    var rest = document.querySelectorAll(".after-listen");
    for (var i = 0; i < rest.length; i++) rest[i].hidden = false;
  }

  // Pure human playback with pitch preservation and zero robot fallback
  function playFile(url, rate, fallbackText, onTime, onEnded, altUrl, altUrl2) {
    stopAudio();
    var note = document.querySelector(".audio-note");
    var audio = new Audio(url);
    activeAudio = audio;
    audio.preload = "auto";
    audio.preservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.webkitPreservesPitch = true;

    var handedOff = false;
    function handOffFailure() {
      if (handedOff) return;
      handedOff = true;
      if (altUrl) {
        var next = altUrl;
        if (activeAudio === audio) activeAudio = null;
        playFile(next, rate, fallbackText, onTime, onEnded, altUrl2 || "", "");
        return;
      }
      if (activeAudio === audio) activeAudio = null;
      revealWords();
      if (note) {
        note.hidden = false;
        note.textContent = "No human recording for this line";
      }
      if (onEnded) onEnded();
    }

    audio.addEventListener("error", handOffFailure);
    audio.addEventListener("loadedmetadata", function () {
      try { audio.playbackRate = rate; } catch (err) { /* ignore */ }
    });
    audio.addEventListener("playing", function () {
      if (note && note.dataset.keep !== "1") note.hidden = true;
      revealWords();
    });
    audio.addEventListener("timeupdate", function () {
      if (onTime) onTime(audio);
    });
    audio.addEventListener("ended", function () {
      var lit = document.querySelectorAll(".word.is-now");
      for (var i = 0; i < lit.length; i++) lit[i].classList.remove("is-now");
      if (onEnded) onEnded();
    });

    var started = audio.play();
    if (started && started.then) {
      started.then(function () {
        if (note && note.dataset.keep !== "1") note.hidden = true;
        revealWords();
        try { audio.playbackRate = rate; } catch (err) { /* ignore */ }
      }).catch(function (err) {
        if (err && err.name === "NotAllowedError") {
          if (activeAudio === audio) activeAudio = null;
          return;
        }
        handOffFailure();
      });
    }
  }

  // Lights up words in order while the whole phrase plays.
  function followPhrase(audio) {
    var words = document.querySelectorAll(".card-words .word");
    if (!words.length) return;
    var duration = audio.duration;
    if (!duration || !isFinite(duration)) return;
    var index = Math.min(words.length - 1, Math.floor((audio.currentTime / duration) * words.length));
    for (var i = 0; i < words.length; i++) {
      words[i].classList.toggle("is-now", i === index);
    }
  }

  // Lights up words inside one reply while that reply plays.
  function followIn(audio, root) {
    var words = root.querySelectorAll(".word");
    if (!words.length) return;
    var duration = audio.duration;
    if (!duration || !isFinite(duration)) return;
    var index = Math.min(words.length - 1, Math.floor((audio.currentTime / duration) * words.length));
    for (var i = 0; i < words.length; i++) {
      words[i].classList.toggle("is-now", i === index);
    }
  }

  function playCurrent(rate) {
    var step = currentStep();
    var card = step ? step.card : null;
    if (!card) return;

    var custom = ShqipData.getCustomAudio(card.id);
    if (custom) {
      var note = document.querySelector(".audio-note");
      if (note) {
        note.hidden = false;
        note.dataset.keep = "1";
        note.textContent = "Family recording · Verified";
      }
      playFile(custom, rate || 1, card.albanian, followPhrase);
      return;
    }

    if (card.playlist && card.playlist.length) {
      playPlaylist(card.playlist, rate || 1);
      return;
    }

    var base = ShqipData.scriptBase();
    var note = document.querySelector(".audio-note");
    if (note) {
      if (card.voice) {
        note.hidden = false;
        note.dataset.keep = "1";
        note.textContent = card.voice;
      } else {
        delete note.dataset.keep;
      }
    }
    playFile(base + "audio/" + (card.audio || card.id) + ".mp3", rate || 1, card.albanian, followPhrase);
  }

  function playPlaylist(stems, rate) {
    var index = 0;
    var base = ShqipData.scriptBase();
    function step() {
      var cur = currentStep();
      var card = cur ? cur.card : null;
      if (!card || !card.playlist || index >= stems.length) return;
      var button = document.querySelectorAll(".card-words .word")[index] || null;
      var stem = stems[index];
      index += 1;
      playFile(base + "audio/" + stem + ".mp3", rate, button ? button.textContent : "", null, step);
      if (button) button.classList.add("is-now");
    }
    step();
  }

  // Plays one Albanian word from its own recording.
  function playWord(word, button) {
    if (!word) return;
    var lit = document.querySelectorAll(".word.is-now");
    for (var i = 0; i < lit.length; i++) lit[i].classList.remove("is-now");
    if (button) button.classList.add("is-now");
    var base = ShqipData.scriptBase();
    var lower = word.toLocaleLowerCase("sq");
    var note = document.querySelector(".audio-note");
    var human = window.ShqipHuman && window.ShqipHuman[lower];
    if (note) {
      if (human && human.speaker) {
        note.hidden = false;
        note.dataset.keep = "1";
        note.textContent = human.speaker + (human.license ? " · " + human.license : "");
      } else {
        delete note.dataset.keep;
      }
    }
    var humanPath = human && human.file ? (base + human.file) : (base + "audio/human/" + encodeURIComponent(lower) + ".mp3");
    var wordFallback = base + "audio/words/" + encodeURIComponent(lower) + ".mp3";
    playFile(humanPath, 1, word, null, null, wordFallback, "");
    if (button) button.classList.add("is-now");
  }

  // 1-Tap Compare Loopback
  function recordAndCompare(btn) {
    if (activeRecorder && activeRecorder.state === "recording") {
      activeRecorder.stop();
      return;
    }
    stopAudio();
    var note = document.querySelector(".audio-note");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      if (note) {
        note.hidden = false;
        note.textContent = "This browser has no microphone.";
      }
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var recorder = new MediaRecorder(stream);
      activeRecorder = recorder;
      discardRecording = false;
      btn.textContent = "Listening…";
      btn.classList.add("is-recording");
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        if (activeRecorder === recorder) activeRecorder = null;
        btn.textContent = "Compare";
        btn.classList.remove("is-recording");
        if (discardRecording) {
          discardRecording = false;
          return;
        }
        if (!chunks.length) return;
        var blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        var userUrl = URL.createObjectURL(blob);
        var userAudio = new Audio(userUrl);
        activeAudio = userAudio;
        userAudio.addEventListener("ended", function () {
          URL.revokeObjectURL(userUrl);
          window.setTimeout(function () { playCurrent(1); }, 250);
        });
        var started = userAudio.play();
        if (started && started.catch) started.catch(function () { URL.revokeObjectURL(userUrl); });
      };
      recorder.start();
      window.setTimeout(function () {
        if (recorder.state === "recording") recorder.stop();
      }, 2800);
    }).catch(function () {
      btn.textContent = "Compare";
      btn.classList.remove("is-recording");
      if (note) {
        note.hidden = false;
        note.textContent = "The microphone was blocked.";
      }
    });
  }

  // On-device family voice recorder
  function recordFamilyVoice(card, btn) {
    if (activeRecorder && activeRecorder.state === "recording") {
      activeRecorder.stop();
      return;
    }
    stopAudio();
    var note = document.querySelector(".audio-note");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      if (note) {
        note.hidden = false;
        note.textContent = "Microphone not available in this browser.";
      }
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [];
      var recorder = new MediaRecorder(stream);
      activeRecorder = recorder;
      discardRecording = false;
      btn.textContent = "Recording... tap to finish";
      btn.classList.add("is-recording");
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        if (activeRecorder === recorder) activeRecorder = null;
        btn.textContent = "Record family voice";
        btn.classList.remove("is-recording");
        if (discardRecording || !chunks.length) return;
        var blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result;
          ShqipData.setCustomAudio(card.id, dataUrl);
          ShqipData.setVerified(card.id, true);
          renderStep();
          revealWords();
          var more = document.querySelector(".card-more");
          if (more) more.hidden = false;
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      window.setTimeout(function () {
        if (recorder.state === "recording") recorder.stop();
      }, 5000);
    }).catch(function () {
      btn.textContent = "Record family voice";
      btn.classList.remove("is-recording");
      if (note) {
        note.hidden = false;
        note.textContent = "Microphone permission was denied.";
      }
    });
  }

  // Current session step
  function currentStep() {
    if (!session || !session.steps) return null;
    return session.steps[session.index] || null;
  }

  // Home Screen Dashboard rendering
  function renderHome() {
    var today = ShqipData.buildToday();
    var where = document.getElementById("home-where");
    var start = document.getElementById("start-btn");
    var dayBtn = document.getElementById("day-btn");

    if (where) where.textContent = today.where;
    if (start) {
      start.disabled = false;
      if (today.dueCount > 0) {
        start.textContent = "Start Step-by-Step (" + today.activeIsland + " · " + today.dueCount + " due)";
      } else {
        start.textContent = "Continue Step-by-Step (+4 new lines)";
      }
    }
    if (dayBtn) {
      dayBtn.textContent = "🎧 Listen: Real Conversation (Anila & Ilir)";
    }

    // Visible 12-Step Curriculum Map
    var mapBox = document.getElementById("island-picker");
    if (mapBox) {
      mapBox.innerHTML = "";
      ShqipData.getCurriculumMap().forEach(function (row) {
        var card = document.createElement("button");
        card.type = "button";
        card.className = "curriculum-card" + (row.isActive ? " is-active" : "");
        card.setAttribute("data-island", row.name);

        var head = document.createElement("div");
        head.className = "curriculum-head";

        var step = document.createElement("span");
        step.className = "curriculum-step";
        step.textContent = "Step " + row.step;
        head.appendChild(step);

        var name = document.createElement("span");
        name.className = "curriculum-name";
        name.textContent = row.name;
        head.appendChild(name);

        if (row.isActive) {
          var badge = document.createElement("span");
          badge.className = "active-badge";
          badge.textContent = "Active";
          head.appendChild(badge);
        }
        card.appendChild(head);

        var meter = document.createElement("div");
        meter.className = "curriculum-meter";
        var mBar = document.createElement("div");
        mBar.className = "meter-bar meter-mastered";
        mBar.style.width = ((row.mastered / (row.total || 1)) * 100) + "%";
        var lBar = document.createElement("div");
        lBar.className = "meter-bar meter-learning";
        lBar.style.width = ((row.learning / (row.total || 1)) * 100) + "%";
        meter.appendChild(mBar);
        meter.appendChild(lBar);
        card.appendChild(meter);

        var stats = document.createElement("div");
        stats.className = "curriculum-stats";
        stats.innerHTML = "<span><b>" + row.mastered + "</b> Mastered</span><span><b>" + row.learning + "</b> Learning</span><span><b>" + row.total + "</b> Total</span>";
        card.appendChild(stats);

        mapBox.appendChild(card);
      });
    }

    var counts = ShqipData.boxCounts();
    var waits = ["", "Today", "2 days", "4 days", "9 days", "14 days"];
    var boxList = document.getElementById("box-list");
    if (boxList) {
      boxList.innerHTML = "";
      for (var n = 1; n <= 5; n++) {
        var item = document.createElement("li");
        item.textContent = "Box " + n + " · " + counts[n] + " · ask again " + waits[n];
        boxList.appendChild(item);
      }
    }

    var levels = ShqipData.levelCounts();
    var levelLine = document.getElementById("level-line");
    if (levelLine) {
      levelLine.textContent =
        "Beginner " + levels.beginner.started + "/" + levels.beginner.total +
        " · Medium " + levels.medium.started + "/" + levels.medium.total +
        " · Advanced " + levels.advanced.started + "/" + levels.advanced.total;
    }

    var cap = ShqipData.getCap();
    var capAuto = document.getElementById("cap-auto");
    var capBeginner = document.getElementById("cap-beginner");
    if (capAuto) capAuto.classList.toggle("is-on", cap !== "beginner");
    if (capBeginner) capBeginner.classList.toggle("is-on", cap === "beginner");

    var islands = document.getElementById("island-progress");
    if (islands) {
      islands.innerHTML = "";
      var owner = {};
      ShqipData.getIslandSummaries(getProgress()).forEach(function (row) {
        owner[row.name] = row.ownerOnly;
      });
      ShqipData.islandProgress().forEach(function (row) {
        var li = document.createElement("li");
        li.className = "island-stat";
        li.textContent = row.name + " · " + row.inBoxes + "/" + row.total + " in boxes";
        if (owner[row.name]) {
          var del = document.createElement("button");
          del.type = "button";
          del.className = "delete-btn";
          del.textContent = "Delete";
          del.addEventListener("click", function () {
            var ok = window.confirm('Delete "' + row.name + '" and its cards? This cannot be undone.');
            if (!ok) return;
            var result = ShqipData.deleteOwnerIsland(row.name);
            if (!result.ok) {
              setSettingsMessage(result.error || "That island can't be deleted.");
              return;
            }
            renderHome();
          });
          li.appendChild(del);
        }
        islands.appendChild(li);
      });
    }

    updateStorageBanner();
  }

  function beginSession(sessionObj) {
    if (!sessionObj || !sessionObj.steps || !sessionObj.steps.length) {
      renderHome();
      return;
    }
    session = {
      activeIsland: sessionObj.activeIsland,
      steps: sessionObj.steps,
      index: 0,
    };
    showScreen("feed");
    renderStep();
  }

  function openSession() {
    beginSession(ShqipData.buildInterleavedSession());
  }

  function openIsland(name) {
    beginSession(ShqipData.buildInterleavedSession(name));
  }

  function renderProgress(index, total) {
    var bar = document.getElementById("lesson-progress");
    if (!bar) return;
    bar.innerHTML = "";
    if (!total) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    bar.setAttribute("aria-label", (index + 1) + " of " + total);
    for (var i = 0; i < total; i++) {
      var seg = document.createElement("span");
      seg.className = "seg" + (i <= index ? " is-on" : "");
      bar.appendChild(seg);
    }
  }

  function renderStep() {
    var feed = document.getElementById("card-feed");
    var title = document.getElementById("feed-title");
    if (!feed || !session) return;
    stopAudio();
    feed.innerHTML = "";

    if (session.index >= session.steps.length) {
      if (title) {
        title.hidden = false;
        title.textContent = "Commute Done";
      }
      renderProgress(session.steps.length, session.steps.length);
      feed.appendChild(renderDone());
      updateNav();
      return;
    }

    var step = currentStep();
    if (!step) {
      feed.appendChild(renderDone());
      updateNav();
      return;
    }

    if (step.type === "teach") {
      if (title) {
        title.hidden = false;
        title.textContent = step.card.island;
      }
      renderProgress(session.index, session.steps.length);
      var cardEl = renderCard(step.card, getProgress(), session.index, session.steps.length);
      feed.appendChild(cardEl);
      if (!cardEl.classList.contains("is-recall-wait")) {
        playCurrent(1);
      }
    } else if (step.type === "check") {
      if (title) {
        title.hidden = false;
        var modeLabel = step.mode === "meaning" ? "Meaning" : (step.mode === "block-build" ? "Lego Build" : "Reply");
        title.textContent = "Check · " + modeLabel;
      }
      renderProgress(session.index, session.steps.length);
      feed.appendChild(renderCheck(step));
      var saidAudio = step.quiz && step.quiz.said && step.quiz.said.audio;
      var saidAlbanian = step.quiz && step.quiz.said && step.quiz.said.albanian;
      if (saidAudio && step.mode !== "block-build") {
        var base = ShqipData.scriptBase();
        playFile(base + "audio/" + saidAudio + ".mp3", 1, saidAlbanian, null);
      }
    }
    updateNav();
  }

  // Teach Card Renderer
  function renderCard(card, progress, index, total) {
    var boxes = typeof ShqipData.getBoxes === "function" ? ShqipData.getBoxes() : {};
    var isReview = !!(boxes && boxes[card.id] && boxes[card.id].box >= 1 && card.review !== false);

    var article = document.createElement("article");
    article.className = "card" + (card.lesson ? " has-lesson" : "") + (isReview ? " is-recall-wait" : "");
    article.setAttribute("data-id", card.id);
    article.setAttribute("aria-label", (index + 1) + " of " + total);

    if (card.lesson && card.lesson.background) {
      addText(article, "p", "when-line", card.lesson.background);
    }

    var stage = document.createElement("div");
    stage.className = "card-stage";
    addText(stage, "p", "card-english", card.english);

    if (isReview) {
      var recallHint = addText(stage, "p", "recall-prompt", "Say it in Albanian first, then tap Hear to reveal.");
      recallHint.setAttribute("data-recall-hint", "1");
    }

    var words = document.createElement("div");
    words.className = "card-words card-albanian";
    words.lang = "sq";
    if (isReview) words.hidden = true;
    String(card.albanian || "").split(/\s+/).forEach(function (token) {
      words.appendChild(renderWordToken(token));
    });
    stage.appendChild(words);

    if (card.phonetic) {
      var phon = document.createElement("p");
      phon.className = "card-phonetic after-listen";
      phon.textContent = card.phonetic;
      phon.hidden = true;
      stage.appendChild(phon);
    }

    stage.appendChild(sourceLine(card.albanian));

    var blocks = renderBlocks(card);
    if (blocks) {
      blocks.classList.add("after-listen");
      blocks.hidden = true;
      stage.appendChild(blocks);
    }

    var note = document.createElement("p");
    note.className = "audio-note";
    note.setAttribute("role", "status");
    note.hidden = true;
    note.textContent = "No audio yet";
    stage.appendChild(note);

    var hear = makeButton("Hear", "play", false);
    hear.classList.add("hear-btn");
    var slow = makeButton("Slower", "slow", false);
    slow.classList.add("slow-link", "after-listen");
    slow.hidden = true;
    var compare = makeButton("Compare", "compare", false);
    compare.classList.add("slow-link", "after-listen");
    compare.hidden = true;

    var controls = document.createElement("div");
    controls.className = "hear-row";
    controls.appendChild(hear);
    controls.appendChild(slow);
    controls.appendChild(compare);
    stage.appendChild(controls);
    article.appendChild(stage);

    var lessonView = renderLesson(card);
    if (lessonView) article.appendChild(lessonView);

    var nav = document.createElement("div");
    nav.className = "card-nav after-listen";
    nav.hidden = true;
    nav.appendChild(makeButton("Next", "teach-next", false));
    article.appendChild(nav);

    var moreBtn = makeButton("More", "more", false);
    moreBtn.classList.add("more-link", "after-listen");
    moreBtn.hidden = true;
    article.appendChild(moreBtn);

    var more = document.createElement("div");
    more.className = "card-more";
    more.hidden = true;
    if (card.tip) addText(more, "p", "card-tip", card.tip);
    lessonExtras(card).forEach(function (fact) {
      addText(more, "p", "card-tip", fact);
    });
    if (card.verified !== true) addText(more, "p", "unverified", "unverified");
    more.appendChild(makeButton("Skip", "skip", progress[card.id] === "skip"));
    more.appendChild(makeButton(card.verified === true ? "Verified" : "Mark verified", "verified", card.verified === true));
    more.appendChild(makeButton("Record family voice", "record-family", false));
    if (ShqipData.getCustomAudio(card.id)) {
      more.appendChild(makeButton("Clear family voice", "clear-family", false));
    }
    article.appendChild(more);

    return article;
  }

  // Check Step Renderer
  function renderCheck(step) {
    var quiz = step.quiz;
    var wrap = document.createElement("div");
    wrap.className = "quiz";

    var isMeaning = quiz.mode === "meaning";
    var isBlockBuild = quiz.mode === "block-build";
    var kicker = isMeaning
      ? "Audio Meaning Check"
      : (isBlockBuild ? "Lego Block Build Check" : "Conversational Reply Check");
    addText(wrap, "p", "lesson-label", kicker);

    if (isMeaning) {
      addText(wrap, "p", "quiz-prompt", "You hear:");
      var saidEl = addText(wrap, "p", "quiz-said", quiz.said.albanian);
      saidEl.hidden = true; // Hidden until answered

      var hearBtn = makeButton("🎧 Hear again", "check-hear", false);
      hearBtn.classList.add("line-hear", "check-hear-btn");
      wrap.appendChild(hearBtn);

      addText(wrap, "p", "lesson-label", "What does it mean?");
    } else if (isBlockBuild) {
      addText(wrap, "p", "quiz-prompt", "Build in Albanian:");
      addText(wrap, "p", "quiz-said", quiz.said.english);

      var hearBtn = makeButton("🎧 Hear hint", "check-hear", false);
      hearBtn.classList.add("line-hear", "check-hear-btn");
      wrap.appendChild(hearBtn);

      addText(wrap, "p", "lesson-label", "Pick the matching Lego blocks:");
    } else {
      addText(wrap, "p", "quiz-prompt", "They say:");
      var saidEl = addText(wrap, "p", "quiz-said", quiz.said.albanian);

      var hearBtn = makeButton("🎧 Hear", "check-hear", false);
      hearBtn.classList.add("line-hear", "check-hear-btn");
      wrap.appendChild(hearBtn);

      addText(wrap, "p", "lesson-label", "What do you reply?");
    }

    var choicesBox = document.createElement("div");
    choicesBox.className = "quiz-choices";
    quiz.choices.forEach(function (choice, index) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-choice";
      btn.setAttribute("data-action", "check-pick");
      btn.setAttribute("data-index", String(index));
      if (isMeaning) {
        btn.textContent = choice.english;
      } else if (isBlockBuild && choice.blocks && choice.blocks.length) {
        var blockChips = choice.blocks.map(function (b) {
          return '<span class="quiz-block-chip">[' + escRule(b.text) + "]</span>";
        }).join(" + ");
        btn.innerHTML = "<b>" + blockChips + "</b>";
      } else {
        btn.innerHTML = "<b>" + escRule(choice.albanian) + "</b>" + (choice.english ? "<span>" + escRule(choice.english) + "</span>" : "");
      }
      choicesBox.appendChild(btn);
    });
    wrap.appendChild(choicesBox);

    var result = document.createElement("div");
    result.className = "quiz-result";
    result.hidden = true;
    wrap.appendChild(result);

    return wrap;
  }

  function playExchange(card, turns) {
    stopAudio();
    var base = ShqipData.scriptBase();
    var they = null;
    var you = null;
    turns.forEach(function (t) {
      if (t.who === "they" && !they) they = t;
      if (t.who === "you" && !you) you = t;
    });

    var mainAudioUrl = ShqipData.getCustomAudio(card.id) || (base + "audio/" + (card.audio || card.id) + ".mp3");

    playFile(mainAudioUrl, 1, card.albanian, followPhrase, function () {
      if (!they) return;
      window.setTimeout(function () {
        var theyRow = document.querySelector(".turn.they");
        if (theyRow) theyRow.classList.add("is-now");
        var theyAudio = base + "audio/" + (they.audio || they.id) + ".mp3";
        playFile(theyAudio, 1, they.albanian, function (a) {
          if (theyRow) followIn(a, theyRow);
        }, function () {
          if (theyRow) theyRow.classList.remove("is-now");
          if (!you) return;
          window.setTimeout(function () {
            var youRow = document.querySelector(".turn.you");
            if (youRow) youRow.classList.add("is-now");
            var youAudio = base + "audio/" + (you.audio || you.id) + ".mp3";
            playFile(youAudio, 1, you.albanian, function (a) {
              if (youRow) followIn(a, youRow);
            }, function () {
              if (youRow) youRow.classList.remove("is-now");
            });
          }, 600);
        });
      }, 600);
    });
  }

  function sourceKey(text) {
    return String(text || "").toLowerCase().replace(/[«»"'“”.,!?¿;:()]/g, "").replace(/\s+/g, " ").trim();
  }

  function sentenceSource(text) {
    var book = window.ShqipSources && window.ShqipSources.phrases;
    if (!book) return null;
    return book[sourceKey(text)] || null;
  }

  function wordSource(text) {
    var book = window.ShqipSources && window.ShqipSources.words;
    if (!book) return null;
    var key = String(text || "").replace(/^[«»"'“”.,!?¿;:()]+|[«»"'“”.,!?¿;:()]+$/g, "");
    return book[key] || book[key.toLowerCase()] || null;
  }

  function sourceLine(text) {
    var wrap = document.createElement("div");
    wrap.className = "source-line";
    var hit = sentenceSource(text);
    if (hit && hit.pron) {
      var spoken = document.createElement("p");
      spoken.appendChild(document.createTextNode(hit.pron + " "));
      var link = document.createElement("a");
      link.className = "source-link";
      link.href = hit.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Wikivoyage";
      spoken.appendChild(link);
      wrap.appendChild(spoken);
    }
    var checks = window.ShqipChecks && window.ShqipChecks.sentences;
    var row = checks ? checks[sourceKey(text)] : null;
    var note = document.createElement("p");
    note.className = "source-check";
    if (row && row.peace) note.textContent = "Peace Corps 2005 book: this sentence is printed there.";
    else note.textContent = "Peace Corps 2005 book: this sentence is not in it.";
    wrap.appendChild(note);
    if (!hit || !hit.pron) {
      var missing = document.createElement("p");
      missing.className = "source-check";
      missing.textContent = "No published pronunciation for this sentence.";
      wrap.appendChild(missing);
    }
    return wrap;
  }

  var CHUNK_GLOSSES = {
    "a doni": "do you want",
    "a dëshironi": "would you like",
    "do të doja": "I would like",
    "a mund": "can / may",
    "a mund të": "can / may",
    "a mund të më": "can you ... me",
    "ku është": "where is",
    "ku gjendet": "where is",
    "sa kushton": "how much costs",
    "ju lutem": "please",
    "të lutem": "please",
    "faleminderit": "thank you",
    "faleminderit shumë": "thank you very much",
    "mirëdita": "hello",
    "mirëmëngjes": "good morning",
    "mirëmbrëma": "good evening",
    "natën e mirë": "good night",
    "mirupafshim": "goodbye",
    "si je": "how are you",
    "si jeni": "how are you",
    "jam në rregull": "I'm ok",
    "në rregull": "all right",
    "unë jam": "I am",
    "ai është": "he is",
    "ajo është": "she is",
    "ne jemi": "we are",
    "është": "it is",
    "sot është": "today is",
    "nuk kuptoj": "I don't understand",
    "nuk e di": "I don't know",
    "më vjen keq": "I'm sorry",
    "më falni": "excuse me",
    "dua të": "I want to",
    "unë dua": "I want",
    "kam": "I have",
    "nuk kam": "I don't have",
  };

  function resolveBlockGloss(block, index, totalBlocks, card, rows) {
    if (block.en || block.english) return String(block.en || block.english);
    var sqRaw = String(block.text || "").trim();
    var sqLow = normLine(sqRaw);
    if (!sqLow) return "";

    for (var i = 0; i < rows.length; i++) {
      if (normLine(rows[i].sq) === sqLow) return rows[i].en;
    }

    if (CHUNK_GLOSSES[sqLow]) return CHUNK_GLOSSES[sqLow];

    var book = (window.ShqipRules && window.ShqipRules.words) || {};
    if (book[sqLow]) return book[sqLow];

    var matchedParts = [];
    sqRaw.split(/\s+/).forEach(function (part) {
      var w = cleanWord(part).toLowerCase();
      if (!w) return;
      for (var r = 0; r < rows.length; r++) {
        if (normLine(rows[r].sq) === w) {
          matchedParts.push(rows[r].en);
          return;
        }
      }
      if (book[w]) matchedParts.push(book[w]);
    });
    if (matchedParts.length) return matchedParts.join(" ");

    var engWords = String(card.english || "").replace(/[.!?]+$/, "").trim().split(/\s+/).filter(Boolean);
    if (!engWords.length) return "";
    if (totalBlocks <= 1) return engWords.join(" ");
    var start = Math.floor((index * engWords.length) / totalBlocks);
    var end = Math.floor(((index + 1) * engWords.length) / totalBlocks);
    if (end <= start) end = Math.min(engWords.length, start + 1);
    return engWords.slice(start, end).join(" ").toLowerCase();
  }

  function renderBlocks(card) {
    var blocks = card.blocks || [];
    var useful = blocks.filter(function (block) { return block && block.text; });
    if (useful.length < 1) return null;
    var rows = glossRows(card);
    var row = document.createElement("div");
    row.className = "blocks";
    useful.forEach(function (block, idx) {
      var pill = document.createElement("span");
      var kind = block.type === "power" || block.type === "verb" || block.type === "object" ? block.type : "other";
      pill.className = "block block-" + kind;

      var sqSpan = document.createElement("span");
      sqSpan.className = "block-sq";
      sqSpan.textContent = block.text;
      pill.appendChild(sqSpan);

      var enText = resolveBlockGloss(block, idx, useful.length, card, rows);
      if (enText) {
        var enSpan = document.createElement("span");
        enSpan.className = "block-en";
        enSpan.textContent = enText;
        pill.appendChild(enSpan);
      }

      row.appendChild(pill);
    });
    return row;
  }

  function glossRows(card) {
    var lesson = card.lesson || {};
    if (lesson.kind === "word" || lesson.kind === "count") return [];
    var glosses = [];
    (lesson.facts || []).forEach(function (fact) {
      String(fact).split(/\.\s+/).forEach(function (sentence) {
        var clean = sentence.replace(/\.$/, "").trim();
        var at = clean.toLowerCase().indexOf(" is ");
        if (at <= 0 || at > 40) return;
        var left = clean.slice(0, at).trim();
        var right = clean.slice(at + 4).trim();
        if (!right || /^(it|this|you|a|the|that|these|they)\b/i.test(left)) return;
        glosses.push({ sq: left, en: right });
      });
    });
    var blocks = (card.blocks || []).map(function (block) {
      return String(block.text || "").trim();
    }).filter(Boolean);
    var picked = [];
    function take(name) {
      var low = String(name || "").toLowerCase();
      if (!low) return false;
      for (var i = 0; i < glosses.length; i++) {
        if (glosses[i].used) continue;
        if (glosses[i].sq.toLowerCase() === low) {
          glosses[i].used = true;
          picked.push(glosses[i]);
          return true;
        }
      }
      return false;
    }
    if (blocks.length) {
      blocks.forEach(function (block) {
        if (take(block)) return;
        block.split(/\s+/).forEach(function (part) { take(cleanWord(part)); });
      });
    } else {
      var line = String(card.albanian || "").toLowerCase();
      glosses.forEach(function (gloss) {
        if (gloss.used) return;
        if (line.indexOf(gloss.sq.toLowerCase()) !== -1) {
          gloss.used = true;
          picked.push(gloss);
        }
      });
    }
    if (picked.length === 1) {
      var only = picked[0].en.toLowerCase();
      var english = String(card.english || "").toLowerCase().replace(/\.$/, "");
      if (english && (english.indexOf(only) !== -1 || only.indexOf(english) !== -1)) picked = [];
    }
    if (picked.length) return picked;
    return lexiconRows(card);
  }

  function lexiconRows(card) {
    var book = (window.ShqipRules && window.ShqipRules.words) || {};
    var bare = normLine(card.albanian);
    var whole = {
      "po ju": true,
      "më vjen mirë": true,
      "më vjen keq": true,
      "ska përse": true,
      "në rregull": true,
      "ju bëftë mirë": true,
      "mirë se erdhët": true,
      "nuk e di": true,
    };
    if (whole[bare]) return [];
    var picked = [];
    var seen = {};
    String(card.albanian || "").split(/\s+/).forEach(function (token) {
      var word = cleanWord(token);
      var key = word.toLowerCase();
      if (!word || seen[key] || !book[key]) return;
      seen[key] = true;
      picked.push({ sq: word, en: book[key] });
    });
    if (picked.length < 2) return [];
    return picked;
  }

  function lessonExtras(card) {
    var lesson = card.lesson || {};
    var used = {};
    glossRows(card).forEach(function (row) { used[row.sq.toLowerCase()] = true; });
    var extra = [];
    (lesson.facts || []).forEach(function (fact) {
      var text = String(fact || "").trim();
      if (!text) return;
      var parts = text.split(/\.\s+/);
      var kept = parts.filter(function (sentence) {
        var clean = sentence.replace(/\.$/, "").trim();
        var at = clean.toLowerCase().indexOf(" is ");
        if (at <= 0) return true;
        var left = clean.slice(0, at).trim().toLowerCase();
        return !used[left];
      });
      if (kept.length) extra.push(kept.join(". ").replace(/\.$/, "") + (text.slice(-1) === "." ? "." : ""));
    });
    return extra;
  }

  function conversationTurns(card) {
    var lesson = card.lesson || {};
    if (lesson.kind === "word" || lesson.kind === "count") return [];
    if (lesson.turns && lesson.turns.length) return lesson.turns;
    var turns = [{
      who: "you",
      english: card.english,
      albanian: card.albanian,
      audio: card.audio || card.id,
    }];
    (lesson.answers || []).forEach(function (line) {
      if (!line) return;
      turns.push({
        who: "they",
        english: line.english,
        albanian: line.albanian,
        audio: line.audio || line.id,
      });
    });
    if (lesson.reply) {
      turns.push({
        who: "you",
        english: lesson.reply.english,
        albanian: lesson.reply.albanian,
        audio: lesson.reply.audio || lesson.reply.id,
      });
    }
    var seen = normLine(card.albanian);
    turns = turns.filter(function (turn) {
      var line = normLine(turn.albanian);
      if (!line || line === seen) return false;
      seen = line;
      return true;
    });
    if (!turns.length) return [];
    var they = [];
    var you = [];
    turns.forEach(function (turn) {
      if (turn.who === "they") they.push(turn);
      else you.push(turn);
    });
    var ordered = [];
    if (they.length) ordered.push(they[0]);
    you.forEach(function (turn) { ordered.push(turn); });
    they.slice(1).forEach(function (turn) {
      turn.alt = true;
      ordered.push(turn);
    });
    return ordered;
  }

  function normLine(text) {
    return String(text || "").toLowerCase().replace(/[«»"'“”.,!?¿;:()]/g, "").replace(/\s+/g, " ").trim();
  }

  function renderLesson(card) {
    var turns = conversationTurns(card);
    if (!turns.length) return null;
    var wrap = document.createElement("div");
    wrap.className = "lesson-rest after-listen";
    wrap.hidden = true;

    var talk = document.createElement("section");
    talk.className = "lesson-block";
    var talkHeader = document.createElement("div");
    talkHeader.className = "talk-header";
    addText(talkHeader, "h2", "lesson-label", "After you");

    var playExBtn = makeButton("▶ Play Exchange", "play-exchange", false);
    playExBtn.classList.add("exchange-btn");
    talkHeader.appendChild(playExBtn);
    talk.appendChild(talkHeader);

    var openedAlt = false;
    turns.forEach(function (line) {
      if (line.alt && !openedAlt) {
        addText(talk, "h2", "lesson-label", "Or they might say");
        openedAlt = true;
      }
      var who = line.who === "they" ? "they" : "you";
      var row = document.createElement("div");
      row.className = "turn " + who;
      var top = document.createElement("div");
      top.className = "turn-top";
      addText(top, "span", "who", who === "they" ? "They" : "You");
      var hear = makeButton("Hear", "line", false);
      hear.classList.add("line-hear");
      hear.setAttribute("data-audio", line.audio || "");
      hear.setAttribute("data-say", line.albanian || "");
      top.appendChild(hear);
      row.appendChild(top);
      var split = document.createElement("div");
      split.className = "split";
      var al = document.createElement("div");
      al.className = "turn-al";
      al.lang = "sq";
      String(line.albanian || "").split(/\s+/).forEach(function (token) {
        al.appendChild(renderWordToken(token));
      });
      var en = document.createElement("p");
      en.className = "turn-en";
      en.textContent = line.english || "";
      split.appendChild(al);
      split.appendChild(en);
      row.appendChild(split);
      talk.appendChild(row);
    });
    wrap.appendChild(talk);
    return wrap;
  }

  function addText(parent, tag, className, text) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function makeButton(label, action, pressed) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-btn" + (pressed ? " is-on" : "");
    btn.setAttribute("data-action", action);
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.textContent = label;
    return btn;
  }

  function renderDone() {
    var wrap = document.createElement("div");
    wrap.className = "done-panel";
    addText(wrap, "p", "done-title", "Commute practice done!");
    var counts = ShqipData.boxCounts();
    addText(wrap, "p", "done-detail",
      "Box 1 " + counts[1] + " · Box 2 " + counts[2] + " · Box 3 " + counts[3] +
      " · Box 4 " + counts[4] + " · Box 5 " + counts[5]
    );
    var home = makeButton("Return Home", "done-home", false);
    home.classList.add("primary-btn");
    wrap.appendChild(home);
    return wrap;
  }

  // Hands-Free "Learn Like a Kid" Conversation Player on #day-screen
  var PART_ISLANDS = {
    "Part 1: Arrival & Greetings": ["Greetings & Check-ins", "Conversation Repair"],
    "Part 2: Coffee & Hospitality": ["Coffee & Table", "House & Hosts"],
    "Part 3: At the Table": ["Food & Eating", "Coffee & Table"],
    "Part 4: Plans & Getting Around": ["Plans & Weekend", "Getting Around", "Shopping"],
    "Part 5: Warm Goodbyes": ["Greetings & Check-ins", "Family & Warmth"],
  };

  function renderDay(box) {
    var day = window.ShqipDay;
    if (!day || !box) return;
    var title = document.getElementById("day-title");
    var note = document.getElementById("day-note");
    if (title) title.textContent = day.title || "A day with Anila and Ilir";
    if (note) note.textContent = day.note || "";

    // Sticky Player Bar at top
    var playerBar = document.getElementById("day-player-bar");
    if (playerBar) {
      playerBar.innerHTML = "";
      var controls = document.createElement("div");
      controls.className = "day-player-controls";

      var playAllBtn = document.createElement("button");
      playAllBtn.type = "button";
      playAllBtn.id = "day-play-btn";
      playAllBtn.className = "day-player-btn day-play-btn";
      playAllBtn.textContent = dayPlayer.playing ? "⏸ Pause" : "▶ Play All";
      playAllBtn.setAttribute("data-action", "day-play-toggle");
      controls.appendChild(playAllBtn);

      var kidBtn = document.createElement("button");
      kidBtn.type = "button";
      kidBtn.id = "day-kid-btn";
      kidBtn.className = "day-player-btn day-kid-btn" + (dayPlayer.kidMode ? " is-active" : "");
      kidBtn.textContent = dayPlayer.kidMode ? "🔁 Kid Mode: ON" : "🔁 Kid Mode: OFF";
      kidBtn.setAttribute("data-action", "day-kid-toggle");
      controls.appendChild(kidBtn);

      playerBar.appendChild(controls);

      // Scene Jump Pills
      var pills = document.createElement("div");
      pills.className = "day-pills";

      var sceneTitles = [];
      if (Array.isArray(day.scenes) && day.scenes.length) {
        day.scenes.forEach(function (sc) {
          if (sc && sc.title) sceneTitles.push(sc.title);
        });
      } else {
        (day.turns || []).forEach(function (t) {
          if (t && t.part && sceneTitles.indexOf(t.part) === -1) sceneTitles.push(t.part);
        });
      }

      var parts = ["all"].concat(sceneTitles).concat(["unlocked"]);

      parts.forEach(function (p) {
        var pill = document.createElement("button");
        pill.type = "button";
        pill.className = "day-pill" + (dayPlayer.filter === p ? " is-active" : "");
        var label = p === "all" ? "All Scenes" : (p === "unlocked" ? "Play Unlocked Only" : p.replace(/^(Scene \d+|Part \d+):\s*/, "$1 · "));
        pill.textContent = label;
        pill.setAttribute("data-action", "day-filter");
        pill.setAttribute("data-filter", p);
        pills.appendChild(pill);
      });
      playerBar.appendChild(pills);
    }

    // Turns list
    box.innerHTML = "";
    var currentPart = "";
    var lastShownPart = "";
    var boxes = ShqipData.getBoxes();
    var hasBoxes = Object.keys(boxes).length > 0;

    (day.turns || []).forEach(function (turn, idx) {
      if (turn.part) currentPart = turn.part;

      // Filter check
      var show = true;
      if (dayPlayer.filter === "unlocked") {
        var matched = (turn.island ? [turn.island] : []).concat(PART_ISLANDS[currentPart] || []);
        var unlocked = !hasBoxes || matched.some(function (isName) {
          var all = ShqipData.getAllCards();
          return all.some(function (c) { return c.island === isName && boxes[c.id]; });
        });
        show = unlocked;
      } else if (dayPlayer.filter !== "all") {
        show = currentPart === dayPlayer.filter;
      }

      if (currentPart && currentPart !== lastShownPart && show) {
        var partHead = addText(box, "h2", "lesson-label day-part", currentPart);
        partHead.setAttribute("data-part-title", currentPart);
        lastShownPart = currentPart;
      }

      var who = turn.who === "ilir" ? "ilir" : "anila";
      var row = document.createElement("div");
      row.className = "turn " + who;
      row.setAttribute("data-turn-index", String(idx));
      row.setAttribute("data-part", currentPart);
      if (!show) row.hidden = true;

      var top = document.createElement("div");
      top.className = "turn-top";
      addText(top, "span", "who", who === "ilir" ? "Ilir" : "Anila");
      var hear = makeButton("Hear", "day-hear", false);
      hear.classList.add("line-hear");
      hear.setAttribute("data-audio", turn.audio || "");
      hear.setAttribute("data-say", turn.sq || "");
      top.appendChild(hear);
      row.appendChild(top);

      var split = document.createElement("div");
      split.className = "split";
      var al = document.createElement("p");
      al.className = "turn-al";
      al.lang = "sq";
      al.textContent = turn.sq || "";
      var en = document.createElement("p");
      en.className = "turn-en";
      en.textContent = turn.en || "";
      split.appendChild(al);
      split.appendChild(en);
      row.appendChild(split);
      box.appendChild(row);
    });
  }

  function getFilteredTurnElements() {
    var box = document.getElementById("day-list");
    if (!box) return [];
    var turns = box.querySelectorAll(".turn");
    var list = [];
    for (var i = 0; i < turns.length; i++) {
      if (!turns[i].hidden) list.push(turns[i]);
    }
    return list;
  }

  function playDayTurn(index) {
    var turnEls = getFilteredTurnElements();
    if (!dayPlayer.playing || index >= turnEls.length) {
      stopDayPlayer();
      return;
    }
    dayPlayer.stepIndex = index;
    var row = turnEls[index];
    var globalIdx = Number(row.getAttribute("data-turn-index"));
    var turn = window.ShqipDay && window.ShqipDay.turns && window.ShqipDay.turns[globalIdx];
    if (!turn) {
      stopDayPlayer();
      return;
    }

    var allTurns = document.querySelectorAll(".turn.is-playing");
    for (var t = 0; t < allTurns.length; t++) allTurns[t].classList.remove("is-playing");
    row.classList.add("is-playing");
    if (row.scrollIntoView) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    var base = ShqipData.scriptBase();
    var audioUrl = base + "audio/" + (turn.audio || "") + ".mp3";

    // Play 1x (Normal)
    playFile(audioUrl, 1, turn.sq, null, function () {
      if (!dayPlayer.playing) return;
      if (dayPlayer.kidMode) {
        // Kid Mode ON: 1.2s pause -> Slower (0.85x) -> 1.8s pause -> Next turn
        dayPlayer.timer = window.setTimeout(function () {
          if (!dayPlayer.playing) return;
          playFile(audioUrl, 0.85, turn.sq, null, function () {
            if (!dayPlayer.playing) return;
            dayPlayer.timer = window.setTimeout(function () {
              if (!dayPlayer.playing) return;
              playDayTurn(index + 1);
            }, 1800);
          });
        }, 1200);
      } else {
        // Kid Mode OFF: 900ms pause -> Next turn
        dayPlayer.timer = window.setTimeout(function () {
          if (!dayPlayer.playing) return;
          playDayTurn(index + 1);
        }, 900);
      }
    });
  }

  function renderListen() {
    var note = document.getElementById("listen-note");
    var root = document.getElementById("listen-list");
    var data = window.ShqipListen;
    if (!root || !data) return;
    if (note) note.textContent = data.note || "";
    var html = "";
    (data.groups || []).forEach(function (group) {
      html += '<article class="rule-card"><p class="rule-kicker">' + escRule(group.level) + "</p>";
      html += "<h3>" + escRule(group.title) + "</h3><ul class=\"sound-rules\">";
      (group.items || []).forEach(function (item) {
        html += '<li><a class="listen-item" href="' + escRule(item.url) + '" target="_blank" rel="noopener">';
        html += "<b>" + escRule(item.name) + "</b><span>" + escRule(item.detail) + "</span></a></li>";
      });
      html += "</ul></article>";
    });
    root.innerHTML = html;
  }

  function openListen() {
    renderListen();
    showScreen("listen");
  }

  function openDay() {
    var box = document.getElementById("day-list");
    if (box) renderDay(box);
    showScreen("day");
  }

  function escRule(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function ruleCardOpen(topic) {
    var html = '<article class="rule-card" id="rule-' + escRule(topic.id) + '">';
    html += '<p class="rule-kicker">' + escRule(topic.kicker) + "</p>";
    html += "<h3>" + escRule(topic.title) + "</h3>";
    if (topic.lead) html += '<p class="rule-lead">' + escRule(topic.lead) + "</p>";
    return html;
  }

  function renderRules() {
    var root = document.getElementById("rules-list");
    var data = window.ShqipRules;
    if (!root || !data || !data.topics) return;
    var html = "";
    data.topics.forEach(function (topic) {
      html += ruleCardOpen(topic);
      if (topic.type === "letters") {
        html += '<div class="letter-grid">';
        topic.rows.forEach(function (row) {
          html += '<div class="letter-cell"><b>' + escRule(row.letter) + "</b><span>" + escRule(row.say) + "</span></div>";
        });
        html += "</div>";
      } else if (topic.type === "hint") {
        html += '<p class="sound-example" lang="sq">' + escRule(topic.word) + "</p>";
        html += '<p class="sound-hint">' + escRule(topic.hint).replace(/([A-Z]+)/g, "<strong>$1</strong>") + "</p>";
        html += '<ul class="sound-rules">';
        topic.notes.forEach(function (note) {
          html += "<li>" + escRule(note) + "</li>";
        });
        html += "</ul>";
      } else if (topic.type === "facts") {
        topic.rows.forEach(function (row) {
          html += '<div class="fact"><p class="fact-name">' + escRule(row.name) + "</p>";
          html += '<p class="fact-body">' + escRule(row.body);
          if (row.example) html += ' <span class="fact-ex">' + escRule(row.example) + "</span>";
          html += "</p></div>";
        });
      } else if (topic.type === "pairs") {
        html += '<table class="pair-table"><thead><tr>';
        topic.heads.forEach(function (head) {
          html += "<th>" + escRule(head) + "</th>";
        });
        html += "</tr></thead><tbody>";
        topic.rows.forEach(function (row) {
          html += '<tr' + (row[2] ? ' class="is-you"' : "") + ">";
          html += "<td>" + escRule(row[0]) + "</td><td>" + escRule(row[1]) + "</td></tr>";
        });
        html += "</tbody></table>";
      } else if (topic.type === "numbers") {
        html += '<div class="num-grid">';
        topic.rows.forEach(function (row) {
          html += '<div class="num-cell"><b>' + escRule(row[1]) + "</b><span>" + escRule(row[0]) + "</span></div>";
        });
        html += "</div>";
      } else if (topic.type === "notes") {
        html += '<ul class="sound-rules">';
        topic.rows.forEach(function (note) {
          html += "<li>" + escRule(note) + "</li>";
        });
        html += "</ul>";
      }
      html += "</article>";
    });
    var catalog = window.ShqipChecks && window.ShqipChecks.catalog;
    if (catalog) {
      html += '<article class="rule-card"><p class="rule-kicker">Sources</p><h3>What has been checked</h3>';
      html += '<ul class="sound-rules">';
      catalog.forEach(function (item) {
        html += "<li><a class=\"source-link\" href=\"" + escRule(item.url) + "\" target=\"_blank\" rel=\"noopener\">" + escRule(item.name) + "</a>. " + escRule(item.use) + "</li>";
      });
      html += "</ul></article>";
    }
    root.innerHTML = html;
  }

  function openRules() {
    var rulesBox = document.getElementById("show-rules");
    if (rulesBox) rulesBox.checked = true;
    showScreen("rules");
  }

  function setSettingsMessage(text) {
    var el = document.getElementById("settings-message");
    if (el) el.textContent = text || "";
  }

  // Feed interactions
  function onFeedClick(event) {
    var wordBtn = event.target.closest ? event.target.closest("button.word") : null;
    if (wordBtn) {
      playWord(wordBtn.getAttribute("data-word"), wordBtn);
      return;
    }

    var btn = event.target.closest ? event.target.closest("button") : null;
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    var cardEl = btn.closest(".card") || btn.closest(".quiz") || btn.closest(".done-panel");
    if (!cardEl) return;

    if (action === "check-hear") {
      var cur = currentStep();
      if (cur && cur.quiz && cur.quiz.said) {
        var base = ShqipData.scriptBase();
        playFile(base + "audio/" + (cur.quiz.said.audio || "") + ".mp3", 1, cur.quiz.said.albanian, null);
      }
      return;
    }

    if (action === "check-pick") {
      var curCheck = currentStep();
      if (!curCheck || !curCheck.quiz || curCheck.quiz.picked) return;
      curCheck.quiz.picked = true;

      var index = Number(btn.getAttribute("data-index"));
      var choice = curCheck.quiz.choices[index];
      var isMeaning = curCheck.quiz.mode === "meaning";
      var right = isMeaning
        ? (choice && choice.english === curCheck.quiz.correct.english)
        : (choice && (choice.albanian === curCheck.quiz.correct.albanian || choice.english === curCheck.quiz.correct.english));

      var saidEl = cardEl.querySelector(".quiz-said");
      if (saidEl) saidEl.hidden = false;

      var allChoices = cardEl.querySelectorAll("[data-action='check-pick']");
      for (var c = 0; c < allChoices.length; c++) {
        allChoices[c].disabled = true;
        if (Number(allChoices[c].getAttribute("data-index")) === index) {
          allChoices[c].classList.add(right ? "is-correct" : "is-wrong");
        }
      }

      var res = cardEl.querySelector(".quiz-result");
      if (res) {
        res.hidden = false;
        if (right) {
          res.innerHTML = "<p class='result-title is-correct'>✓ Correct!</p><p class='result-body'>" + escRule(curCheck.quiz.correct.albanian) + " — " + escRule(curCheck.quiz.correct.english) + "</p>";
        } else {
          res.innerHTML = "<p class='result-title is-wrong'>Review needed</p><p class='result-body'>Correct: <b>" + escRule(curCheck.quiz.correct.albanian) + "</b> (" + escRule(curCheck.quiz.correct.english) + ")</p>";
        }
      }

      var hBase = ShqipData.scriptBase();
      playFile(hBase + "audio/" + (curCheck.quiz.correct.audio || "") + ".mp3", 1, curCheck.quiz.correct.albanian, null);

      if (right) {
        ShqipData.gradeCard(curCheck.cardId, true);
      } else {
        ShqipData.gradeCard(curCheck.cardId, false);
        var insertPos = Math.min(session.steps.length, session.index + 3);
        var freshQuiz = ShqipData.makeQuizForCard(curCheck.card, curCheck.mode);
        session.steps.splice(insertPos, 0,
          { type: "teach", card: curCheck.card, cardId: curCheck.card.id },
          { type: "check", card: curCheck.card, cardId: curCheck.card.id, mode: curCheck.mode, quiz: freshQuiz }
        );
      }

      var cont = makeButton("Continue", "check-continue", false);
      cont.classList.add("primary-btn", "check-cont-btn");
      cardEl.appendChild(cont);
      return;
    }

    if (action === "check-continue" || action === "teach-next") {
      session.index += 1;
      renderStep();
      return;
    }

    if (action === "done-home") {
      goHome();
      return;
    }

    var id = cardEl.getAttribute("data-id");
    var cur = currentStep();
    var card = cur ? cur.card : null;
    if (!card) return;

    if (action === "play") {
      playCurrent(1);
      return;
    }

    if (action === "slow") {
      playCurrent(0.83);
      return;
    }

    if (action === "compare") {
      recordAndCompare(btn);
      return;
    }

    if (action === "play-exchange") {
      var turns = conversationTurns(card);
      playExchange(card, turns);
      return;
    }

    if (action === "line") {
      var stem = btn.getAttribute("data-audio");
      var say = btn.getAttribute("data-say");
      var row = btn.closest(".turn") || btn.closest(".line-row");
      var base = ShqipData.scriptBase();
      playFile(base + "audio/" + stem + ".mp3", 1, say, function (audio) {
        if (row) followIn(audio, row);
      });
      return;
    }

    if (action === "skip") {
      setCardStatus(id, "skip");
      if (session) {
        session.index += 1;
        renderStep();
      }
      return;
    }

    if (action === "record-family") {
      recordFamilyVoice(card, btn);
      return;
    }

    if (action === "clear-family") {
      ShqipData.clearCustomAudio(card.id);
      renderStep();
      revealWords();
      var more = document.querySelector(".card-more");
      if (more) more.hidden = false;
      return;
    }

    if (action === "more") {
      var extra = cardEl.querySelector(".card-more");
      if (extra) {
        extra.hidden = !extra.hidden;
        if (!extra.hidden && extra.scrollIntoView) extra.scrollIntoView({ block: "nearest" });
      }
      return;
    }

    if (action === "verified") {
      ShqipData.setVerified(id, card.verified !== true);
      renderStep();
      revealWords();
      var opened = document.querySelector(".card-more");
      if (opened) opened.hidden = false;
    }
  }

  function onSavePaste() {
    var box = document.getElementById("paste-box");
    var errorBox = document.getElementById("paste-errors");
    if (!box || !errorBox) return;
    var all = ShqipData.getAllCards();
    var ids = all.map(function (card) { return card.id; });
    var islands = [];
    var seen = {};
    all.forEach(function (card) {
      if (!seen[card.island]) {
        seen[card.island] = true;
        islands.push(card.island);
      }
    });
    var result = ShqipData.validatePaste(box.value, ids, islands);
    errorBox.innerHTML = "";
    if (!result.ok) {
      result.errors.forEach(function (msg) {
        var li = document.createElement("li");
        li.textContent = msg;
        errorBox.appendChild(li);
      });
      return;
    }
    ShqipData.addOwnerCards(result.cards);
    box.value = "";
    showScreen("home");
    renderHome();
    setSettingsMessage("Island saved on this phone.");
  }

  function copyFrom(sourceId, button) {
    var source = document.getElementById(sourceId);
    if (!source) return;
    var text = source.textContent || "";
    var done = function () {
      var original = button.getAttribute("data-label") || button.textContent;
      button.setAttribute("data-label", original);
      button.textContent = "Copied";
      window.setTimeout(function () {
        button.textContent = original;
      }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(source, done);
      });
      return;
    }
    fallbackCopy(source, done);
  }

  function fallbackCopy(source, done) {
    var range = document.createRange();
    range.selectNodeContents(source);
    var selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      /* ignore */
    }
  }

  function onExport() {
    var data = ShqipData.buildBackup();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "shqipfeed-backup.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSettingsMessage("Backup downloaded.");
  }

  function onImportFile(event) {
    var input = event.target;
    var file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        setSettingsMessage("That file is not valid JSON.");
        return;
      }
      var result = ShqipData.applyBackup(parsed);
      if (!result.ok) {
        setSettingsMessage(result.errors.join(" "));
        return;
      }
      updateStorageBanner();
      renderHome();
      setSettingsMessage("Backup imported.");
    };
    reader.onerror = function () {
      setSettingsMessage("Couldn't read that file.");
    };
    reader.readAsText(file);
  }

  function showLoadError() {
    var error = document.getElementById("load-error");
    if (error) error.hidden = false;
    var home = document.getElementById("home-screen");
    var feed = document.getElementById("feed-screen");
    var add = document.getElementById("add-screen");
    var rules = document.getElementById("rules-screen");
    var day = document.getElementById("day-screen");
    var listen = document.getElementById("listen-screen");
    if (home) home.hidden = true;
    if (feed) feed.hidden = true;
    if (add) add.hidden = true;
    if (rules) rules.hidden = true;
    if (day) day.hidden = true;
    if (listen) listen.hidden = true;
  }

  function boot() {
    updateStorageBanner();
    ShqipData.loadStarterCards().then(function () {
      var error = document.getElementById("load-error");
      if (error) error.hidden = true;
      showScreen("home");
      renderHome();
      registerServiceWorker();
    }).catch(function () {
      showLoadError();
    });
  }

  function registerServiceWorker() {
    if (window.__SHQIP_EMBEDDED) return;
    if (!("serviceWorker" in navigator)) return;
    var base = ShqipData.scriptBase();
    navigator.serviceWorker.register(base + "sw.js", { scope: base }).then(function () {
      showOfflineNote();
    }).catch(function () {
      showOfflineNote();
    });
    navigator.serviceWorker.addEventListener("controllerchange", showOfflineNote);
  }

  function showOfflineNote() {
    var note = document.getElementById("offline-note");
    if (!note || window.__SHQIP_EMBEDDED) return;
    note.hidden = false;
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      note.textContent = "Saved on this phone. It opens with no signal.";
    } else {
      note.textContent = "Leave this page open until it finishes saving. Then add it to your home screen. After that it opens with no signal.";
    }
  }

  function start() {
    if (!document.getElementById("start-btn")) return;
    renderRules();
    var feed = document.getElementById("card-feed");
    if (feed) feed.addEventListener("click", onFeedClick);

    var back = document.getElementById("back-btn");
    if (back) back.addEventListener("click", goBack);

    var homeBtn = document.getElementById("home-btn");
    if (homeBtn) homeBtn.addEventListener("click", goHome);

    var saveCopy = document.getElementById("save-copy-btn");
    if (saveCopy) saveCopy.addEventListener("click", onExport);

    var settingsToggle = document.getElementById("settings-toggle");
    var settings = document.getElementById("settings");
    if (settingsToggle && settings) {
      settingsToggle.addEventListener("click", function () {
        settings.hidden = !settings.hidden;
      });
    }

    var rulesBox = document.getElementById("show-rules");
    if (rulesBox) {
      rulesBox.addEventListener("change", function () {
        showScreen(rulesBox.checked ? "rules" : "home");
      });
    }

    var startBtn = document.getElementById("start-btn");
    if (startBtn) {
      startBtn.addEventListener("click", openSession);
    }
    var dayBtn = document.getElementById("day-btn");
    if (dayBtn) dayBtn.addEventListener("click", openDay);

    var listenBtn = document.getElementById("listen-btn");
    if (listenBtn) listenBtn.addEventListener("click", openListen);

    var islands = document.getElementById("island-picker");
    if (islands) {
      islands.addEventListener("click", function (event) {
        var btn = event.target.closest ? event.target.closest(".curriculum-card, .island-btn") : null;
        if (!btn) return;
        openIsland(btn.getAttribute("data-island") || "");
      });
    }

    var dayScreen = document.getElementById("day-screen");
    if (dayScreen) {
      dayScreen.addEventListener("click", function (event) {
        var btn = event.target.closest ? event.target.closest("button") : null;
        if (!btn) return;
        var action = btn.getAttribute("data-action");

        if (action === "day-play-toggle") {
          if (dayPlayer.playing) {
            stopDayPlayer();
          } else {
            dayPlayer.playing = true;
            btn.textContent = "⏸ Pause";
            playDayTurn(0);
          }
          return;
        }

        if (action === "day-kid-toggle") {
          dayPlayer.kidMode = !dayPlayer.kidMode;
          btn.textContent = dayPlayer.kidMode ? "🔁 Kid Mode: ON" : "🔁 Kid Mode: OFF";
          btn.classList.toggle("is-active", dayPlayer.kidMode);
          return;
        }

        if (action === "day-filter") {
          var f = btn.getAttribute("data-filter") || "all";
          dayPlayer.filter = f;
          var box = document.getElementById("day-list");
          renderDay(box);
          if (dayPlayer.playing) {
            playDayTurn(0);
          }
          return;
        }

        if (action === "day-hear") {
          var stem = btn.getAttribute("data-audio");
          var say = btn.getAttribute("data-say") || "";
          if (!stem) return;
          playFile(ShqipData.scriptBase() + "audio/" + stem + ".mp3", 1, say, null);
        }
      });
    }

    var capAuto = document.getElementById("cap-auto");
    var capBeginner = document.getElementById("cap-beginner");
    if (capAuto) {
      capAuto.addEventListener("click", function () {
        ShqipData.setCap("auto");
        renderHome();
      });
    }
    if (capBeginner) {
      capBeginner.addEventListener("click", function () {
        ShqipData.setCap("beginner");
        renderHome();
      });
    }

    var addBtn = document.getElementById("add-island-btn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var errors = document.getElementById("paste-errors");
        if (errors) errors.innerHTML = "";
        showScreen("add");
      });
    }

    var savePaste = document.getElementById("save-paste-btn");
    if (savePaste) savePaste.addEventListener("click", onSavePaste);

    var copyExample = document.getElementById("copy-example-btn");
    if (copyExample) {
      copyExample.addEventListener("click", function () {
        copyFrom("example-json", copyExample);
      });
    }
    var copyPrompt = document.getElementById("copy-prompt-btn");
    if (copyPrompt) {
      copyPrompt.addEventListener("click", function () {
        copyFrom("ai-prompt", copyPrompt);
      });
    }

    var resetBtn = document.getElementById("reset-btn");
    var resetConfirm = document.getElementById("reset-confirm");
    if (resetBtn && resetConfirm) {
      resetBtn.addEventListener("click", function () {
        resetConfirm.hidden = false;
      });
    }
    var resetNo = document.getElementById("reset-no");
    if (resetNo && resetConfirm) {
      resetNo.addEventListener("click", function () {
        resetConfirm.hidden = true;
      });
    }
    var resetYes = document.getElementById("reset-yes");
    if (resetYes && resetConfirm) {
      resetYes.addEventListener("click", function () {
        resetProgress();
        resetConfirm.hidden = true;
        renderHome();
        setSettingsMessage("Progress reset.");
      });
    }

    var exportBtn = document.getElementById("export-btn");
    if (exportBtn) exportBtn.addEventListener("click", onExport);
    var importFile = document.getElementById("import-file");
    if (importFile) importFile.addEventListener("change", onImportFile);

    var retry = document.getElementById("retry-btn");
    if (retry) retry.addEventListener("click", boot);

    boot();
  }

  window.ShqipApp = {
    getProgress: getProgress,
    setCardStatus: setCardStatus,
    resetProgress: resetProgress,
    start: start,
    openRules: openRules,
    renderCard: renderCard,
    renderCheck: renderCheck,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
