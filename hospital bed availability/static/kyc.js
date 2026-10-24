(function () {
  const $ = (id) => document.getElementById(id);
  const HINTS = {
    aadhaar: ['12 digits, e.g. 2345 6789 0123', 'Aadhaar number'],
    pan: ['10 characters, e.g. ABCDE1234F', 'PAN'],
    voter_id: ['3 letters + 7 digits, e.g. ABC1234567', 'EPIC number'],
    driving_licence: ['e.g. DL-0420110149646', 'Licence number'],
    passport: ['1 letter + 7 digits, e.g. K1234567', 'Passport number']
  };
  let pollTimer = null;

  function show(which) {
    ['stateLoading', 'statePending', 'stateForm'].forEach(function (id) { $(id).hidden = id !== which; });
  }

  async function loadStatus() {
    const r = await apiCall('/api/kyc/status');
    if (r.status === 401) { location.href = '/login'; return; }
    const st = r.data.kyc_status, sub = r.data.submission;
    if (st === 'verified') { location.href = '/'; return; }
    if (st === 'pending') {
      show('statePending');
      const d = $('pendingDetail');
      d.textContent = '';
      const line = document.createElement('div');
      line.textContent = (sub.id_type + ' ending ' + sub.id_masked.slice(-4) + ' · submitted ' +
        new Date(sub.submitted_at).toLocaleString());
      d.appendChild(line);
      if (!pollTimer) pollTimer = setInterval(loadStatus, 8000);
      return;
    }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    show('stateForm');
    if (st === 'rejected' && sub && sub.reject_reason) {
      const box = $('rejectBox');
      box.textContent = 'Your last submission was rejected: ' + sub.reject_reason + ' Please correct it and submit again.';
      box.classList.add('show');
    }
  }

  $('id_type').addEventListener('change', function () {
    const h = HINTS[this.value];
    $('idHint').textContent = h ? h[0] : 'Choose a document first.';
    $('id_number').placeholder = h ? h[1] : '';
  });

  $('kycForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    showError('err', '');
    if (!$('id_type').value) return showError('err', 'Choose which ID you are submitting.');
    if (!$('front').files[0]) return showError('err', 'Upload a photo of the front of your ID.');
    if (!$('consent').checked) return showError('err', 'Please tick the consent box to continue.');

    const fd = new FormData();
    fd.append('id_type', $('id_type').value);
    fd.append('id_number', $('id_number').value);
    fd.append('legal_name', $('legal_name').value);
    fd.append('dob', $('dob').value);
    fd.append('consent', 'yes');
    fd.append('front', $('front').files[0]);
    if ($('back').files[0]) fd.append('back', $('back').files[0]);

    const btn = $('submitBtn');
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const r = await apiCall('/api/kyc', { method: 'POST', body: fd });
      if (r.ok) {
        if (r.data.status === 'verified') { location.href = '/'; return; }
        $('rejectBox').classList.remove('show');
        await loadStatus();
        return;
      }
      showError('err', r.data.error || 'Submission failed.');
    } catch (ex) {
      showError('err', 'Cannot reach the server. Is it running?');
    }
    btn.disabled = false; btn.textContent = 'Submit for verification';
  });

  loadStatus();
})();
