/* app.js
   Draws the screens, wires the buttons, and plays a saved Albanian recording.
   Card text and saving live in data.js. This file only handles the screen and audio.
*/
(function () {
  if (window.__SHQIP_APP_LOADED) return;
  window.__SHQIP_APP_LOADED = true;

  var currentIsland = "";

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
    var back = document.getElementById("back-btn");
    if (home) home.hidden = name !== "home" && name !== "rules";
    if (feed) feed.hidden = name !== "feed";
    if (add) add.hidden = name !== "add";
    if (rules) rules.hidden = false;
    if (day) day.hidden = name !== "day";
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
    updateNav();
    window.scrollTo(0, 0);
  }

  // Back steps to the previous card. Home leaves the lesson.
  function updateNav() {
    var back = document.getElementById("back-btn");
    var home = document.getElementById("home-btn");
    var root = document.getElementById("shqip-root");
    var screen = root ? root.getAttribute("data-screen") : "home";
    var canBack = false;
    if (screen === "feed" && session && session.queue && session.queue.length) {
      if (session.mode === "card") canBack = session.index > 0;
      else canBack = true;
    }
    if (back) back.hidden = !canBack;
    if (home) home.hidden = screen === "home";
  }

  function goHome() {
    stopAudio();
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
    if (session.mode === "done" && session.quizzed && session.quiz) {
      session.mode = "quiz";
    } else if (session.mode === "quiz" || session.mode === "done") {
      session.mode = "card";
      session.index = Math.max(0, session.queue.length - 1);
    } else if (session.index > 0) {
      session.index -= 1;
      session.mode = "card";
    }
    renderStep();
  }

  // The full-day visit. Each Hear button plays Anila or Ilir, not the lesson voice.
  function renderDay(box) {
    var day = window.ShqipDay;
    if (!day || !box) return;
    var title = document.getElementById("day-title");
    var note = document.getElementById("day-note");
    if (title) title.textContent = day.title || "A day with Anila and Ilir";
    if (note) note.textContent = day.note || "";
    box.innerHTML = "";
    (day.turns || []).forEach(function (turn) {
      if (turn.part) addText(box, "h2", "lesson-label day-part", turn.part);
      var who = turn.who === "ilir" ? "ilir" : "anila";
      var row = document.createElement("div");
      row.className = "turn " + who;
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

  function openDay() {
    var box = document.getElementById("day-list");
    if (box && !box.childElementCount) renderDay(box);
    showScreen("day");
  }

  // Opens the rules page. The four tabs are radio buttons, so they switch without this.
  function escRule(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
  }

  function ruleCardOpen(topic) {
    var html = '<article class="rule-card" id="rule-' + escRule(topic.id) + '">';
    html += '<p class="rule-kicker">' + escRule(topic.kicker) + "</p>";
    html += "<h3>" + escRule(topic.title) + "</h3>";
    if (topic.lead) html += '<p class="rule-lead">' + escRule(topic.lead) + "</p>";
    return html;
  }

  // Draws the rules page from ShqipRules. The JSON-like object is the database.
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

  var cardIndex = 0;
  var activeAudio = null;
  var activeRecorder = null;
  var discardRecording = false;
  var session = null;

  // Fills Start / Continue and the progress lists under Settings.
  function renderHome() {
    var today = ShqipData.buildToday();
    var where = document.getElementById("home-where");
    var start = document.getElementById("start-btn");
    if (where) where.textContent = today.where;
    if (start) {
      if (!today.started) start.textContent = "Start";
      else if (today.caughtUp) start.textContent = "Practice more";
      else start.textContent = "Continue";
      start.disabled = false;
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
    renderIslands();
  }

  // Topics sit on the home screen. Each one starts a short session.
  function renderIslands() {
    var box = document.getElementById("island-picker");
    if (!box) return;
    box.innerHTML = "";
    ShqipData.islandProgress().forEach(function (row) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "island-btn";
      btn.setAttribute("data-island", row.name);
      var name = document.createElement("span");
      name.textContent = row.name;
      var count = document.createElement("span");
      count.className = "island-count";
      count.textContent = row.inBoxes + " of " + row.total + " started";
      btn.appendChild(name);
      btn.appendChild(count);
      box.appendChild(btn);
    });
  }

  function beginQueue(queue, newIds) {
    if (!queue.length) {
      renderHome();
      return;
    }
    session = {
      queue: queue,
      newIds: newIds || [],
      index: 0,
      newGraded: 0,
      quizzed: false,
      graded: {},
      mode: "card",
      quiz: null,
    };
    showScreen("feed");
    renderStep();
  }

  // Opens today's queue. If nothing is due, practice eight lines anyway.
  function openSession() {
    var today = ShqipData.buildToday();
    if (today.queue.length) {
      beginQueue(today.queue, today.newIds);
      return;
    }
    beginQueue(ShqipData.practiceQueue(null, 8), []);
  }

  function openIsland(name) {
    beginQueue(ShqipData.practiceQueue(name, 8), []);
  }

  // The card on screen right now.
  function currentCard() {
    if (!session || session.mode !== "card") return null;
    return session.queue[session.index] || null;
  }

  // A thin bar under the title. Filled segments are the lines already reached.
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

  // Draws the current line, the check, or the end of the day.
  function renderStep() {
    var feed = document.getElementById("card-feed");
    var title = document.getElementById("feed-title");
    if (!feed || !session) return;
    stopAudio();
    feed.innerHTML = "";
    if (session.mode === "quiz") {
      if (title) {
        title.hidden = false;
        title.textContent = "Check";
      }
      renderProgress(session.queue.length, session.queue.length);
      feed.appendChild(renderQuiz());
      var said = session.quiz && session.quiz.said;
      if (said) {
        playFile(ShqipData.scriptBase() + "audio/" + (said.audio || "") + ".mp3", 1, said.albanian, null);
      }
      updateNav();
      return;
    }
    if (session.mode === "done") {
      if (title) {
        title.hidden = false;
        title.textContent = "Today";
      }
      renderProgress(session.queue.length, session.queue.length);
      feed.appendChild(renderDone());
      updateNav();
      return;
    }
    var card = currentCard();
    if (!card) {
      finishOrQuiz();
      return;
    }
    if (title) {
      title.hidden = false;
      title.textContent = card.island;
    }
    renderProgress(session.index, session.queue.length);
    feed.appendChild(renderCard(card, getProgress(), session.index, session.queue.length));
    playCurrent(1);
    updateNav();
  }

  // Strips punctuation so a tapped word matches its sound file.
  function cleanWord(token) {
    return String(token || "").replace(/^[«»"'“”.,!?¿;:()]+|[«»"'“”.,!?¿;:()]+$/g, "");
  }

  // One phrase, in order: when to use it, the line, then the words and the exchange after you hear it.
  function renderCard(card, progress, index, total) {
    var article = document.createElement("article");
    article.className = "card" + (card.lesson ? " has-lesson" : "");
    article.setAttribute("data-id", card.id);
    article.setAttribute("aria-label", (index + 1) + " of " + total);

    if (card.lesson && card.lesson.background) {
      addText(article, "p", "when-line", card.lesson.background);
    }

    var stage = document.createElement("div");
    stage.className = "card-stage";
    addText(stage, "p", "card-english", card.english);

    var words = document.createElement("div");
    words.className = "card-words card-albanian";
    words.lang = "sq";
    card.albanian.split(/\s+/).forEach(function (token) {
      var word = cleanWord(token);
      if (!word) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word";
      btn.setAttribute("data-word", word);
      btn.textContent = token;
      words.appendChild(btn);
    });
    stage.appendChild(words);
    stage.appendChild(sourceLine(card.albanian));
    var blocks = renderBlocks(card);
    if (blocks) stage.appendChild(blocks);

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
    nav.className = "card-nav";
    if (card.review === false) {
      nav.appendChild(makeButton("Next", "next", false));
    } else if (session && session.graded && session.graded[card.id]) {
      nav.appendChild(makeButton("Next", "forward", false));
    } else {
      nav.classList.add("after-listen");
      nav.hidden = true;
      nav.appendChild(makeButton("Again", "again", false));
      nav.appendChild(makeButton("Got it", "got", false));
    }
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
    article.appendChild(more);
    return article;
  }

  // A pronunciation is shown only when a published page prints that exact sentence or word.
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

  // Color chips for the pieces of the line, when the line is actually split.
  function renderBlocks(card) {
    var blocks = card.blocks || [];
    var useful = blocks.filter(function (block) { return block && block.text; });
    if (useful.length < 2) return null;
    var row = document.createElement("div");
    row.className = "blocks";
    useful.forEach(function (block) {
      var pill = document.createElement("span");
      var kind = block.type === "power" || block.type === "verb" || block.type === "object" ? block.type : "other";
      pill.className = "block block-" + kind;
      pill.textContent = block.text;
      row.appendChild(pill);
    });
    return row;
  }

  // Facts already written as "Word is meaning", matched to the line. Nothing is guessed.
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

  // Words from the shared list, used only when a line has no table of its own.
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

  // Facts that did not become a table row. Shown under More, not on the card.
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

  // You, then what they say, then what you say back. A number does not get a fake exchange.
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

  // The word table and the conversation. Hidden until the line has played.
  function renderLesson(card) {
    var rows = glossRows(card);
    var turns = conversationTurns(card);
    if (!rows.length && !turns.length) return null;
    var wrap = document.createElement("div");
    wrap.className = "lesson-rest after-listen";
    wrap.hidden = true;

    if (rows.length) {
      var words = document.createElement("section");
      words.className = "lesson-block";
      addText(words, "h2", "lesson-label", "Words");
      var table = document.createElement("table");
      table.className = "word-table";
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        var sq = document.createElement("td");
        sq.className = "sq";
        sq.lang = "sq";
        sq.textContent = row.sq;
        var rec = wordSource(row.sq);
        if (rec && rec.ipa && rec.ipa.length) {
          var ipa = document.createElement("span");
          ipa.className = "ipa";
          ipa.textContent = rec.ipa.map(function (item) {
            return (item.accent ? item.accent + " " : "") + item.ipa;
          }).join(" · ");
          sq.appendChild(document.createTextNode(" "));
          sq.appendChild(ipa);
        }
        var en = document.createElement("td");
        en.className = "en";
        en.textContent = row.en;
        tr.appendChild(sq);
        tr.appendChild(en);
        table.appendChild(tr);
      });
      words.appendChild(table);
      wrap.appendChild(words);
    }

    if (turns.length) {
      var talk = document.createElement("section");
      talk.className = "lesson-block";
      addText(talk, "h2", "lesson-label", "After you");
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
          var word = cleanWord(token);
          if (!word) return;
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "word";
          btn.setAttribute("data-word", word);
          btn.textContent = token;
          al.appendChild(btn);
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
    }
    return wrap;
  }

  // Adds a text-only element so pasted phrases cannot inject HTML.
  function addText(parent, tag, className, text) {
    var el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  // A large button. Pressed state is used for Known, Skip, and Verified.
  function makeButton(label, action, pressed) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-btn" + (pressed ? " is-on" : "");
    btn.setAttribute("data-action", action);
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.textContent = label;
    return btn;
  }

  // Finds an Albanian (sq) voice, if the phone has one. Never throws.
  function albanianVoice() {
    if (!window.speechSynthesis || typeof window.speechSynthesis.getVoices !== "function") return null;
    var voices = [];
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch (err) {
      return null;
    }
    for (var i = 0; i < voices.length; i++) {
      var lang = (voices[i].lang || "").toLowerCase();
      if (lang === "sq" || lang.indexOf("sq-") === 0) return voices[i];
    }
    return null;
  }

  // Stops whatever is playing so two phrases never talk over each other.
  function stopAudio() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    if (activeRecorder && activeRecorder.state === "recording") {
      discardRecording = true;
      try { activeRecorder.stop(); } catch (err) { /* already stopped */ }
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (err) { /* ignore */ }
    }
    var words = document.querySelectorAll(".word.is-now");
    for (var i = 0; i < words.length; i++) words[i].classList.remove("is-now");
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

  // Shows the Albanian words and the next step once sound has started.
  function revealWords() {
    var words = document.querySelector(".card-words");
    if (words) words.hidden = false;
    var rest = document.querySelectorAll(".after-listen");
    for (var i = 0; i < rest.length; i++) rest[i].hidden = false;
  }

  // Plays a saved recording. If the file is missing, falls back to the phone voice.
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
    function handOffToVoice() {
      if (handedOff) return;
      handedOff = true;
      if (altUrl) {
        var next = altUrl;
        if (activeAudio === audio) activeAudio = null;
        playFile(next, rate, fallbackText, onTime, onEnded, altUrl2 || "", "");
        return;
      }
      if (activeAudio === audio) activeAudio = null;
      speak(fallbackText, rate, note);
    }
    audio.addEventListener("error", handOffToVoice);
    audio.addEventListener("loadedmetadata", function () {
      try { audio.playbackRate = rate; } catch (err) { /* some browsers ignore this */ }
    });
    audio.addEventListener("playing", function () {
      if (note) note.hidden = true;
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
        if (note) note.hidden = true;
        revealWords();
        try { audio.playbackRate = rate; } catch (err) { /* ignore */ }
      }).catch(function (err) {
        if (err && err.name === "NotAllowedError") {
          if (activeAudio === audio) activeAudio = null;
          return;
        }
        handOffToVoice();
      });
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

  // Saves the box, asks a miss again later in this session, then moves on.
  function gradeAndAdvance(gotIt) {
    var card = currentCard();
    if (!card || !session) return;
    ShqipData.gradeCard(card.id, gotIt);
    if (session.graded) session.graded[card.id] = true;
    if (!gotIt) session.queue.push(card);
    if (session.newIds.indexOf(card.id) !== -1 && !card._newGraded) {
      card._newGraded = true;
      session.newGraded += 1;
    }
    session.index += 1;
    finishStep();
  }

  // The count is not a box. Next only marks it heard.
  function passAndAdvance() {
    var card = currentCard();
    if (!card || !session) return;
    ShqipData.passCard(card.id);
    if (session.graded) session.graded[card.id] = true;
    session.index += 1;
    finishStep();
  }

  function finishStep() {
    if (!session.quizzed && session.newIds.length && session.newGraded >= session.newIds.length) {
      session.quizzed = true;
      session.mode = "quiz";
      session.quiz = makeQuiz();
      renderStep();
      return;
    }
    if (session.index >= session.queue.length) {
      session.mode = "done";
      renderStep();
      return;
    }
    session.mode = "card";
    renderStep();
  }

  // A line the check can play.
  function asLine(line, fallbackId) {
    return {
      english: line.english,
      albanian: line.albanian,
      audio: line.audio || fallbackId || line.id || "",
    };
  }

  // Reply check when the card has one. A bare number asks for the meaning instead.
  function quizSource(card) {
    var lesson = card.lesson || {};
    if (lesson.kind === "count") return null;
    if (lesson.kind !== "word" && lesson.turns && lesson.turns.length) {
      var they = null;
      var you = null;
      lesson.turns.forEach(function (turn) {
        if (turn.who === "they" && !they) they = turn;
        if (turn.who === "you" && !you) you = turn;
      });
      if (they && you) return { mode: "reply", said: asLine(they), correct: asLine(you), cardId: card.id };
    }
    if (lesson.kind !== "word" && lesson.reply) {
      var said = (lesson.answers && lesson.answers[0]) ? lesson.answers[0] : card;
      return { mode: "reply", said: asLine(said, card.audio || card.id), correct: asLine(lesson.reply), cardId: card.id };
    }
    return { mode: "meaning", said: asLine(card, card.audio || card.id), correct: asLine(card, card.audio || card.id), cardId: card.id };
  }

  // After the new lines, one check.
  function makeQuiz() {
    var pool = [];
    session.queue.forEach(function (card) {
      if (session.newIds.indexOf(card.id) !== -1) pool.push(card);
    });
    var source = null;
    for (var i = 0; i < pool.length; i++) {
      var next = quizSource(pool[i]);
      if (!next) continue;
      if (!source || (source.mode !== "reply" && next.mode === "reply")) source = next;
    }
    if (!source) source = quizSource(pool[0] || session.queue[0]);
    var choices = [source.correct];
    var all = ShqipData.getAllCards();
    var sourceCard = null;
    for (var c = 0; c < all.length; c++) {
      if (all[c].id === source.cardId) sourceCard = all[c];
    }
    var bag = [];
    all.forEach(function (card) {
      if (!card.english || card.english === source.correct.english) return;
      bag.push(card);
    });
    bag.sort(function () { return Math.random() - 0.5; });
    if (sourceCard) {
      var same = bag.filter(function (card) { return card.island === sourceCard.island; });
      var rest = bag.filter(function (card) { return card.island !== sourceCard.island; });
      bag = same.concat(rest);
    }
    for (var n = 0; n < bag.length && choices.length < 3; n++) {
      choices.push(asLine(bag[n], bag[n].audio || bag[n].id));
    }
    for (var s = choices.length - 1; s > 0; s--) {
      var swap = Math.floor(Math.random() * (s + 1));
      var hold = choices[s];
      choices[s] = choices[swap];
      choices[swap] = hold;
    }
    return {
      mode: source.mode,
      said: source.said,
      correct: source.correct,
      choices: choices,
      cardId: source.cardId,
      picked: false,
    };
  }

  // The check screen. A wrong tap sends that line back to box 1.
  function renderQuiz() {
    var quiz = session.quiz;
    var wrap = document.createElement("div");
    wrap.className = "quiz";
    addText(wrap, "p", "lesson-label", quiz.mode === "meaning" ? "You hear" : "They said");
    addText(wrap, "p", "quiz-said", quiz.said.albanian);
    var hear = makeButton("Hear", "quiz-hear", false);
    hear.classList.add("line-hear");
    wrap.appendChild(hear);
    addText(wrap, "p", "lesson-label", quiz.mode === "meaning" ? "What does it mean?" : "What do you say?");
    quiz.choices.forEach(function (choice, index) {
      var btn = makeButton(choice.english, "quiz-pick", false);
      btn.classList.add("quiz-choice");
      btn.setAttribute("data-index", String(index));
      wrap.appendChild(btn);
    });
    var result = document.createElement("p");
    result.className = "quiz-result";
    result.hidden = true;
    wrap.appendChild(result);
    return wrap;
  }

  // Shown when the due lines and the new lines are finished.
  function renderDone() {
    var wrap = document.createElement("div");
    wrap.className = "done-panel";
    addText(wrap, "p", "done-title", "That's today.");
    var counts = ShqipData.boxCounts();
    addText(wrap, "p", "done-detail",
      "Box 1 " + counts[1] + " · Box 2 " + counts[2] + " · Box 3 " + counts[3] +
      " · Box 4 " + counts[4] + " · Box 5 " + counts[5]
    );
    var home = makeButton("Home", "done-home", false);
    home.classList.add("primary-btn");
    wrap.appendChild(home);
    return wrap;
  }

  function finishOrQuiz() {
    if (!session) return;
    session.mode = "done";
    renderStep();
  }
  function playCurrent(rate) {
    var card = currentCard();
    if (!card) return;
    if (card.playlist && card.playlist.length) {
      playPlaylist(card.playlist, rate);
      return;
    }
    var base = ShqipData.scriptBase();
    playFile(base + "audio/" + (card.audio || card.id) + ".mp3", rate, card.albanian, followPhrase);
  }

  // Plays the count one number at a time, using the recordings that already exist.
  function playPlaylist(stems, rate) {
    var index = 0;
    var base = ShqipData.scriptBase();
    function step() {
      var card = currentCard();
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
  function otherCase(word) {
    if (!word) return "";
    var first = word.charAt(0);
    var lower = first.toLocaleLowerCase("sq");
    var upper = first.toLocaleUpperCase("sq");
    var flipped = first === lower ? upper : lower;
    if (flipped === first) return "";
    return flipped + word.slice(1);
  }

  function playWord(word, button) {
    if (!word) return;
    var lit = document.querySelectorAll(".word.is-now");
    for (var i = 0; i < lit.length; i++) lit[i].classList.remove("is-now");
    if (button) button.classList.add("is-now");
    var base = ShqipData.scriptBase();
    var lower = word.toLocaleLowerCase("sq");
    var urls = [];
    function addWordUrl(form) {
      if (!form) return;
      var next = base + "audio/words/" + encodeURIComponent(form) + ".mp3";
      if (urls.indexOf(next) === -1) urls.push(next);
    }
    addWordUrl(lower);
    addWordUrl(word);
    addWordUrl(otherCase(word));
    playFile(urls[0], 1, word, null, null, urls[1] || "", urls[2] || "");
    if (button) button.classList.add("is-now");
  }

  // Last resort when a recording is missing: the phone's Albanian voice, or "No audio yet".
  function speak(text, rate, noteEl) {
    function showMissing() {
      revealWords();
      if (noteEl) {
        noteEl.hidden = false;
        noteEl.textContent = "No audio yet";
      }
    }
    function go() {
      try {
        var voice = albanianVoice();
        if (!voice || !window.speechSynthesis) {
          showMissing();
          return;
        }
        if (noteEl) {
          noteEl.hidden = false;
          noteEl.textContent = "Phone voice. The recording is missing.";
        }
        revealWords();
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang || "sq";
        utterance.rate = rate;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        showMissing();
      }
    }
    if (!window.speechSynthesis) {
      showMissing();
      return;
    }
    var existing = [];
    try {
      existing = window.speechSynthesis.getVoices() || [];
    } catch (err) {
      showMissing();
      return;
    }
    if (existing.length > 0) {
      go();
      return;
    }
    var done = false;
    var timer = window.setTimeout(function () {
      if (done) return;
      done = true;
      go();
    }, 500);
    try {
      window.speechSynthesis.addEventListener("voiceschanged", function onVoices() {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        go();
      });
    } catch (err) {
      go();
    }
  }

  // Check and end-of-day buttons are not on a phrase card.
  function runQuizAction(action, btn, cardEl) {
    if (action === "quiz-hear") {
      var quiz = session && session.quiz;
      if (!quiz) return;
      var base = ShqipData.scriptBase();
      var stem = quiz.picked ? (quiz.correct.audio || "") : (quiz.said.audio || "");
      var say = quiz.picked ? quiz.correct.albanian : quiz.said.albanian;
      playFile(base + "audio/" + stem + ".mp3", 1, say, null);
      return;
    }
    if (action === "quiz-pick") {
      var quizPick = session && session.quiz;
      if (!quizPick || quizPick.picked) return;
      quizPick.picked = true;
      var index = Number(btn.getAttribute("data-index"));
      var choice = quizPick.choices[index];
      var right = choice && choice.english === quizPick.correct.english;
      if (!right) ShqipData.gradeCard(quizPick.cardId, false);
      var result = cardEl.querySelector(".quiz-result");
      if (result) {
        result.hidden = false;
        result.textContent = right
          ? "Yes. " + quizPick.correct.albanian
          : "Not that one. " + quizPick.correct.albanian;
      }
      var picks = cardEl.querySelectorAll("[data-action='quiz-pick']");
      for (var p = 0; p < picks.length; p++) picks[p].disabled = true;
      var next = makeButton("Continue", "quiz-next", false);
      next.classList.add("primary-btn");
      cardEl.appendChild(next);
      var hearBase = ShqipData.scriptBase();
      playFile(hearBase + "audio/" + (quizPick.correct.audio || "") + ".mp3", 1, quizPick.correct.albanian, null);
      return;
    }
    if (action === "quiz-next") {
      session.mode = "card";
      if (session.index >= session.queue.length) session.mode = "done";
      renderStep();
      return;
    }
    if (action === "done-home") {
      goHome();
    }
  }

  // Handles Play, Slow, Got it, and Again on whatever card was tapped.
  // Records a short try, plays it, then plays the line again.
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

  function onFeedClick(event) {
    var wordBtn = event.target.closest ? event.target.closest(".word") : null;
    if (wordBtn) {
      playWord(wordBtn.getAttribute("data-word"), wordBtn);
      return;
    }
    var btn = event.target.closest ? event.target.closest("button") : null;
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    var cardEl = btn.closest(".card") || btn.closest(".quiz") || btn.closest(".done-panel");
    if (!cardEl) return;
    if (action === "quiz-hear" || action === "quiz-pick" || action === "quiz-next" || action === "done-home") {
      runQuizAction(action, btn, cardEl);
      return;
    }
    var id = cardEl.getAttribute("data-id");
    var cards = ShqipData.getAllCards();
    var card = null;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].id === id) card = cards[i];
    }
    if (!card) return;
    if (action === "play") {
      playCurrent(1);
      return;
    }
    if (action === "slow") {
      playCurrent(0.82);
      return;
    }
    if (action === "compare") {
      recordAndCompare(btn);
      return;
    }
    if (action === "got") {
      gradeAndAdvance(true);
      return;
    }
    if (action === "again") {
      gradeAndAdvance(false);
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
    if (action === "next" || action === "forward") {
      if (action === "forward") {
        session.index += 1;
        finishStep();
        return;
      }
      passAndAdvance();
      return;
    }
    if (action === "known" || action === "skip") {
      if (action === "skip") {
        setCardStatus(id, "skip");
        if (session) {
          session.index += 1;
          finishStep();
        }
        return;
      }
      toggleStatus(id, action);
      var status = getProgress()[id] || null;
      var marks = cardEl.querySelectorAll("[data-action='known'], [data-action='skip']");
      for (var b = 0; b < marks.length; b++) {
        var on = status === marks[b].getAttribute("data-action");
        marks[b].classList.toggle("is-on", on);
        marks[b].setAttribute("aria-pressed", on ? "true" : "false");
      }
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

  // Checks the paste box and, if it is valid, saves the new island.
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

  // Copies the example or the AI prompt. Falls back to selecting the text.
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

  // Selects a pre block when the clipboard API is missing or blocked.
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
      /* The text stays selected so the owner can copy it by hand. */
    }
  }

  // Downloads owner islands, verified flags, and progress as one JSON file.
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

  // Reads a backup file and replaces owner islands, verified flags, and progress.
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

  // Shows the load error and a Retry button. The rest of the app stays quiet.
  function showLoadError() {
    var error = document.getElementById("load-error");
    if (error) error.hidden = false;
    var home = document.getElementById("home-screen");
    var feed = document.getElementById("feed-screen");
    var add = document.getElementById("add-screen");
    var rules = document.getElementById("rules-screen");
    var day = document.getElementById("day-screen");
    if (home) home.hidden = true;
    if (feed) feed.hidden = true;
    if (add) add.hidden = true;
    if (rules) rules.hidden = true;
    if (day) day.hidden = true;
  }

  // Loads cards.json, then shows the island list. On failure, offers Retry.
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

  // Saves the whole app on the phone. Skipped inside the chat preview, which is not the phone copy.
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

  // Hooks up buttons once. Tests can call the progress helpers without this running.
  function start() {
    if (!document.getElementById("start-btn")) return;
    renderRules();
    var feed = document.getElementById("card-feed");
    if (feed) feed.addEventListener("click", onFeedClick);

    var back = document.getElementById("back-btn");
    if (back) {
      back.addEventListener("click", function () {
        goBack();
      });
    }
    var homeBtn = document.getElementById("home-btn");
    if (homeBtn) {
      homeBtn.addEventListener("click", function () {
        goHome();
      });
    }
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
      startBtn.addEventListener("click", function () {
        openSession();
      });
    }
    var dayBtn = document.getElementById("day-btn");
    if (dayBtn) dayBtn.addEventListener("click", openDay);
    var islands = document.getElementById("island-picker");
    if (islands) {
      islands.addEventListener("click", function (event) {
        var btn = event.target.closest ? event.target.closest(".island-btn") : null;
        if (!btn) return;
        openIsland(btn.getAttribute("data-island") || "");
      });
    }
    var dayScreen = document.getElementById("day-screen");
    if (dayScreen) {
      dayScreen.addEventListener("click", function (event) {
        var btn = event.target.closest ? event.target.closest("button") : null;
        if (!btn || btn.getAttribute("data-action") !== "day-hear") return;
        var stem = btn.getAttribute("data-audio");
        var say = btn.getAttribute("data-say") || "";
        if (!stem) return;
        playFile(ShqipData.scriptBase() + "audio/" + stem + ".mp3", 1, say, null);
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
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
