const $ = (id) => document.getElementById(id);
const { apiKey = '' } = await chrome.storage.sync.get('apiKey');
$('key').value = apiKey;
$('save').onclick = async () => { await chrome.storage.sync.set({ apiKey: $('key').value.trim() }); $('msg').textContent = 'Saved.'; $('msg').className = 'small ok'; };
$('test').onclick = async () => {
  $('msg').textContent = 'Testing…'; $('msg').className = 'small muted';
  try {
    const r = await fetch('https://api.api.sh/v1/account', { headers: { 'x-api-key': $('key').value.trim() } });
    if (r.ok) { const j = await r.json().catch(() => ({})); $('msg').textContent = `Key works.${j.credits?.total != null ? ' Credits left: ' + j.credits.total.toLocaleString() : ''}`; $('msg').className = 'small ok'; }
    else { $('msg').textContent = `The key was refused (${r.status}).`; $('msg').className = 'small err'; }
  } catch (e) { $('msg').textContent = 'Could not reach api.api.sh.'; $('msg').className = 'small err'; }
};
