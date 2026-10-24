(function () {
  const list = document.getElementById('list');
  let status = 'pending';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function toast(msg, type) {
    const t = el('div', 'toast toast-' + (type || 'info'), msg);
    document.getElementById('toastContainer').appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  function field(grid, label, value, flagClass) {
    const wrap = el('div');
    wrap.appendChild(el('dt', null, label));
    wrap.appendChild(el('dd', flagClass || '', value));
    grid.appendChild(wrap);
  }

  function card(it) {
    const c = el('div', 'kyc-card');
    const head = el('div', 'kyc-head');
    const left = el('div');
    left.appendChild(el('strong', null, it.account_name));
    left.appendChild(el('div', 'auth-sub', it.email + ' · ' + it.phone + ' · ' + it.designation));
    head.appendChild(left);
    head.appendChild(el('span', 'status-pill ' + it.status, it.status));
    c.appendChild(head);

    const grid = el('dl', 'kyc-grid');
    field(grid, 'Name on ID', it.legal_name);
    field(grid, 'Name matches account?', it.name_matches_account ? 'Yes' : 'No: compare carefully',
      it.name_matches_account ? 'flag-ok' : 'flag-warn');
    field(grid, 'Date of birth', it.dob);
    field(grid, 'Document', it.id_type);
    field(grid, 'ID number (masked)', it.id_masked);
    if (it.checksum_ok) field(grid, 'Aadhaar checksum', 'Passed', 'flag-ok');
    field(grid, 'Submitted', new Date(it.submitted_at).toLocaleString());
    if (it.reviewed_by) field(grid, 'Reviewed by', it.reviewed_by + ' · ' + new Date(it.reviewed_at).toLocaleString());
    if (it.reject_reason) field(grid, 'Rejection reason', it.reject_reason);
    c.appendChild(grid);

    if (it.has_front || it.has_back) {
      const docs = el('div', 'doc-links');
      ['front', 'back'].forEach(function (side) {
        if (!it['has_' + side]) return;
        const a = el('a', null, 'View ID ' + side + ' ↗');
        a.href = '/api/admin/kyc/' + it.id + '/doc/' + side;
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        docs.appendChild(a);
      });
      c.appendChild(docs);
    }

    if (it.status === 'pending') {
      const row = el('div', 'decision-row');
      const reason = el('input', 'form-input');
      reason.placeholder = 'Reason (required only if rejecting)';
      reason.maxLength = 300;
      const ok = el('button', 'btn btn-success', '✓ Approve');
      const no = el('button', 'btn btn-danger', '✕ Reject');
      ok.type = no.type = 'button';
      ok.addEventListener('click', function () { decide(it.id, 'approve', '', ok, no); });
      no.addEventListener('click', function () { decide(it.id, 'reject', reason.value, ok, no); });
      row.append(reason, ok, no);
      c.appendChild(row);
    }
    return c;
  }

  async function decide(id, decision, reason, b1, b2) {
    b1.disabled = b2.disabled = true;
    const r = await apiCall('/api/admin/kyc/' + id + '/decision', {
      method: 'POST', body: { decision: decision, reason: reason } });
    if (r.ok) { toast(decision === 'approve' ? 'Approved' : 'Rejected', 'success'); load(); }
    else { toast(r.data.error || 'Failed', 'error'); b1.disabled = b2.disabled = false; }
  }

  async function load() {
    showError('err', '');
    const r = await apiCall('/api/admin/kyc?status=' + status);
    list.textContent = '';
    if (!r.ok) { showError('err', r.data.error || 'Could not load submissions.'); return; }
    if (!r.data.items.length) { list.appendChild(el('div', 'empty', 'Nothing here.')); return; }
    r.data.items.forEach(function (it) { list.appendChild(card(it)); });
  }

  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      status = b.dataset.status;
      load();
    });
  });
  load();
})();
