// 发送人管理 + 通知设置

// ============ 发送人管理 ============
const recModal = document.getElementById('recipientsModal');
const recEditModal = document.getElementById('recipientEditModal');
let _recEditId = null; // null=新增, 数字=编辑

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
      listEl.innerHTML = '<div class="rec-empty">暂无发送人，点击右上角"新增发送人"添加</div>';
      return;
    }
    listEl.innerHTML = list.map(r => `
      <div class="rec-item ${r.enabled ? '' : 'disabled'}">
        <div class="rec-info">
          <span class="rec-name">${esc(r.name)}</span>
          <span class="rec-phone">📱 ${esc(r.phone)}</span>
          <span class="rec-email">✉ ${esc(r.email)}</span>
          ${r.remark ? `<span class="rec-remark">备注: ${esc(r.remark)}</span>` : ''}
        </div>
        <div class="rec-actions">
          <span class="rec-status ${r.enabled ? 'on' : 'off'}">${r.enabled ? '启用' : '禁用'}</span>
          <button class="btn btn-outline btn-sm" data-edit="${r.id}">编辑</button>
          <button class="btn btn-outline btn-sm btn-danger-text" data-del="${r.id}">删除</button>
        </div>
      </div>
    `).join('');
    // 绑定事件
    listEl.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openRecipientEdit(parseInt(b.dataset.edit))));
    listEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => delRecipient(parseInt(b.dataset.del))));
  } catch (e) {
    listEl.innerHTML = `<div class="rec-empty">加载失败: ${esc(e.message)}</div>`;
  }
}

// 新增
document.getElementById('btnAddRecipient').addEventListener('click', () => openRecipientEdit(null));

function openRecipientEdit(id) {
  _recEditId = id;
  document.getElementById('recipientEditTitle').textContent = id ? '编辑发送人' : '新增发送人';
  if (id) {
    // 从现有列表读取填充
    const items = document.querySelectorAll('#recipientsList .rec-item');
    let target = null;
    // 简单方式：重新请求单条不便，直接从 DOM 提取（备注/启用态可能缺失），这里改为请求全量找
    API.recipients(true).then(list => {
      const r = list.find(x => x.id === id);
      if (!r) { showToast('未找到该发送人', true); return; }
      document.getElementById('rcName').value = r.name || '';
      document.getElementById('rcPhone').value = r.phone || '';
      document.getElementById('rcEmail').value = r.email || '';
      document.getElementById('rcRemark').value = r.remark || '';
      document.getElementById('rcEnabled').checked = !!r.enabled;
      recEditModal.hidden = false;
    }).catch(e => showToast(e.message, true));
  } else {
    document.getElementById('rcName').value = '';
    document.getElementById('rcPhone').value = '';
    document.getElementById('rcEmail').value = '';
    document.getElementById('rcRemark').value = '';
    document.getElementById('rcEnabled').checked = true;
    recEditModal.hidden = false;
  }
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
  btn.disabled = true; btn.textContent = '保存中...';
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
  btn.disabled = false; btn.textContent = '保存';
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
document.getElementById('btnSettings').addEventListener('click', async () => {
  try {
    const list = await API.settings();
    const kv = {};
    list.forEach(s => kv[s.key] = s.value);
    document.getElementById('notifyMode').value = kv.notify_mode || 'single';
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
    notify_mode: document.getElementById('notifyMode').value,
    yellow_threshold: document.getElementById('setYellow').value,
    red_threshold: document.getElementById('setRed').value,
    red_repeat_hours: document.getElementById('setRedRepeat').value,
    alert_email_enabled: document.getElementById('setEmailEnabled').checked ? 'true' : 'false',
    alert_sms_enabled: document.getElementById('setSmsEnabled').checked ? 'true' : 'false',
  };
  const btn = document.getElementById('settingsSave');
  btn.disabled = true; btn.textContent = '保存中...';
  try {
    await API.updateSettings(kv);
    showToast('设置已保存');
    settingsModal.hidden = true;
  } catch (e) {
    showToast(e.message, true);
  }
  btn.disabled = false; btn.textContent = '保存';
});

// HTML 转义
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
