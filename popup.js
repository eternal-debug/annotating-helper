const auditorSelect = document.getElementById("auditorSelect");
const teamSelect = document.getElementById("teamSelect");
const copyExcelBtn = document.getElementById("copyExcelBtn");
const copyStatus = document.getElementById("copyStatus");
const configMap = {
  toggles: {
    toggleInfo: "enableInfo",
    toggleLinkOpener: "enableLinkOpener",
    toggleGroupOpen: "enableGroupOpen",
    toggleScrollTop: "enableScrollTop",
    toggleScrollLastAll: "enableScrollLastAll",
    toggleVerticalList: "enableVerticalList",
    togglePassColor: "enablePassColor",
    togglePassDisable: "enablePassDisable",
  },
  inputs: {
    inputPassDelay: "passDelay",
    inputPassColor: "passColor",
  },
};
const teamData = {
  team1: [
    "AppenJP002",
    "AppenJP005",
    "AppenJP006",
    "AppenJP007",
    "AppenJP009",
    "AppenJP010",
    "AppenJP011",
    "AppenJP012",
    "AppenJP014",
    "AppenJP015",
    "AppenJP016",
    "AppenJP019",
    "AppenJP020",
  ],
  team2: [
    "AppenJP021",
    "AppenJP022",
    "AppenJP023",
    "AppenJP024",
    "AppenJP025",
    "AppenJP026",
    "AppenJP027",
    "AppenJP028",
    "AppenJP029",
    "AppenJP030",
    "AppenJP032",
    "AppenJP033",
    "AppenJP034",
  ],
};

function renderAuditors(teamKey, savedAuditor = null) {
  auditorSelect.innerHTML = "";
  const auditors = teamData[teamKey] || [];

  auditors.forEach((id) => {
    let option = document.createElement("option");
    option.value = id;
    option.text = id;
    auditorSelect.add(option);
  });

  if (savedAuditor && auditors.includes(savedAuditor)) {
    auditorSelect.value = savedAuditor;
  }
}

if (auditorSelect && copyExcelBtn && teamSelect) {
  chrome.storage.sync.get(["savedAuditor", "savedTeam"], (res) => {
    const currentTeam = res.savedTeam || "team2";
    teamSelect.value = currentTeam;

    renderAuditors(currentTeam, res.savedAuditor);
  });

  teamSelect.addEventListener("change", (e) => {
    const selectedTeam = e.target.value;
    chrome.storage.sync.set({ savedTeam: selectedTeam });

    renderAuditors(selectedTeam);

    chrome.storage.sync.set({ savedAuditor: auditorSelect.value });
  });

  auditorSelect.addEventListener("change", (e) => {
    chrome.storage.sync.set({ savedAuditor: e.target.value });
  });

  copyExcelBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;

      copyExcelBtn.innerText = "Đang...";
      copyExcelBtn.disabled = true;

      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "extract_excel_data" },
        (response) => {
          copyExcelBtn.innerText = "Copy";
          copyExcelBtn.disabled = false;

          if (chrome.runtime.lastError || !response || !response.ok) {
            copyStatus.innerText = "❌ Lỗi: Hãy F5 lại trang web audit!";
            copyStatus.style.color = "red";
            return;
          }

          const d = response.data;
          const auditor = auditorSelect.value;
          const currentTeam = teamSelect.value;

          let rowData = [];
          if (currentTeam === "team1") {
            rowData = [
              d.qaTime,
              d.link,
              d.lobNumber,
              d.auditId,
              auditor,
              d.auditResult,
              d.rejectTag,
              d.correctAnswer,
              d.correctTag,
            ];
          } else {
            rowData = [
              d.qaTime,
              d.lobNumber,
              d.auditId,
              auditor,
              d.auditResult,
              d.rejectTag,
              d.correctAnswer,
              d.correctTag,
              d.link,
            ];
          }

          const tsvString = rowData.join("\t");
          navigator.clipboard
            .writeText(tsvString)
            .then(() => {
              copyStatus.innerText = "✅ Đã copy! Hãy dán vào Excel.";
              copyStatus.style.color = "#107c41";
              copyStatus.classList.add("status-animate");
              setTimeout(() => {
                copyStatus.innerText = "";
                copyStatus.classList.remove("status-animate");
              }, 3000);
            })
            .catch(() => {
              copyStatus.innerText = "❌ Không có quyền ghi Clipboard";
              copyStatus.style.color = "red";
            });
        },
      );
    });
  });
}

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
    passDelay: 5,
    passColor: "#ff7eb3",
  },
  (items) => {
    for (const [id, key] of Object.entries(configMap.toggles)) {
      const el = document.getElementById(id);
      if (el) el.checked = items[key];
    }
    for (const [id, key] of Object.entries(configMap.inputs)) {
      const el = document.getElementById(id);
      if (el) el.value = items[key];
    }
  },
);

function setupConfigListeners(config, eventType, valueExtractor) {
  for (const [id, key] of Object.entries(config)) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener(eventType, (e) => {
        chrome.storage.sync.set({ [key]: valueExtractor(e.target) });
      });
    }
  }
}

setupConfigListeners(configMap.toggles, "change", (target) => target.checked);
setupConfigListeners(configMap.inputs, "change", (target) => target.value);

const toggleDisableEl = document.getElementById("togglePassDisable");
const colorRow = document.getElementById("colorPickerRow");
if (toggleDisableEl && colorRow) {
  const updateUI = () =>
    (colorRow.style.opacity = toggleDisableEl.checked ? "0.4" : "1");
  toggleDisableEl.addEventListener("change", updateUI);
  chrome.storage.sync.get({ enablePassDisable: false }, (res) => {
    toggleDisableEl.checked = res.enablePassDisable;
    updateUI();
  });
}
