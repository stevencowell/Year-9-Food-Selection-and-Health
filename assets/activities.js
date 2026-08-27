(() => {
  "use strict";

  const answerData = window.FOOD_SELECTION_ACTIVITY_ANSWERS || {};

  function normalise(value) {
    return String(value || "").trim().toLocaleLowerCase("en-AU").replace(/[.!?]+$/g, "");
  }

  function readState(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? { answers: {}, correct: {}, ...parsed } : { answers: {}, correct: {} };
    } catch {
      return { answers: {}, correct: {} };
    }
  }

  function saveState(key, state) {
    const next = { ...state, updated_at: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(next));
    document.dispatchEvent(new CustomEvent("foodselection:progress"));
    return next;
  }

  function renderCard(card, state) {
    const activity = answerData[card.dataset.activityId];
    if (!activity) return;
    let attempted = 0;
    let correct = 0;
    Object.entries(activity.items).forEach(([itemId, item]) => {
      const value = state.answers[itemId];
      const control = card.querySelector(`[data-answer-for="${itemId}"]`);
      if (control && value !== undefined && control.value !== value) control.value = value;
      const feedback = card.querySelector(`[data-feedback-for="${itemId}"]`);
      if (value !== undefined && value !== "") {
        attempted += 1;
        const isCorrect = normalise(value) === normalise(item.correct);
        if (isCorrect) correct += 1;
        if (feedback) {
          feedback.hidden = false;
          feedback.dataset.state = isCorrect ? "correct" : "review";
          feedback.textContent = `${isCorrect ? "Correct. " : "Review. "}${item.feedback}`;
        }
      } else if (feedback) {
        feedback.hidden = true;
        feedback.textContent = "";
        delete feedback.dataset.state;
      }
    });
    state.completed = attempted === Object.keys(activity.items).length;
    const status = card.querySelector("[data-activity-status]");
    const summary = card.querySelector("[data-activity-progress]");
    const text = state.completed
      ? `${attempted}/${attempted} attempted · ${correct} currently correct · formative practice saved locally`
      : `${attempted}/${Object.keys(activity.items).length} attempted · formative practice only`;
    if (status) status.textContent = text;
    if (summary) summary.textContent = state.completed ? "Attempt complete" : `${attempted}/${Object.keys(activity.items).length}`;
    card.dataset.complete = String(state.completed);
  }

  document.querySelectorAll("[data-activity-card]").forEach((card) => {
    const activityId = card.dataset.activityId;
    const key = card.dataset.storageKey;
    let state = readState(key);
    renderCard(card, state);

    card.addEventListener("change", (event) => {
      const control = event.target;
      if (!(control instanceof HTMLSelectElement) && !(control instanceof HTMLInputElement)) return;
      const itemId = control.dataset.answerFor;
      if (!itemId) return;
      state.answers[itemId] = control.value;
      const expected = answerData[activityId]?.items?.[itemId]?.correct;
      state.correct[itemId] = normalise(control.value) === normalise(expected);
      renderCard(card, state);
      state = saveState(key, state);
      renderCard(card, state);
    });

    card.querySelectorAll("[data-check-text]").forEach((button) => {
      button.addEventListener("click", () => {
        const itemId = button.dataset.checkText;
        const control = card.querySelector(`[data-answer-for="${itemId}"]`);
        if (!control) return;
        state.answers[itemId] = control.value;
        const expected = answerData[activityId]?.items?.[itemId]?.correct;
        state.correct[itemId] = normalise(control.value) === normalise(expected);
        renderCard(card, state);
        state = saveState(key, state);
        renderCard(card, state);
      });
    });

    card.querySelector("[data-reset-activity]")?.addEventListener("click", () => {
      if (!window.confirm("Clear only this formative activity from this browser?")) return;
      localStorage.removeItem(key);
      state = { answers: {}, correct: {} };
      card.querySelectorAll("select, input[type='text']").forEach((control) => { control.value = ""; });
      renderCard(card, state);
      card.querySelector("summary")?.focus();
    });

    card.querySelector("[data-print-activity]")?.addEventListener("click", () => {
      card.open = true;
      document.body.dataset.printActivity = activityId;
      window.print();
      delete document.body.dataset.printActivity;
    });
  });

  function openTargetCard() {
    if (!location.hash) return;
    const target = document.querySelector(location.hash);
    if (target?.matches("details[data-activity-card]")) {
      target.open = true;
      const summary = target.querySelector("summary");
      summary?.focus({ preventScroll: true });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (document.activeElement !== summary) summary?.focus({ preventScroll: true });
      }));
    }
  }
  window.addEventListener("hashchange", openTargetCard);
  openTargetCard();
})();
