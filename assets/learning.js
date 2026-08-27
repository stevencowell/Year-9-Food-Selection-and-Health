(() => {
  "use strict";

  const STORAGE_NAMESPACE = "tas:stage-5-food-selection-health:v1";
  const answerData = window.FOOD_SELECTION_ANSWERS || {};
  const packageNodes = [...document.querySelectorAll("[data-learning-package]")];

  const storageKey = (sectionId) => `${STORAGE_NAMESPACE}:${sectionId}`;
  const emptyState = () => ({ answers: {}, question_completion: {}, long_response: "", updated_at: "" });

  function readState(sectionId) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(sectionId)) || "null");
      return parsed && typeof parsed === "object" ? { ...emptyState(), ...parsed } : emptyState();
    } catch {
      return emptyState();
    }
  }

  function writeState(sectionId, state) {
    const next = { ...state, updated_at: new Date().toISOString() };
    localStorage.setItem(storageKey(sectionId), JSON.stringify(next));
    document.dispatchEvent(new CustomEvent("foodselection:progress", { detail: { sectionId } }));
    return next;
  }

  function responseIsSubstantive(value) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    return String(value || "").trim().length >= 80 && words.length >= 12;
  }

  function sectionProgress(sectionId, state) {
    const sectionAnswers = answerData[sectionId]?.questions || {};
    const questionIds = Object.keys(sectionAnswers);
    const answered = questionIds.filter((id) => Boolean(state.answers[id])).length;
    const responseSaved = responseIsSubstantive(state.long_response);
    return {
      answered,
      total: questionIds.length,
      responseSaved,
      complete: questionIds.length === 10 && answered === 10 && responseSaved,
    };
  }

  function showFeedback(packageNode, questionId, selectedId) {
    const feedbackNode = packageNode.querySelector(`[data-feedback-for="${questionId}"]`);
    const question = answerData[packageNode.dataset.sectionId]?.questions?.[questionId];
    const option = question?.options?.[selectedId];
    if (!feedbackNode || !option) return;
    feedbackNode.hidden = false;
    feedbackNode.dataset.state = selectedId === question.correct_option_id ? "correct" : "review";
    feedbackNode.textContent = option.feedback;
  }

  function renderPackage(packageNode, state) {
    const sectionId = packageNode.dataset.sectionId;
    Object.entries(state.answers || {}).forEach(([questionId, optionId]) => {
      const radio = packageNode.querySelector(`input[name="${questionId}"][value="${optionId}"]`);
      if (radio) radio.checked = true;
      showFeedback(packageNode, questionId, optionId);
    });

    const response = packageNode.querySelector("[data-long-response]");
    if (response && response.value !== state.long_response) response.value = state.long_response || "";

    const progress = sectionProgress(sectionId, state);
    const statusText = `${progress.answered}/${progress.total} checks saved · ${progress.responseSaved ? "long response saved" : "long response still needs detail"}`;
    const status = packageNode.querySelector("[data-save-status]");
    const summaryProgress = packageNode.querySelector("[data-package-progress]");
    if (status) status.textContent = progress.complete ? `Complete on this device — ${statusText}` : statusText;
    if (summaryProgress) summaryProgress.textContent = progress.complete ? "Complete" : `${progress.answered}/10 + response`;
    packageNode.dataset.complete = String(progress.complete);
  }

  function renderModuleProgress() {
    const states = packageNodes.map((node) => ({
      node,
      progress: sectionProgress(node.dataset.sectionId, readState(node.dataset.sectionId)),
    }));
    const complete = states.filter(({ progress }) => progress.complete).length;
    const meter = document.querySelector("[data-module-progress]");
    const bar = document.querySelector("[data-module-progress-bar]");
    if (meter) meter.textContent = `${complete} of ${states.length} section packages complete on this device`;
    if (bar) {
      bar.max = states.length;
      bar.value = complete;
    }
    states.forEach(({ node, progress }) => {
      const item = document.querySelector(`[data-review-section="${node.dataset.sectionId}"]`);
      if (item) item.dataset.complete = String(progress.complete);
      const indicator = item?.querySelector("[data-review-state]");
      if (indicator) indicator.textContent = progress.complete ? "Complete" : "Continue";
    });
  }

  packageNodes.forEach((packageNode) => {
    const sectionId = packageNode.dataset.sectionId;
    let state = readState(sectionId);
    renderPackage(packageNode, state);

    packageNode.addEventListener("change", (event) => {
      const control = event.target;
      if (!(control instanceof HTMLInputElement) || control.type !== "radio") return;
      state.answers[control.name] = control.value;
      state.question_completion[control.name] = true;
      state = writeState(sectionId, state);
      showFeedback(packageNode, control.name, control.value);
      renderPackage(packageNode, state);
      renderModuleProgress();
    });

    const response = packageNode.querySelector("[data-long-response]");
    if (response) {
      let pending;
      response.addEventListener("input", () => {
        clearTimeout(pending);
        pending = setTimeout(() => {
          state.long_response = response.value;
          state = writeState(sectionId, state);
          renderPackage(packageNode, state);
          renderModuleProgress();
        }, 220);
      });
      response.addEventListener("blur", () => {
        clearTimeout(pending);
        state.long_response = response.value;
        state = writeState(sectionId, state);
        renderPackage(packageNode, state);
        renderModuleProgress();
      });
    }

    const reset = packageNode.querySelector("[data-reset-package]");
    reset?.addEventListener("click", () => {
      if (!window.confirm("Clear only this section package from this browser? Your other work will stay saved.")) return;
      localStorage.removeItem(storageKey(sectionId));
      state = emptyState();
      packageNode.querySelectorAll('input[type="radio"]').forEach((radio) => { radio.checked = false; });
      packageNode.querySelectorAll("[data-feedback-for]").forEach((node) => {
        node.hidden = true;
        node.textContent = "";
        delete node.dataset.state;
      });
      if (response) response.value = "";
      renderPackage(packageNode, state);
      renderModuleProgress();
      packageNode.querySelector("summary")?.focus();
    });
  });

  function openTargetPackage() {
    if (!location.hash) return;
    const target = document.querySelector(location.hash);
    const drawer = target?.matches("details") ? target : target?.closest("details");
    if (drawer?.matches("[data-learning-package]")) {
      drawer.open = true;
      requestAnimationFrame(() => drawer.querySelector("summary")?.focus());
    }
  }

  window.addEventListener("hashchange", openTargetPackage);
  openTargetPackage();
  renderModuleProgress();
})();
