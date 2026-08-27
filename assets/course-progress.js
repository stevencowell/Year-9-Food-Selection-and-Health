(() => {
  "use strict";

  const STORAGE_NAMESPACE = "tas:stage-5-food-selection-health:v1";
  const systems = window.FOOD_SELECTION_SYSTEM_INDEX || { activities: [], folio: { stage_ids: [] } };
  const sections = Array.from({ length: 6 }, (_, moduleIndex) =>
    Array.from({ length: 3 }, (_, sectionIndex) => ({
      module: moduleIndex + 1,
      moduleId: `m${String(moduleIndex + 1).padStart(2, "0")}`,
      sectionId: `m${String(moduleIndex + 1).padStart(2, "0")}-s${sectionIndex + 1}`,
    })),
  ).flat();

  function complete(sectionId) {
    try {
      const state = JSON.parse(localStorage.getItem(`${STORAGE_NAMESPACE}:${sectionId}`) || "null");
      const answerCount = Object.keys(state?.answers || {}).length;
      const response = String(state?.long_response || "").trim();
      return answerCount === 10 && response.length >= 80 && response.split(/\s+/).filter(Boolean).length >= 12;
    } catch {
      return false;
    }
  }

  function render() {
    const states = sections.map((section) => ({ ...section, complete: complete(section.sectionId) }));
    const packageCompleted = states.filter((section) => section.complete).length;
    const activityStates = systems.activities.map((activity) => {
      try {
        const record = JSON.parse(localStorage.getItem(activity.storage_key) || "null");
        return { ...activity, complete: Boolean(record?.completed) || Object.keys(record?.answers || {}).length >= activity.item_count };
      } catch {
        return { ...activity, complete: false };
      }
    });
    let folioState = null;
    try {
      folioState = JSON.parse(localStorage.getItem(systems.folio.storage_key) || "null");
    } catch {
      folioState = null;
    }
    const folioStates = systems.folio.stage_ids.map((stageId) => {
      const response = String(folioState?.stages?.[stageId]?.response || "").trim();
      return { stageId, complete: response.length >= 80 && response.split(/\s+/).filter(Boolean).length >= 12 };
    });
    const completed = packageCompleted + activityStates.filter((activity) => activity.complete).length + folioStates.filter((stage) => stage.complete).length;
    const total = states.length + activityStates.length + folioStates.length;
    const text = document.querySelector("[data-course-progress]");
    const bar = document.querySelector("[data-course-progress-bar]");
    const resume = document.querySelector("[data-course-resume]");
    if (text) text.textContent = `${completed} of ${total} connected learning actions complete on this device`;
    if (bar) {
      bar.max = total;
      bar.value = completed;
    }
    let next = null;
    let nextActivity = null;
    for (let module = 1; module <= 6 && !next && !nextActivity; module += 1) {
      next = states.find((section) => section.module === module && !section.complete) || null;
      if (!next) {
        const prefix = `m${String(module).padStart(2, "0")}-`;
        nextActivity = activityStates.find((activity) => activity.module_id.startsWith(prefix) && !activity.complete) || null;
      }
    }
    const nextFolio = folioStates.find((stage) => !stage.complete);
    if (resume) {
      resume.href = next
        ? `modules/module-${String(next.module).padStart(2, "0")}.html#${next.sectionId}-package`
        : nextActivity
          ? `activities.html#${nextActivity.id}`
          : nextFolio
            ? `folio.html#${nextFolio.stageId}`
            : "folio.html";
      resume.textContent = next
        ? `Resume at Module ${next.module}, Section ${next.sectionId.slice(-1)}`
        : nextActivity
          ? "Resume the next applied activity"
          : nextFolio
            ? "Resume the next folio evidence stage"
            : "All connected learning actions complete — review My folio";
    }
    for (let module = 1; module <= 6; module += 1) {
      const moduleId = `m${String(module).padStart(2, "0")}`;
      const count = states.filter((section) => section.module === module && section.complete).length;
      const card = document.querySelector(`[data-card-progress="${moduleId}"]`);
      if (card) card.textContent = `${count} of 3 section packages complete`;
    }
  }

  document.addEventListener("foodselection:progress", render);
  window.addEventListener("storage", render);
  render();
})();
