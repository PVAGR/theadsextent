const toggleBtn = document.getElementById('toggleBtn');
const statusEl = document.getElementById('status');

chrome.storage.local.get('enabled', ({ enabled }) => {
  updateUI(!!enabled);
});

toggleBtn.addEventListener('click', () => {
  chrome.storage.local.get('enabled', ({ enabled }) => {
    const next = !(enabled === true);
    chrome.storage.local.set({ enabled: next }, () => {
      updateUI(next);
    });
  });
});

function updateUI(enabled) {
  toggleBtn.textContent = enabled ? 'Disable' : 'Enable';
  statusEl.textContent = `Extension is ${enabled ? 'enabled' : 'disabled'}.`;
}
