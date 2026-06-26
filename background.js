const AUTO_ENABLE_MATCHER = (url) => {
  try {
    if (!url) return false;
    const u = new URL(url);
    return (
      u.hostname === "outsourcing.logisticsmngmt.com" &&
      u.pathname.startsWith("/next/govern/aegis-auditing/detail")
    );
  } catch {
    return false;
  }
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "getTabId") {
    sendResponse({ tabId: sender.tab ? sender.tab.id : null });
    return true;
  }

  if (msg && msg.type === "openLinks") {
    const { urls = [], groupName = null } = msg;

    (async () => {
      try {
        if (groupName && chrome.tabGroups) {
          const existingGroups = await chrome.tabGroups.query({
            title: String(groupName),
          });

          if (existingGroups.length > 0) {
            const targetGroup = existingGroups[0];
            const tabsInGroup = await chrome.tabs.query({
              groupId: targetGroup.id,
            });
            const tabIds = tabsInGroup.map((t) => t.id);

            if (tabIds.length > 0) {
              await chrome.tabs.remove(tabIds);
            }
            sendResponse({ ok: true, action: "closed_group" });
            return;
          }
        }

        if (!urls.length) {
          sendResponse({ ok: false, error: "No URLs" });
          return;
        }

        const newTabIds = [];
        for (const u of urls) {
          const tab = await chrome.tabs.create({ url: u, active: false });
          if (tab && tab.id) {
            newTabIds.push(tab.id);
          }
        }

        if (groupName && newTabIds.length > 0 && chrome.tabs.group) {
          const groupId = await chrome.tabs.group({ tabIds: newTabIds });

          await chrome.tabGroups.update(groupId, {
            title: String(groupName),
            color: "blue",
          });
        }

        sendResponse({ ok: true, count: urls.length, action: "opened_group" });
      } catch (err) {
        console.error("Error opening/grouping tabs:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();

    return true;
  }

  return false;
});

async function isTabEnabled(tabId) {
  return new Promise((r) => {
    chrome.storage.sync.get({ enabledTabs: {} }, (res) =>
      r(!!(res.enabledTabs || {})[tabId]),
    );
  });
}

function setEnabledForTab(tabId, enabled) {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ enabledTabs: {} }, (data) => {
      const enabledTabs = data.enabledTabs || {};
      if (enabled) enabledTabs[tabId] = true;
      else delete enabledTabs[tabId];
      chrome.storage.sync.set({ enabledTabs }, () => {
        try {
          chrome.tabs.sendMessage(tabId, { type: "prefsUpdate" });
        } catch {}
        resolve(enabledTabs);
      });
    });
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if ((changeInfo.status === "complete" || changeInfo.url) && tab && tab.url) {
    if (AUTO_ENABLE_MATCHER(tab.url)) {
      const alreadyEnabled = await isTabEnabled(tabId);
      if (!alreadyEnabled) {
        await setEnabledForTab(tabId, true);
      }
    }
  }
});
