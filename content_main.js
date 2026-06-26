(function () {
  let isInfoEnabled = true;
  let isLinkOpenerEnabled = true;
  let isGroupOpenEnabled = false;
  let isScrollTopEnabled = true;
  let isScrollLastAllEnabled = false;
  let isVerticalListEnabled = false;
  let isPassDisableEnabled = false;
  let isPassColorEnabled = false;
  let passDelaySeconds = 6;
  let passTargetColor = "#ff0000";
  let questionStartTime = Date.now();

  let accumulatedActiveTime = 0;
  let lastTimeCheck = Date.now();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastTimeCheck = Date.now();
    }
  });

  function getText(el) {
    return ((el && (el.innerText || el.textContent)) || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function bodyText() {
    const b = document.body;
    return b ? getText(b) : "";
  }

  function includesAll(txt, arr) {
    txt = String(txt || "").toLowerCase();
    return arr.every((k) => txt.includes(String(k || "").toLowerCase()));
  }

  function debounce(fn, wait = 300) {
    let t = null;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, a), wait);
    };
  }

  let currentTabId = null;

  function autoEnableMatcher() {
    try {
      return (
        location.hostname === "outsourcing.logisticsmngmt.com" &&
        location.pathname.startsWith("/next/govern/aegis-auditing/detail")
      );
    } catch {
      return false;
    }
  }

  function ensureAutoEnabledIfMatch() {
    if (!autoEnableMatcher() || !currentTabId) return Promise.resolve(false);
    return new Promise((resolve) => {
      chrome.storage.sync.get({ enabledTabs: {} }, (data) => {
        const enabledTabs = data.enabledTabs || {};
        if (enabledTabs[currentTabId]) {
          resolve(false);
          return;
        }
        enabledTabs[currentTabId] = true;
        chrome.storage.sync.set({ enabledTabs }, () => resolve(true));
      });
    });
  }

  function identifyPageType() {
    const txt = bodyText();
    if (!txt) return null;

    const isCPC = includesAll(txt, [
      "Qualification type",
      "儿童产品-CPC",
      "Review Phase",
    ]);
    if (isCPC) return "CPC";

    const isEUEnergy = includesAll(txt, [
      "Qualification type",
      "电器-EU Energy Label",
      "Review Phase",
      "Product Qualification-Consistency Review-complex5",
    ]);
    if (isEUEnergy) return "EU_ENERGY";

    if (includesAll(txt, ["电器-PSE"])) return "PSE";

    return null;
  }

  function getCheckpointStateCPC() {
    const txt = bodyText();
    if (!txt) return { hasA: false, hasB: false, hasC: false };

    const lowerTxt = txt.toLowerCase();
    const keyA = "commodity testing raw materials + ink testing";
    const keyB = "not accepted";
    const keyC = "complete product testing is required";

    const hasA = lowerTxt.includes(keyA);
    const hasB = lowerTxt.includes(keyB);
    const hasC = lowerTxt.includes(keyC);

    return { hasA, hasB, hasC };
  }

  function formatCheckpointLabelCPC({ hasA, hasB, hasC }) {
    if ((hasA || hasC) && hasB) {
      return "Accepted | Not Accepted";
    }
    if (hasA && hasC) {
      return "Accepted AC";
    }
    if (hasA) {
      return "Accepted A";
    }
    if (hasC) {
      return "Accepted C";
    }
    if (hasB) {
      return "Not Accepted";
    }
    return "Checkpoint: Empty";
  }

  function getCheckpointLabelEU() {
    const txt = bodyText();
    if (!txt) return "Checkpoint: Empty";

    const target = "actual photos are not required";

    if (txt.toLowerCase().includes(target)) {
      return 'Checkpoint: "Brand"';
    }

    return "Checkpoint: Empty";
  }

  function getProcessIdFromUrl() {
    const matchQuery = window.location.href.match(/audit_process_id=(\d+)/);
    if (matchQuery) return matchQuery[1];

    const matchHash = window.location.hash.match(/^#(\d+)/);
    if (matchHash) return matchHash[1];

    return null;
  }

  function getCheckpointLabelPSE() {
    const txt = bodyText();
    if (!txt) return "Checkpoint: Empty";
    const lowerTxt = txt.toLowerCase();
    const processId = getProcessIdFromUrl();

    const hasInspectionBody = lowerTxt.includes("registered inspection body");
    const hasDocRequirement = lowerTxt.includes("notifying supplier");

    if (processId === "1172") {
      return hasInspectionBody
        ? 'Checkpoint: "Testing Organization"'
        : "Checkpoint: Empty";
    }

    if (processId === "1173" || processId === "1178") {
      return hasDocRequirement
        ? 'Checkpoint: "Notifying Supplier"'
        : "Checkpoint: Empty";
    }

    if (processId === "1405" || processId === "1179") {
      if (hasDocRequirement && hasInspectionBody)
        return 'Checkpoint: "Notifying Supplier/Adapter Logo"';
      if (hasDocRequirement) return 'Checkpoint: "Notifying Supplier"';
      if (hasInspectionBody) return 'Checkpoint: "Adapter Logo"';
      return "Checkpoint: Empty";
    }

    return "Checkpoint: Empty";
  }

  function findGoodsPropsGrid() {
    const spans = Array.from(document.querySelectorAll("span"));
    for (const sp of spans) {
      const label = getText(sp).toLowerCase();
      if (!label) continue;
      if (label.includes("goods properties")) {
        const container = sp.closest("div");
        if (!container) continue;
        const grids = Array.from(
          container.querySelectorAll('div[style*="display: grid"]'),
        );
        if (grids.length) return grids[0];
      }
    }
    return null;
  }

  function buildGridCell(text) {
    const outer = document.createElement("span");
    outer.setAttribute("data-sc-qual-head", "1");
    outer.classList.add("tk-injected-cell");
    outer.style.cssText =
      "display:inline-block;padding-bottom:5px;padding-right:5px;text-align:left;white-space:pre-wrap;word-break:break-all;";
    const innerDiv = document.createElement("div");
    innerDiv.style.cssText = "white-space:pre-wrap;word-break:break-all;";
    const v = document.createElement("span");
    v.textContent = text;
    innerDiv.appendChild(v);
    outer.appendChild(innerDiv);
    return outer;
  }

  function injectTKStyles() {
    if (document.getElementById("tk-style")) return;
    const css = `
      .tk-green-btn { background-color:#16a34a !important; border-color:#15803d !important; color:#fff !important; }
      .tk-green-btn:hover { filter: brightness(0.95); }
      .tk-green-btn:active { filter: brightness(0.90); }
      
      .tk-qual-grid-vertical {
        grid-template-columns: repeat(1, 1fr) !important;
        gap: 0px 10px !important;
      }
    `;
    const style = document.createElement("style");
    style.id = "tk-style";
    style.textContent = css;
    document.documentElement.appendChild(style);
  }

  let tkLastStoreId = null;
  let tkLastPassExists = false;

  function onLoadReady() {}

  function patchHistory() {
    const _ps = history.pushState;
    const _rs = history.replaceState;
    history.pushState = function () {
      const r = _ps.apply(this, arguments);
      window.dispatchEvent(new Event("tk:navigation"));
      return r;
    };
    history.replaceState = function () {
      const r = _rs.apply(this, arguments);
      window.dispatchEvent(new Event("tk:navigation"));
      return r;
    };
    window.addEventListener("popstate", () =>
      window.dispatchEvent(new Event("tk:navigation")),
    );
    window.addEventListener("hashchange", () =>
      window.dispatchEvent(new Event("tk:navigation")),
    );
  }

  function onQuestionChanged() {
    questionStartTime = Date.now();
    accumulatedActiveTime = 0;
    lastTimeCheck = Date.now();
  }

  window.addEventListener("tk:navigation", () => {
    onQuestionChanged();
  });

  function getStoreId() {
    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        const txt = (el.textContent || "").trim();
        if (!txt) return false;
        return /store id/i.test(txt);
      })
      .slice(0, 30);
    for (const el of candidates) {
      const txt = (el.textContent || "").trim();
      const m = txt.match(/Store ID[:：]?\s*([0-9]{5,})/i);
      if (m) return m[1];
      let next = el.nextElementSibling;
      if (next) {
        const d = (next.textContent || "").match(/([0-9]{5,})/);
        if (d) return d[1];
      }
      const deep = el.querySelector("span,div");
      if (deep) {
        const d2 = (deep.textContent || "").match(/([0-9]{5,})/);
        if (d2) return d2[1];
      }
    }
    const g = document.body.textContent.match(/Store ID[:：]?\s*([0-9]{5,})/i);
    return g ? g[1] : null;
  }

  function detectQuestionChange() {
    const sid = getStoreId() || "__none__";

    const allButtons = document.querySelectorAll(
      "button.rocket-btn.rocket-btn-primary",
    );
    const passBtn = Array.from(allButtons).find(
      (btn) => getText(btn).toLowerCase() === "pass",
    );
    const passExists = !!passBtn;

    if (tkLastStoreId === null) {
      tkLastStoreId = sid;
      tkLastPassExists = passExists;
      return;
    }

    if (sid !== tkLastStoreId || (passExists && !tkLastPassExists)) {
      tkLastStoreId = sid;
      tkLastPassExists = passExists;
      onQuestionChanged();
      console.log("Timer reset: Pass button detected or Store ID changed.");
    } else {
      tkLastPassExists = passExists;
    }
  }

  function removeInjectedInfo() {
    const injected = document.querySelectorAll(".tk-injected-cell");
    injected.forEach((el) => el.remove());

    const badge = document.getElementById("tk-acc-badge");
    if (badge) badge.remove();
  }

  function injectQualHeaderRow() {
    if (!isInfoEnabled) {
      removeInjectedInfo();
      return false;
    }

    const pageType = identifyPageType();
    if (!pageType) return false;

    const grid = findGoodsPropsGrid();
    if (!grid) return false;

    if (grid.querySelector('[data-sc-qual-head="1"]')) return true;

    let label = "";
    if (pageType === "CPC") {
      const state = getCheckpointStateCPC();
      label = formatCheckpointLabelCPC(state);
    } else if (pageType === "EU_ENERGY") {
      label = getCheckpointLabelEU();
    } else if (pageType === "PSE") {
      label = getCheckpointLabelPSE();
    }

    const accCell = buildGridCell(label);
    accCell.id = "tk-acc-badge";

    if (grid.firstChild) {
      grid.insertBefore(accCell, grid.firstChild);
    } else {
      grid.appendChild(accCell);
    }
    return true;
  }

  function updateAcceptBadgeLabel(root = document) {
    if (!isInfoEnabled) return;

    const badge = root.querySelector("#tk-acc-badge");
    if (!badge) return;

    const pageType = identifyPageType();
    let label = "";
    if (pageType === "CPC") {
      label = formatCheckpointLabelCPC(getCheckpointStateCPC());
    } else if (pageType === "EU_ENERGY") {
      label = getCheckpointLabelEU();
    } else if (pageType === "PSE") {
      label = getCheckpointLabelPSE();
    } else {
      return;
    }

    badge.textContent = label;
  }

  function updateQualificationListLayout() {
    const spans = document.querySelectorAll("span");
    for (const span of spans) {
      if ((span.textContent || "").includes("Qualification list")) {
        const gridDiv = span.nextElementSibling;
        if (gridDiv && gridDiv.tagName.toLowerCase() === "div") {
          if (isVerticalListEnabled) {
            gridDiv.classList.add("tk-qual-grid-vertical");
          } else {
            gridDiv.classList.remove("tk-qual-grid-vertical");
          }
        }
      }
    }
  }

  function handlePassButtonTimer() {
    if (!isPassColorEnabled && !isPassDisableEnabled) return;

    const buttons = document.querySelectorAll(
      "button.rocket-btn.rocket-btn-primary",
    );
    if (!buttons.length) return;

    if (!document.hidden) {
      const now = Date.now();
      accumulatedActiveTime += now - lastTimeCheck;
      lastTimeCheck = now;
    }

    let elapsed = accumulatedActiveTime;

    const timeSpan = Array.from(document.querySelectorAll("span")).find((s) =>
      (s.textContent || "").includes("Time:"),
    );

    if (timeSpan) {
      const match = timeSpan.textContent.match(
        /Time:\s*(\d{2}):(\d{2}):(\d{2})/i,
      );
      if (match) {
        elapsed =
          (parseInt(match[1]) * 3600 +
            parseInt(match[2]) * 60 +
            parseInt(match[3])) *
          1000;
      }
    }

    const remaining = Math.max(0, passDelaySeconds * 1000 - elapsed);

    buttons.forEach((btn) => {
      const txt = getText(btn).toLowerCase();
      if (txt !== "pass" && txt !== "ok") return;

      if (remaining > 0) {
        if (isPassDisableEnabled) {
          btn.style.setProperty("pointer-events", "none", "important");
          btn.style.setProperty("cursor", "not-allowed", "important");
          btn.style.setProperty("opacity", "0.5", "important");
        }
        btn.removeAttribute("data-tk-unlocked");
      } else {
        if (btn.getAttribute("data-tk-unlocked") === "true") return;

        if (isPassDisableEnabled) {
          btn.style.setProperty("pointer-events", "auto", "important");
          btn.style.setProperty("cursor", "pointer", "important");
          btn.style.setProperty("opacity", "1", "important");
        } else if (txt === "pass" && isPassColorEnabled) {
          btn.style.setProperty("background-image", "none", "important");
          btn.style.setProperty(
            "background-color",
            passTargetColor,
            "important",
          );
          btn.style.setProperty("border-color", passTargetColor, "important");
          btn.style.setProperty("box-shadow", "none", "important");
          btn.style.setProperty("color", "#fff", "important");
        }

        btn.setAttribute("data-tk-unlocked", "true");
      }
    });
  }

  function getAuditedRecordId() {
    const spans = Array.from(document.querySelectorAll("span"));
    const labelSpan = spans.find((s) =>
      (s.textContent || "").includes("Audited Record ID"),
    );

    if (!labelSpan) return "Audit Group";

    try {
      const container = labelSpan.closest("div[style*='display: inline-flex']");
      if (container) {
        const text = container.innerText || "";
        const match = text.replace("Audited Record ID", "").match(/(\d{5,})/);
        if (match) return match[1];
      }
    } catch (e) {
      console.error(e);
    }

    return "Audit Group";
  }

  function scanQualificationLinksInDoc() {
    const spans = document.querySelectorAll("span");
    let targetSpan = null;
    for (const span of spans) {
      const txt = (span.textContent || "").trim();
      if (txt.includes("Qualification list")) {
        targetSpan = span;
        break;
      }
    }
    if (!targetSpan)
      return { ok: false, error: "Không thấy span chứa chuỗi cần tìm" };
    let nextDiv = targetSpan.nextElementSibling;
    while (nextDiv && nextDiv.tagName.toLowerCase() !== "div")
      nextDiv = nextDiv.nextElementSibling;
    if (!nextDiv) return { ok: false, error: "Không thấy div kế tiếp" };
    const links = Array.from(nextDiv.querySelectorAll("a[href]")).map(
      (a) => a.href,
    );
    if (!links.length) return { ok: false, error: "Không có link trong div" };
    return { ok: true, urls: links };
  }

  function openLinks(urls, groupName = null) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "openLinks", urls, groupName },
        (resp) => resolve(resp || { ok: false }),
      );
    });
  }

  function smartScroll() {
    const spans = Array.from(document.querySelectorAll("span"));

    if (isScrollLastAllEnabled) {
      const allListSpans = spans.filter((el) =>
        (el.textContent || "").includes("Qualification List - All："),
      );

      if (allListSpans.length > 0) {
        const lastSpan = allListSpans[allListSpans.length - 1];
        lastSpan.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    const pageType = identifyPageType();

    if (pageType) {
      const qualSpan = spans.find((el) =>
        (el.textContent || "").includes("Qualification list"),
      );

      if (qualSpan) {
        qualSpan.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    const productImgSpan = spans.find((el) =>
      (el.textContent || "").includes("Product image"),
    );

    if (productImgSpan) {
      productImgSpan.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  let isModifierKeyDown = false;
  const modifierKey = "Backquote";

  window.addEventListener(
    "keydown",
    (e) => {
      if (isLinkOpenerEnabled) {
        if (e.code === modifierKey) {
          if (isGroupOpenEnabled) {
            e.preventDefault();

            const res = scanQualificationLinksInDoc();
            const recordId = getAuditedRecordId();

            if (res.ok && res.urls && res.urls.length > 0) {
              openLinks(res.urls, recordId);
              console.log(
                `Toggle group request sent for "${recordId}" with ${res.urls.length} links`,
              );
            } else {
            }
            return;
          }

          isModifierKeyDown = true;
        }
      }

      if (isScrollTopEnabled) {
        if (e.code === "F2") {
          e.preventDefault();
          smartScroll();
        }
      }
    },
    true,
  );

  window.addEventListener(
    "keyup",
    (e) => {
      if (e.code === modifierKey) {
        isModifierKeyDown = false;
      }
    },
    true,
  );

  window.addEventListener("blur", () => {
    isModifierKeyDown = false;
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!isLinkOpenerEnabled) return;
      if (isGroupOpenEnabled) return;

      if (!isModifierKeyDown) return;

      const spans = document.querySelectorAll("span");
      let targetSpan = null;
      let foundTitle = false;

      for (const span of spans) {
        if ((span.textContent || "").trim().includes("Qualification list")) {
          targetSpan = span;
          foundTitle = true;
          break;
        }
      }
      if (!foundTitle) return;

      let container = targetSpan.nextElementSibling;
      while (container && container.tagName.toLowerCase() !== "div") {
        container = container.nextElementSibling;
      }
      if (!container) return;

      const clickedLink = e.target.closest("a");
      if (!clickedLink || !container.contains(clickedLink)) return;

      e.preventDefault();
      e.stopPropagation();

      const res = scanQualificationLinksInDoc();
      if (res.ok && res.urls && res.urls.length > 0) {
        openLinks(res.urls);
      }
    },
    true,
  );

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      if (!msg || !msg.type) return;

      if (msg.type === "extract_excel_data") {
        try {
          const pageText = document.body.innerText;

          const extractId = (label) => {
            const match = pageText.match(
              new RegExp(`${label}[:：]\\s*(\\d+)`, "i"),
            );
            return match ? match[1].trim() : "";
          };
          const goodsId = extractId("Product ID");
          const auditId = extractId("Audited Record ID");

          let auditResult = "",
            rejectTag = "",
            correctAnswer = "",
            correctTag = "";

          const cols = document.querySelectorAll(".rocket-col");

          cols.forEach((col) => {
            let text = (col.innerText || col.textContent || "")
              .replace(/\n|\r/g, " ")
              .trim();

            if (/^Audit Results[:：]/i.test(text)) {
              auditResult = text.replace(/^Audit Results[:：]/i, "").trim();
            } else if (/^Reject Tag[:：]/i.test(text)) {
              let cleanTag = text.replace(/^Reject Tag[:：]/i, "").trim();

              cleanTag = cleanTag.replace(/Correct Answer[:：].*/i, "").trim();
              rejectTag = cleanTag;
            } else if (/^Correct Answer[:：]/i.test(text)) {
              let val = text.replace(/^Correct Answer[:：]/i, "").trim();

              val = val.replace(/Reject Tag[:：].*/i, "").trim();

              if (
                val.toUpperCase() === "PASS" ||
                val.toUpperCase() === "REJECT"
              ) {
                correctAnswer = val;
              } else if (val !== "") {
                correctTag = val;
              }
            }
          });

          const urlParams = new URLSearchParams(window.location.search);
          const today = new Date();
          const qaTime = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
          const lobNumber = getProcessIdFromUrl() || "";
          const link = window.location.href;

          sendResponse({
            ok: true,
            data: {
              qaTime,
              goodsId,
              lobNumber,
              auditId,
              auditResult,
              rejectTag,
              correctAnswer,
              correctTag,
              link,
            },
          });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
        return;
      }

      if (msg.type === "scanQualificationLinks") {
        const res = scanQualificationLinksInDoc();
        if (!res.ok)
          sendResponse &&
            sendResponse({ ok: false, error: res.error || "Scan fail" });
        else
          sendResponse &&
            sendResponse({ ok: true, count: res.urls.length, links: res.urls });
        return;
      }

      if (msg.type === "getTabId") {
        sendResponse && sendResponse({ tabId: currentTabId });
        return;
      }
    })();
    return true;
  });

  const debouncedEnhance = debounce(() => {
    try {
      injectTKStyles();
      injectQualHeaderRow();
      updateAcceptBadgeLabel();
      updateQualificationListLayout();
      detectQuestionChange();

      handlePassButtonTimer();
    } catch {}
  }, 350);

  function init() {
    chrome.storage.sync.get(
      {
        enableInfo: true,
        enableLinkOpener: true,
        enableGroupOpen: false,
        enableScrollTop: true,
        enableScrollLastAll: false,
        enableVerticalList: false,

        enablePassColor: false,
        enablePassDisable: false,
        passDelay: 6,
        passColor: "#799df9",
      },
      (items) => {
        isInfoEnabled = items.enableInfo;
        isLinkOpenerEnabled = items.enableLinkOpener;
        isGroupOpenEnabled = items.enableGroupOpen;
        isScrollTopEnabled = items.enableScrollTop;
        isScrollLastAllEnabled = items.enableScrollLastAll;
        isVerticalListEnabled = items.enableVerticalList;

        isPassColorEnabled = items.enablePassColor;
        isPassDisableEnabled = items.enablePassDisable;
        passDelaySeconds = items.passDelay;
        passTargetColor = items.passColor;

        debouncedEnhance();
      },
    );

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "sync") {
        if (changes.enableInfo) {
          isInfoEnabled = changes.enableInfo.newValue;
          if (isInfoEnabled) {
            debouncedEnhance();
          } else {
            removeInjectedInfo();
          }
        }
        if (changes.enableLinkOpener) {
          isLinkOpenerEnabled = changes.enableLinkOpener.newValue;
        }
        if (changes.enableScrollTop) {
          isScrollTopEnabled = changes.enableScrollTop.newValue;
        }
        if (changes.enableScrollLastAll) {
          isScrollLastAllEnabled = changes.enableScrollLastAll.newValue;
        }
        if (changes.enableVerticalList) {
          isVerticalListEnabled = changes.enableVerticalList.newValue;
          updateQualificationListLayout();
        }
        if (changes.enableGroupOpen) {
          isGroupOpenEnabled = changes.enableGroupOpen.newValue;
        }
        if (changes.enablePassColor) {
          isPassColorEnabled = changes.enablePassColor.newValue;
          debouncedEnhance();
        }
        if (changes.passDelay) {
          passDelaySeconds = changes.passDelay.newValue;
        }
        if (changes.passColor) {
          passTargetColor = changes.passColor.newValue;
          debouncedEnhance();
        }
        if (changes.enablePassDisable) {
          isPassDisableEnabled = changes.enablePassDisable.newValue;
          debouncedEnhance();
        }
      }
    });

    chrome.runtime.sendMessage({ type: "getTabId" }, (resp) => {
      currentTabId = resp && resp.tabId ? resp.tabId : null;
      ensureAutoEnabledIfMatch();
    });

    patchHistory();

    if (document.readyState === "complete") onLoadReady();
    else {
      window.addEventListener("load", onLoadReady, { once: true });
      window.addEventListener("pageshow", onLoadReady, { once: true });
    }

    window.addEventListener("tk:navigation", onLoadReady);
    window.addEventListener("popstate", onLoadReady);
    window.addEventListener("hashchange", onLoadReady);

    const obs = new MutationObserver(debouncedEnhance);
    try {
      obs.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } catch {}

    setInterval(() => {
      handlePassButtonTimer();
    }, 200);
  }

  init();
})();
