(() => {
  "use strict";

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : { response: "", completed: false };
    } catch {
      return { response: "", completed: false };
    }
  }

  function substantive(value) {
    const text = String(value || "").trim();
    return text.length >= 80 && text.split(/\s+/).filter(Boolean).length >= 12;
  }

  document.querySelectorAll("[data-reflection-activity]").forEach((card) => {
    const key = card.dataset.storageKey;
    const response = card.querySelector("[data-activity-response]");
    const complete = card.querySelector("[data-activity-complete]");
    const status = card.querySelector("[data-activity-status]");
    const summary = card.querySelector("[data-activity-progress]");
    let state = read(key);

    function render() {
      if (response && response.value !== state.response) response.value = state.response || "";
      if (complete) complete.checked = Boolean(state.completed);
      const enough = substantive(state.response);
      const statusText = state.completed
        ? "Marked complete on this device"
        : enough
          ? "Substantive evidence saved — review, then mark complete"
          : state.response.trim()
            ? "Draft saved — add a clear claim, evidence and reasoning"
            : "Not started";
      if (status) status.textContent = statusText;
      if (summary) summary.textContent = statusText;
      card.dataset.complete = String(Boolean(state.completed));
    }

    function save() {
      state = { response: response?.value || "", completed: Boolean(complete?.checked), updated_at: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(state));
      document.dispatchEvent(new CustomEvent("foodselection:progress"));
      render();
    }

    response?.addEventListener("input", save);
    response?.addEventListener("blur", save);
    complete?.addEventListener("change", save);
    card.querySelector("[data-print-activity]")?.addEventListener("click", () => {
      card.open = true;
      window.print();
    });
    card.querySelector("[data-reset-activity]")?.addEventListener("click", () => {
      if (!window.confirm("Clear only this formative activity from this browser?")) return;
      localStorage.removeItem(key);
      state = { response: "", completed: false };
      render();
      card.querySelector("summary")?.focus();
    });
    render();
  });

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target?.matches("details[data-reflection-activity]")) {
      target.open = true;
      requestAnimationFrame(() => target.querySelector("summary")?.focus());
    }
  }
})();
