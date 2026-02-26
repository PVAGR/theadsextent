let initialized = false;

chrome.storage.local.get('enabled', ({ enabled }) => {
  initialized = true;
  if (enabled) {
    applyExtension();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (!initialized || !changes.enabled) return;
  if (changes.enabled.newValue) {
    applyExtension();
  } else {
    removeExtension();
  }
});

function applyExtension() {
  document.body.dataset.theadsextent = 'active';
}

function removeExtension() {
  delete document.body.dataset.theadsextent;
}
