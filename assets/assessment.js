(() => {
  "use strict";

  const STORAGE_KEY = "tas:stage-5-food-selection-health:assessment-read:helloeats-orientation-v1";
  const VERSION = "helloeats-orientation-v1";
  const checkbox = document.querySelector("[data-assessment-read]");
  const status = document.querySelector("[data-assessment-read-status]");

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value?.notification_version === VERSION ? value : null;
    } catch {
      return null;
    }
  }

  function render() {
    const value = read();
    if (checkbox) checkbox.checked = Boolean(value);
    if (status) {
      status.textContent = value
        ? `Assessment orientation acknowledgement saved on this device: ${new Date(value.browser_local_timestamp).toLocaleString("en-AU")}.`
        : "No browser-local acknowledgement saved.";
    }
  }

  checkbox?.addEventListener("change", () => {
    if (checkbox.checked) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ notification_version: VERSION, browser_local_timestamp: new Date().toISOString() }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    render();
  });

  document.querySelector("[data-assessment-reset]")?.addEventListener("click", () => {
    if (!window.confirm("Remove only this browser-local assessment-orientation acknowledgement?")) return;
    localStorage.removeItem(STORAGE_KEY);
    render();
  });

  render();
})();
