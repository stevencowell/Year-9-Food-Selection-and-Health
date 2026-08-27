(() => {
  "use strict";

  const STORAGE_KEY = "tas:stage-5-food-selection-health:folio:v1";
  const COURSE_ID = "year-9-food-selection-and-health";
  const FOLIO_ID = "food-selection-health-learning-folio-v1";
  const DB_NAME = "tas-stage-5-food-selection-health-folio-media-v1";
  const DB_STORE = "images";
  const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const stageCards = [...document.querySelectorAll("[data-folio-stage]")];

  const blankState = () => ({ schema_version: "1.0", course_id: COURSE_ID, folio_id: FOLIO_ID, stages: {}, updated_at: "" });

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.course_id !== COURSE_ID || parsed.folio_id !== FOLIO_ID || parsed.schema_version !== "1.0") return blankState();
      return parsed;
    } catch {
      return blankState();
    }
  }

  function saveState(state) {
    state.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    document.dispatchEvent(new CustomEvent("foodselection:progress"));
    return state;
  }

  function stageRecord(state, stageId) {
    state.stages[stageId] ||= { response: "", caption: "", updated_at: "" };
    return state.stages[stageId];
  }

  function substantive(value) {
    const text = String(value || "").trim();
    return text.length >= 80 && text.split(/\s+/).filter(Boolean).length >= 12;
  }

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  async function privacySafeDataUrl(blob) {
    const bitmap = await createImageBitmap(blob);
    const maximum = 1800;
    const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  function renderProgress(state) {
    let ready = 0;
    let nextStage = null;
    stageCards.forEach((card) => {
      const stageId = card.dataset.folioStage;
      const record = stageRecord(state, stageId);
      const response = card.querySelector("[data-folio-response]");
      const caption = card.querySelector("[data-folio-caption]");
      if (response && response.value !== record.response) response.value = record.response || "";
      if (caption && caption.value !== record.caption) caption.value = record.caption || "";
      const isReady = substantive(record.response);
      if (isReady) ready += 1;
      else if (!nextStage) nextStage = card;
      const status = card.querySelector("[data-folio-status]");
      const progress = card.querySelector("[data-folio-card-progress]");
      const label = isReady
        ? card.dataset.statusReady
        : record.response.trim()
          ? card.dataset.statusDraft
          : "Not started";
      if (status) status.textContent = label;
      if (progress) progress.textContent = label;
      card.dataset.complete = String(isReady);
    });
    const text = document.querySelector("[data-folio-progress]");
    const bar = document.querySelector("[data-folio-progress-bar]");
    if (text) text.textContent = `${ready} of ${stageCards.length} evidence stages contain a substantive response`;
    if (bar) {
      bar.max = stageCards.length;
      bar.value = ready;
    }
    const resume = document.querySelector("[data-folio-resume]");
    if (resume) {
      resume.href = nextStage ? `#${nextStage.id}` : "#f08-evaluation";
      resume.textContent = nextStage ? `Resume ${nextStage.querySelector("summary > span")?.textContent?.trim() || "the next stage"}` : "All eight stages have substantive writing — review the final evaluation";
    }
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: "id" });
          store.createIndex("stage_id", "stage_id", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function mediaTransaction(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, mode);
      const store = transaction.objectStore(DB_STORE);
      const result = action(store);
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  }

  async function imagesForStage(stageId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).index("stage_id").getAll(stageId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
    });
  }

  async function renderImages(stageId) {
    const card = document.querySelector(`[data-folio-stage="${stageId}"]`);
    const gallery = card?.querySelector("[data-folio-gallery]");
    if (!gallery) return;
    gallery.querySelectorAll("img[data-object-url]").forEach((image) => URL.revokeObjectURL(image.dataset.objectUrl));
    const records = await imagesForStage(stageId);
    gallery.replaceChildren();
    records.forEach((record) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      const objectUrl = URL.createObjectURL(record.blob);
      image.src = objectUrl;
      image.dataset.objectUrl = objectUrl;
      image.alt = `Locally saved project evidence for ${stageId}`;
      const caption = document.createElement("figcaption");
      caption.textContent = record.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button no-print";
      remove.textContent = "Remove this image";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Remove ${record.name} from this browser-only folio?`)) return;
        await mediaTransaction("readwrite", (store) => store.delete(record.id));
        await renderImages(stageId);
      });
      figure.append(image, caption, remove);
      gallery.append(figure);
    });
  }

  let state = readState();
  renderProgress(state);
  stageCards.forEach((card) => {
    const stageId = card.dataset.folioStage;
    const response = card.querySelector("[data-folio-response]");
    const caption = card.querySelector("[data-folio-caption]");
    let pending;
    [response, caption].filter(Boolean).forEach((control) => {
      control.addEventListener("input", () => {
        clearTimeout(pending);
        pending = setTimeout(() => {
          const record = stageRecord(state, stageId);
          record.response = response?.value || "";
          record.caption = caption?.value || "";
          record.updated_at = new Date().toISOString();
          state = saveState(state);
          renderProgress(state);
        }, 260);
      });
      control.addEventListener("blur", () => {
        clearTimeout(pending);
        const record = stageRecord(state, stageId);
        record.response = response?.value || "";
        record.caption = caption?.value || "";
        record.updated_at = new Date().toISOString();
        state = saveState(state);
        renderProgress(state);
      });
    });

    const input = card.querySelector("[data-folio-image]");
    if (input) {
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        const message = card.querySelector("[data-image-message]");
        if (!IMAGE_TYPES.has(file.type)) {
          if (message) message.textContent = "Choose a JPEG, PNG or WebP project image.";
          return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          if (message) message.textContent = "That file is larger than 6 MB. Resize or crop it before adding it.";
          return;
        }
        const id = `${stageId}:${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
        await mediaTransaction("readwrite", (store) => store.put({ id, stage_id: stageId, name: file.name, type: file.type, size: file.size, blob: file, saved_at: new Date().toISOString() }));
        if (message) message.textContent = "Image saved only in this browser and device.";
        await renderImages(stageId);
      });
      renderImages(stageId).catch(() => {
        const message = card.querySelector("[data-image-message]");
        if (message) message.textContent = "This browser could not open the local image store. Your written evidence is unaffected.";
      });
    }
  });

  document.querySelector("[data-folio-backup]")?.addEventListener("click", () => {
    const backup = { ...state, exported_at: new Date().toISOString(), media_boundary: "Project images are excluded from this JSON backup." };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "food-selection-health-folio-backup-v1.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  document.querySelector("[data-folio-export]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const message = document.querySelector("[data-export-message]");
    button.disabled = true;
    if (message) message.textContent = "Preparing a self-contained, read-only folio…";
    try {
      const sections = [];
      for (const card of stageCards) {
        const stageId = card.dataset.folioStage;
        const record = stageRecord(state, stageId);
        const title = card.querySelector("summary > span")?.textContent?.trim() || stageId;
        const prompt = card.querySelector("label[for$='-response']")?.textContent?.trim() || "Student response";
        const images = [];
        for (const imageRecord of await imagesForStage(stageId)) {
          images.push({ name: imageRecord.name, dataUrl: await privacySafeDataUrl(imageRecord.blob) });
        }
        sections.push(`<section><h2>${escapeHtml(title)}</h2><p class="prompt">${escapeHtml(prompt)}</p><div class="response">${escapeHtml(record.response || "No written response saved.").replaceAll("\n", "<br>")}</div>${record.caption ? `<p><strong>Image caption:</strong> ${escapeHtml(record.caption)}</p>` : ""}${images.map((image) => `<figure><img src="${image.dataUrl}" alt="Selected project evidence"><figcaption>${escapeHtml(record.caption || image.name)}</figcaption></figure>`).join("")}</section>`);
      }
      const exported = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Food Selection and Health folio — read-only export</title><style>body{font:11pt/1.5 Arial,sans-serif;color:#253027;max-width:900px;margin:0 auto;padding:32px}h1,h2{font-family:Georgia,serif}header{border-bottom:4px solid #3f7b48;margin-bottom:24px}section{border:1px solid #d8d5c9;border-radius:12px;padding:18px;margin:18px 0;break-inside:avoid}.prompt{font-weight:700}.response{white-space:normal;background:#edf5e9;padding:12px;border-radius:8px}figure{margin:16px 0}img{max-width:100%;max-height:650px;object-fit:contain}figcaption{font-size:9.5pt;color:#5c665c}.notice{background:#fff4d5;padding:12px;border-left:5px solid #d49a2a}@page{size:A4;margin:14mm}@media print{body{padding:0}}</style></head><body><header><p>Food Technology 7–10 · Food selection for nutrition and health</p><h1>Food Selection and Health learning folio</h1><p>Read-only export created ${escapeHtml(new Date().toLocaleString("en-AU"))}</p></header><p class="notice"><strong>Export is not submission.</strong> Your teacher must confirm the required filename, destination and submission process. Embedded images have been browser-rasterised to remove original file metadata.</p>${sections.join("")}</body></html>`;
      const blob = new Blob([exported], { type: "text/html" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "food-selection-health-folio-read-only-v1.html";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      if (message) message.textContent = "Read-only HTML export downloaded. It is not submitted anywhere.";
    } catch {
      if (message) message.textContent = "The export could not be created. Your saved folio was not changed.";
    } finally {
      button.disabled = false;
    }
  });

  const restoreInput = document.querySelector("[data-folio-restore]");
  restoreInput?.addEventListener("change", async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = "";
    if (!file) return;
    const message = document.querySelector("[data-restore-message]");
    try {
      const candidate = JSON.parse(await file.text());
      if (candidate.schema_version !== "1.0" || candidate.course_id !== COURSE_ID || candidate.folio_id !== FOLIO_ID || !candidate.stages || typeof candidate.stages !== "object") {
        throw new Error("This is not a compatible Food Selection and Health folio backup.");
      }
      const count = Object.values(candidate.stages).filter((record) => String(record?.response || "").trim()).length;
      if (!window.confirm(`Restore ${count} written stage record(s) from this backup? This will replace the current written folio only; locally stored images will stay.`)) return;
      state = saveState(candidate);
      renderProgress(state);
      if (message) message.textContent = `Restored ${count} written stage record(s). Images were not changed.`;
    } catch (error) {
      if (message) message.textContent = error.message || "The backup could not be read. Existing work was not changed.";
    }
  });

  document.querySelector("[data-folio-print]")?.addEventListener("click", () => {
    const previous = stageCards.map((card) => card.open);
    stageCards.forEach((card) => { card.open = true; });
    const restore = () => {
      stageCards.forEach((card, index) => { card.open = previous[index]; });
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  });

  document.querySelector("[data-folio-reset]")?.addEventListener("click", async () => {
    if (!window.confirm("Clear all eight written folio stages and locally stored folio images from this browser? Module and activity records will stay.")) return;
    if (window.prompt("Type CLEAR to confirm the folio-only reset.") !== "CLEAR") return;
    localStorage.removeItem(STORAGE_KEY);
    await mediaTransaction("readwrite", (store) => store.clear());
    state = blankState();
    renderProgress(state);
    for (const card of stageCards) await renderImages(card.dataset.folioStage);
  });

  function openTargetStage() {
    if (!location.hash) return;
    const target = document.querySelector(location.hash);
    if (target?.matches("details[data-folio-stage]")) {
      target.open = true;
      requestAnimationFrame(() => target.querySelector("summary")?.focus());
    }
  }
  window.addEventListener("hashchange", openTargetStage);
  openTargetStage();
})();
