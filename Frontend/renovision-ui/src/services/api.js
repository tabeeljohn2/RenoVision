// api.js — RenoVision Web API Layer

const BACKEND_URL =
  process.env.REACT_APP_KAGGLE_BACKEND_URL ||
  'https://ahmad3351-renovision.hf.space';          // fallback if not set

export const getBaseUrl = () => BACKEND_URL;
export const saveBaseUrl = () => {};

// ─────────────────────────────────────────
// Health check — returns { online, ready, uptime }
// ─────────────────────────────────────────
export const checkHealth = async () => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return { online: false, ready: false };
    const data = await res.json();
    return {
      online: true,
      ready: data.ready === true,
      uptime: data.uptime_seconds ?? 0,
    };
  } catch {
    return { online: false, ready: false };
  }
};

// ─────────────────────────────────────────
// Wake backend and poll until ready (max 90s)
// ─────────────────────────────────────────
const wakeBackend = async (onStatus) => {
  const TIMEOUT_MS = 90000;
  const POLL_MS    = 4000;
  const start      = Date.now();

  while (Date.now() - start < TIMEOUT_MS) {
    const elapsed = Math.round((Date.now() - start) / 1000);
    onStatus?.(`⏳ Waking backend... ${elapsed}s`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${BACKEND_URL}/wake`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.ready === true) return true;
      }
    } catch {
      // still sleeping
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
};

// ─────────────────────────────────────────
// Build multipart FormData for file upload
// ─────────────────────────────────────────
const buildFormData = (imageUri, budget, style, token, userPrompt) => {
  const fd = new FormData();
  fd.append('file', { uri: imageUri, type: 'image/jpeg', name: 'room.jpg' });
  fd.append('budget',      String(budget));
  fd.append('style',       String(style));
  fd.append('token',       String(token));
  fd.append('user_prompt', String(userPrompt || ''));
  return fd;
};

// ─────────────────────────────────────────
// fetch with hard timeout
// ─────────────────────────────────────────
const fetchWithTimeout = async (url, options, ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
};

// ─────────────────────────────────────────
// Safe JSON parse — backend returns HTML when cold
// ─────────────────────────────────────────
const safeParseJSON = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`non_json_response:${response.status}`);
  }
};

// ─────────────────────────────────────────
// POST /analyze — main pipeline call
// ─────────────────────────────────────────
export const analyzeRoom = async (
  imageUri,
  budget,
  style,
  token,
  userPrompt = '',
  onStatus   = null
) => {
  if (!token)    throw new Error('Not logged in. Please login again.');
  if (!imageUri) throw new Error('No image selected.');

  onStatus?.('🔌 Connecting to backend...');
  const health = await checkHealth();

  if (!health.ready) {
    const woke = await wakeBackend(onStatus);
    if (!woke) {
      throw new Error(
        'Backend took too long to wake up. Please try again in 30 seconds.'
      );
    }
  }

  onStatus?.('📸 Uploading image...');

  const sendAnalyze = async () =>
    fetchWithTimeout(
      `${BACKEND_URL}/analyze`,
      {
        method:  'POST',
        body:    buildFormData(imageUri, budget, style, token, userPrompt),
        headers: { Accept: 'application/json' },
      },
      200000
    );

  let response;
  try {
    response = await sendAnalyze();
  } catch (e) {
    if (e.name === 'AbortError')
      throw new Error('Request timed out. Please try again.');
    throw new Error(`Network error: ${e.message}`);
  }

  let data;
  try {
    data = await safeParseJSON(response);
  } catch (e) {
    if (e.message.startsWith('non_json_response')) {
      onStatus?.('⏳ Backend loading, retrying in 15s...');
      await new Promise((r) => setTimeout(r, 15000));
      try {
        const retry = await sendAnalyze();
        data        = await safeParseJSON(retry);
        response    = retry;
      } catch {
        throw new Error(
          'Backend is still loading. Please wait 1 minute and try again.'
        );
      }
    } else {
      throw e;
    }
  }

  if (response.status === 503 && data?.error === 'warming_up') {
    onStatus?.('⏳ Model warming up, retrying in 15s...');
    await new Promise((r) => setTimeout(r, 15000));
    try {
      const retry = await sendAnalyze();
      data        = await safeParseJSON(retry);
      response    = retry;
    } catch {
      throw new Error('Backend still warming up. Please try again in 30 seconds.');
    }
  }

  if (response.status === 401)
    throw new Error('401:Session expired. Please login again.');

  if (data?.error === 'outdoor_scene' || data?.is_outdoor === true)
    throw new Error('outdoor_scene');

  if (data?.error && response.status >= 400)
    throw new Error(data.error);

  return data;
};

// ─────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────
export const loginUser = async (email, password) => {
  const fd = new FormData();
  fd.append('email',    email.trim().toLowerCase());
  fd.append('password', password);

  const res = await fetchWithTimeout(
    `${BACKEND_URL}/auth/login`,
    { method: 'POST', body: fd, headers: { Accept: 'application/json' } },
    30000
  );

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json'))
    throw new Error('server_loading');
  return res.json();
};

export const registerUser = async (name, email, password) => {
  const fd = new FormData();
  fd.append('name',     name.trim());
  fd.append('email',    email.trim().toLowerCase());
  fd.append('password', password);

  const res = await fetchWithTimeout(
    `${BACKEND_URL}/auth/register`,
    { method: 'POST', body: fd, headers: { Accept: 'application/json' } },
    30000
  );

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json'))
    throw new Error('server_loading');
  return res.json();
};

export const googleAuth = async (name, email, googleUid) => {
  const fd = new FormData();
  fd.append('name',       name);
  fd.append('email',      email);
  fd.append('google_uid', googleUid);

  const res = await fetchWithTimeout(
    `${BACKEND_URL}/auth/google`,
    { method: 'POST', body: fd, headers: { Accept: 'application/json' } },
    30000
  );
  return res.json();
};