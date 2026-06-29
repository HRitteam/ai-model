// 按钮交互 + 发送通知弹窗 + Toast

document.getElementById('btnCollect').addEventListener('click', async () => {
  const btn = document.getElementById('btnCollect');
  btn.disabled = true;
  btn.textContent = '采集中...';
  try {
    await API.collect();
    showToast('采集已触发，3 秒后刷新数据');
    setTimeout(() => loadDashboard(), 3000);
  } catch (e) {
    showToast(e.message, true);
  }
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '手动采集';
  }, 3000);
});

const modal = document.getElementById('testModal');
document.getElementById('btnTestAlert').addEventListener('click', async () => {
  try {
    const platforms = await API.platforms();
    const notifyPlatforms = (platforms || []).filter(p => p.code !== 'zhipu' && p.code !== 'minimax');
    const sel = document.getElementById('testPlatform');
    sel.innerHTML = '<option value="">- 请选择 -</option>' +
      notifyPlatforms.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
  } catch (_) {}
  document.getElementById('modalResult').hidden = true;
  modal.hidden = false;
});

document.getElementById('modalClose').addEventListener('click', () => (modal.hidden = true));
document.getElementById('modalCancel').addEventListener('click', () => (modal.hidden = true));
modal.addEventListener('click', e => {
  if (e.target === modal) modal.hidden = true;
});

document.getElementById('modalSend').addEventListener('click', async () => {
  const channel = document.getElementById('testChannel').value;
  const platform = document.getElementById('testPlatform').value || undefined;
  const btn = document.getElementById('modalSend');
  const resultEl = document.getElementById('modalResult');
  btn.disabled = true;
  btn.textContent = '发送中...';
  try {
    const r = await API.sendNotification(channel, platform);
    let html = '';
    if (r.email) html += `<div class="${r.email.status === 'success' ? 'r-ok' : 'r-fail'}">邮件: ${r.email.status === 'success' ? '✓ 发送成功' : '✗ ' + (r.email.error || '失败')}</div>`;
    if (r.sms) html += `<div class="${r.sms.status === 'success' ? 'r-ok' : 'r-fail'}">短信: ${r.sms.status === 'success' ? '✓ 发送成功' : '✗ ' + (r.sms.error || '失败')}</div>`;
    if (!html) html = '<div class="r-fail">未执行发送</div>';
    resultEl.innerHTML = html;
    resultEl.hidden = false;
  } catch (e) {
    resultEl.innerHTML = `<div class="r-fail">✗ ${e.message}</div>`;
    resultEl.hidden = false;
  }
  btn.disabled = false;
  btn.textContent = '发送通知';
});

function showToast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  t.hidden = false;
  clearTimeout(window._toastT);
  window._toastT = setTimeout(() => (t.hidden = true), 3000);
}
