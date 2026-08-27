(() => {
  "use strict";

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  const nav = document.querySelector(".site-nav");
  const toggle = document.querySelector(".nav-toggle");
  if (nav && toggle) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.dataset.open = String(!open);
    });
  }

  const visualTriggers = [...document.querySelectorAll("[data-visual-open]")];
  if (visualTriggers.length) {
    const dialog = document.createElement("dialog");
    dialog.className = "visual-dialog";
    dialog.setAttribute("aria-label", "Larger learning visual");
    dialog.innerHTML = `
      <div class="visual-dialog-panel">
        <button class="visual-dialog-close" type="button" aria-label="Close larger visual">Close</button>
        <div class="visual-dialog-media"></div>
        <p></p>
      </div>`;
    document.body.append(dialog);

    const dialogMedia = dialog.querySelector(".visual-dialog-media");
    const dialogCaption = dialog.querySelector("p");
    const closeButton = dialog.querySelector(".visual-dialog-close");
    let returnFocus = null;
    let dialogImage = null;

    visualTriggers.forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        if (typeof dialog.showModal !== "function") return;
        event.preventDefault();
        returnFocus = trigger;
        dialogImage = document.createElement("img");
        dialogImage.src = trigger.href;
        dialogImage.alt = trigger.dataset.visualAlt || trigger.querySelector("img")?.alt || "";
        dialogMedia.replaceChildren(dialogImage);
        dialogCaption.textContent = trigger.dataset.visualCaption || "";
        dialog.showModal();
        closeButton.focus();
      });
    });

    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialogMedia.replaceChildren();
      dialogImage = null;
      returnFocus?.focus();
    });
  }
})();
