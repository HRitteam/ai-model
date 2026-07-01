// 发送人管理 + 通知设置

// ============ 发送人管理 ============
const recModal = document.getElementById('recipientsModal');
const recEditModal = document.getElementById('recipientEditModal');
let _recEditId = null;

document.getElementById('btnRecipients').addEventListener('click', async () => {
  recModal.hidden = false;
  await loadRecipients();
});

document.getElementById('recipientsClose').addEventListener('click', () => (recModal.hidden = true));
recModal.addEventListener('click', e => { if (e.target === recModal) recModal.hidden = true; });

async function loadRecipients() {
  const listEl = document.getElementById('recipientsList');
  listEl.innerHTML = '<div class="rec-loading">加载中...</div>';
  try {
    const list = await API.recipients(true);
    if (!list || !list.length) {
      listEl.innerHTML = '<div class="rec-empty">暂无发送人，点击右上角“新增发送人”添加</div>';
      return;
    }

    listEl.innerHTML = list.map(r => `
      <div class="rec-item ${r.enabled ? '' : 'disabled'}">
        <div class="rec-info">
          <span class="rec-name">${esc(r.name)}</span>
          <span class="rec-phone">手机号 ${esc(r.phone)}</span>
          <span class="rec-email">邮箱 ${esc(r.email)}</span>
          ${r.remark ? `<span class="rec-remark">备注: ${esc(r.remark)}</span>` : ''}
        </div>
        <div class="rec-actions">
          <span class="rec-status ${r.enabled ? 'on' : 'off'}">${r.enabled ? '启用' : '禁用'}</span>
          <button class="btn btn-outline btn-sm" data-edit="${r.id}">编辑</button>
          <button class="btn btn-outline btn-sm btn-danger-text" data-del="${r.id}">删除</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => openRecipientEdit(parseInt(b.dataset.edit, 10)));
    });
    listEl.querySelectorAll('[data-del]').forEach(b => {
      b.addEventListener('click', () => delRecipient(parseInt(b.dataset.del, 10)));
    });
  } catch (e) {
    listEl.innerHTML = `<div class="rec-empty">加载失败: ${esc(e.message)}</div>`;
  }
}

document.getElementById('btnAddRecipient').addEventListener('click', () => openRecipientEdit(null));

function openRecipientEdit(id) {
  _recEditId = id;
  document.getElementById('recipientEditTitle').textContent = id ? '编辑发送人' : '新增发送人';

  if (!id) {
    document.getElementById('rcName').value = '';
    document.getElementById('rcPhone').value = '';
    document.getElementById('rcEmail').value = '';
    document.getElementById('rcRemark').value = '';
    document.getElementById('rcEnabled').checked = true;
    recEditModal.hidden = false;
    return;
  }

  API.recipients(true).then(list => {
    const r = list.find(x => x.id === id);
    if (!r) {
      showToast('未找到该发送人', true);
      return;
    }
    document.getElementById('rcName').value = r.name || '';
    document.getElementById('rcPhone').value = r.phone || '';
    document.getElementById('rcEmail').value = r.email || '';
    document.getElementById('rcRemark').value = r.remark || '';
    document.getElementById('rcEnabled').checked = !!r.enabled;
    recEditModal.hidden = false;
  }).catch(e => showToast(e.message, true));
}

document.getElementById('recipientEditClose').addEventListener('click', () => (recEditModal.hidden = true));
document.getElementById('recipientEditCancel').addEventListener('click', () => (recEditModal.hidden = true));
recEditModal.addEventListener('click', e => { if (e.target === recEditModal) recEditModal.hidden = true; });

document.getElementById('recipientEditSave').addEventListener('click', async () => {
  const name = document.getElementById('rcName').value.trim();
  const phone = document.getElementById('rcPhone').value.trim();
  const email = document.getElementById('rcEmail').value.trim();
  const remark = document.getElementById('rcRemark').value.trim();
  const enabled = document.getElementById('rcEnabled').checked ? 1 : 0;

  if (!name) { showToast('请填写姓名', true); return; }
  if (!phone) { showToast('请填写手机号', true); return; }
  if (!email) { showToast('请填写邮箱', true); return; }

  const btn = document.getElementById('recipientEditSave');
  btn.disabled = true;
  btn.textContent = '保存中...';
  try {
    if (_recEditId) {
      await API.updateRecipient(_recEditId, { name, phone, email, remark, enabled });
    } else {
      await API.addRecipient({ name, phone, email, remark, enabled });
    }
    recEditModal.hidden = true;
    showToast('保存成功');
    await loadRecipients();
  } catch (e) {
    showToast(e.message, true);
  }
  btn.disabled = false;
  btn.textContent = '保存';
});

async function delRecipient(id) {
  if (!confirm('确认删除该发送人？')) return;
  try {
    await API.delRecipient(id);
    showToast('删除成功');
    await loadRecipients();
  } catch (e) {
    showToast(e.message, true);
  }
}

// ============ 通知设置 ============
const settingsModal = document.getElementById('settingsModal');
const notifyModeEl = document.getElementById('notifyMode');

function ensureSettingsTip() {
  const body = settingsModal ? settingsModal.querySelector('.modal-body') : null;
  if (!body) return null;

  let tip = document.getElementById('settingsTip');
  if (!tip) {
    const firstRow = body.querySelector('.form-row');
    tip = document.createElement('div');
    tip.id = 'settingsTip';
    tip.className = 'settings-tip';
    if (firstRow && firstRow.nextSibling) body.insertBefore(tip, firstRow.nextSibling);
    else body.appendChild(tip);
  }
  return tip;
}

function initSettingsOptions() {
  if (!notifyModeEl) return;
  notifyModeEl.innerHTML = [
    '<option value="single">单发 - 每个平台单独发送一条通知</option>',
    '<option value="merged">合并 - 所有平台汇总到一条通知</option>',
    '<option value="both">两者 - 单发 + 合并都发</option>',
  ].join('');

  const tip = ensureSettingsTip();
  if (tip) {
    tip.textContent = '自动通知会按已启用渠道同时发送，建议邮件和短信都保持开启。';
  }

  const modalCard = settingsModal ? settingsModal.querySelector('.modal') : null;
  if (modalCard) modalCard.classList.add('modal-settings');
  if (settingsModal) settingsModal.classList.add('modal-mask-lite');
}

initSettingsOptions();

document.getElementById('btnSettings').addEventListener('click', async () => {
  try {
    const list = await API.settings();
    const kv = {};
    list.forEach(s => { kv[s.key] = s.value; });

    initSettingsOptions();
    notifyModeEl.value = kv.notify_mode || 'single';
    document.getElementById('setYellow').value = kv.yellow_threshold || 500;
    document.getElementById('setRed').value = kv.red_threshold || 200;
    document.getElementById('setRedRepeat').value = kv.red_repeat_hours || 6;
    document.getElementById('setEmailEnabled').checked = kv.alert_email_enabled !== 'false';
    document.getElementById('setSmsEnabled').checked = kv.alert_sms_enabled !== 'false';
  } catch (e) {
    showToast(e.message, true);
  }
  settingsModal.hidden = false;
});

document.getElementById('settingsClose').addEventListener('click', () => (settingsModal.hidden = true));
document.getElementById('settingsCancel').addEventListener('click', () => (settingsModal.hidden = true));
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.hidden = true; });

document.getElementById('settingsSave').addEventListener('click', async () => {
  const kv = {
    notify_mode: notifyModeEl.value,
    yellow_threshold: document.getElementById('setYellow').value,
    red_threshold: document.getElementById('setRed').value,
    red_repeat_hours: document.getElementById('setRedRepeat').value,
    alert_email_enabled: document.getElementById('setEmailEnabled').checked ? 'true' : 'false',
    alert_sms_enabled: document.getElementById('setSmsEnabled').checked ? 'true' : 'false',
  };

  const btn = document.getElementById('settingsSave');
  btn.disabled = true;
  btn.textContent = '保存中...';
  try {
    await API.updateSettings(kv);
    showToast('设置已保存');
    settingsModal.hidden = true;
  } catch (e) {
    showToast(e.message, true);
  }
  btn.disabled = false;
  btn.textContent = '保存';
});

// HTML 转义
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
