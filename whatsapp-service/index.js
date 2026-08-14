/**
 * NetOne Lead Automation — WhatsApp Channel Adapter (Baileys)
 * -----------------------------------------------------------
 * This is the LIVE DEMO CHANNEL. It is intentionally thin: its only job is to
 * maintain a persistent WhatsApp connection and forward each inbound message to
 * the backend as a *channel-neutral* payload. All lead logic, AI, CRM sync and
 * dashboard concerns live in the backend — this service knows nothing about them.
 *
 * Connection/session/reconnect logic is adapted from a proven Baileys bridge.
 * Session credentials persist in SESSION_DIR (mounted as a Docker volume) so the
 * link survives restarts. NEVER commit that directory.
 */
const express = require('express');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const logger = pino({ level: 'info' });
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4703;
const BACKEND_WEBHOOK_URL = process.env.BACKEND_WEBHOOK_URL || 'http://backend:4702/api/channels/whatsapp/webhook';
const WEBHOOK_SHARED_SECRET = process.env.WEBHOOK_SHARED_SECRET || '';
const SESSION_DIR = process.env.SESSION_DIR || path.join(__dirname, 'session');

let sock = null;
let currentQr = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
let retryCount = 0;
let lastConnectedAt = null;
// Pairing-code (link-with-phone-number) state. When pairingPhone is set we ask
// Baileys for an 8-char code instead of showing a QR.
let pairingPhone = null;
let currentPairingCode = null;
let pairingCodeRequested = false; // guards against re-requesting on every qr rotation
let pairingLastError = null;
let pairingConnectStartedAt = null;

if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

/** Recursively extract a text payload from Baileys' nested message shapes. */
function extractText(m) {
    if (!m) return null;
    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.documentMessage?.caption ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.templateButtonReplyMessage?.selectedId ||
        extractText(m.ephemeralMessage?.message) ||
        extractText(m.viewOnceMessage?.message) ||
        extractText(m.viewOnceMessageV2?.message) ||
        extractText(m.documentWithCaptionMessage?.message) ||
        null
    );
}

/** Normalize a WhatsApp JID to an E.164-ish phone string, e.g. 26097... -> +26097... */
function jidToPhone(jid) {
    const digits = String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
    return digits ? `+${digits}` : '';
}

async function forwardToBackend(payload) {
    const headers = { 'Content-Type': 'application/json' };
    if (WEBHOOK_SHARED_SECRET) headers['x-webhook-secret'] = WEBHOOK_SHARED_SECRET;
    await axios.post(BACKEND_WEBHOOK_URL, payload, { headers, timeout: 15000 });
}

/**
 * Ask Baileys for a link-with-phone-number pairing code (formatted XXXX-XXXX).
 *
 * IMPORTANT — timing: `requestPairingCode` must only be called once the socket
 * has reached the point where Baileys would otherwise show a QR code (i.e.
 * from inside the `qr` event of `connection.update`). Calling it on an
 * arbitrary timer is a real bug: if fired before the connection has finished
 * its handshake with WhatsApp's servers, the registration frame is written to
 * a socket WhatsApp doesn't yet fully trust and gets silently dropped — no
 * error, no phone notification, nothing. This matches Baileys' own official
 * reference implementation (Example/example.ts), which requests the pairing
 * code from inside that same `if (qr)` branch.
 *
 * `requestPairingCode` also has no server acknowledgement to wait on — Baileys
 * sends it as a fire-and-forget node (see Socket/socket.js: `sendNode`, not
 * `query`), so a resolved promise only proves *we* generated a code and wrote
 * it to the wire, never that WhatsApp actually received/accepted it. Retrying
 * (both immediately on failure, and again on Baileys' natural ~20s QR
 * rotation if the phone never confirms) is the only real mitigation.
 */
async function requestPairingCodeWithRetry(phone, maxAttempts = 3) {
    const digits = String(phone).replace(/\D/g, '').replace(/^0+/, '');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            if (!sock) throw new Error('socket not ready');
            logger.info(`Requesting pairing code for ${digits} (attempt ${attempt}/${maxAttempts})...`);
            const raw = await sock.requestPairingCode(digits);
            const clean = String(raw).replace(/[^A-Za-z0-9]/g, '');
            currentPairingCode = clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
            pairingLastError = null;
            connectionStatus = 'connecting';
            logger.info(`Pairing code generated for ${digits}: ${currentPairingCode}. Waiting for phone confirmation...`);
            return currentPairingCode;
        } catch (err) {
            logger.error(`requestPairingCode failed (attempt ${attempt}/${maxAttempts}): ${err.message}`);
            pairingLastError = err.message;
            if (attempt === maxAttempts) {
                // Let the next `qr` rotation (Baileys re-emits it periodically
                // while unpaired) trigger a fresh attempt automatically.
                pairingCodeRequested = false;
                throw err;
            }
            await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
    }
}

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        connectionStatus = 'connecting';

        // fetchLatestBaileysVersion() never throws — on network failure it
        // already falls back internally to the library's own current bundled
        // default (kept up to date by Baileys' maintainers on every release),
        // which is strictly more reliable than any version we'd hardcode here
        // ourselves (that value silently goes stale over time and a mismatched
        // client version is a documented way for WhatsApp to reject a
        // connection outright).
        const { version, isLatest } = await fetchLatestBaileysVersion();
        logger.info(`Using Baileys/WA version ${version.join('.')} (${isLatest ? 'fetched live' : 'library default — live fetch failed'})`);

        const wantsPairingCode = pairingPhone && !state.creds.registered;
        pairingCodeRequested = false;
        pairingLastError = null;
        if (wantsPairingCode) pairingConnectStartedAt = Date.now();

        sock = makeWASocket({
            version,
            auth: state,
            // printQRInTerminal is deprecated in recent Baileys — we render our
            // own QR from the `qr` event instead (see /qr and the `qr` handler).
            // A well-known, widely-used browser tuple. Using Browsers.ubuntu(...)
            // instead of a fully custom name removes any risk of WhatsApp's
            // platform/device-display validation rejecting a nonstandard tuple.
            browser: Browsers.ubuntu('Chrome'),
            logger: pino({ level: 'silent' }),
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                if (pairingPhone && !sock.authState.creds.registered) {
                    // This `qr` event is Baileys' actual readiness signal — the
                    // connection has completed its handshake and is ready to
                    // register either a QR scan or a pairing code. Requesting
                    // the code here (not on a blind timer) is the fix for
                    // "pairing code generated but phone never notified": firing
                    // too early sends the registration frame on a socket
                    // WhatsApp doesn't yet trust, and it's silently dropped.
                    if (!pairingCodeRequested) {
                        pairingCodeRequested = true;
                        requestPairingCodeWithRetry(pairingPhone).catch(() => {
                            /* logged inside; pairingCodeRequested was reset so
                               the next qr rotation retries automatically */
                        });
                    }
                } else if (!pairingPhone) {
                    currentQr = qr;
                    connectionStatus = 'connecting';
                    logger.info('New QR code received — scan to link device.');
                }
            }

            if (connection === 'open') {
                connectionStatus = 'connected';
                currentQr = null;
                pairingPhone = null;
                currentPairingCode = null;
                pairingCodeRequested = false;
                pairingLastError = null;
                pairingConnectStartedAt = null;
                retryCount = 0;
                lastConnectedAt = new Date().toISOString();
                logger.info('WhatsApp connection open.');
            }

            if (connection === 'close') {
                currentQr = null;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                connectionStatus = 'disconnected';
                logger.warn(`Connection closed. statusCode=${statusCode} reconnect=${shouldReconnect}`);

                if (shouldReconnect) {
                    if (statusCode === 408 || statusCode === DisconnectReason.timedOut || !sock?.user) {
                        retryCount = 0; // fresh QR without penalty
                    } else {
                        retryCount++;
                    }
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    logger.info(`Reconnecting in ${delay / 1000}s...`);
                    setTimeout(connectToWhatsApp, delay);
                } else {
                    logger.error('Logged out. Clearing session and restarting scanner...');
                    try {
                        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                        fs.mkdirSync(SESSION_DIR, { recursive: true });
                    } catch (err) {
                        logger.error(`Error clearing session dir: ${err.message}`);
                    }
                    retryCount = 0;
                    setTimeout(connectToWhatsApp, 1000);
                }
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') return;

            for (const msg of m.messages) {
                if (msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid || '';
                // Only handle 1:1 chats for the demo; skip groups/status broadcasts.
                if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue;

                const text = extractText(msg.message);
                if (!text || typeof text !== 'string' || text.trim() === '') {
                    logger.warn(`Message from [${remoteJid}] had no extractable text.`);
                    continue;
                }

                // Channel-neutral payload. The backend's WhatsApp adapter maps this
                // into its internal NormalizedLeadEvent — the same shape a future
                // Meta/Instagram/TikTok adapter would produce.
                const payload = {
                    channel: 'whatsapp',
                    externalMessageId: msg.key.id,
                    externalContactId: jidToPhone(remoteJid),
                    phone: jidToPhone(remoteJid),
                    name: msg.pushName || null,
                    message: text.trim(),
                    timestamp: msg.messageTimestamp
                        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                        : new Date().toISOString(),
                    metadata: { remoteJid },
                };

                logger.info(`Inbound from [${payload.phone}] (${payload.name || 'unknown'}): "${text.trim()}"`);
                try {
                    await forwardToBackend(payload);
                } catch (error) {
                    logger.error(`Backend webhook error for [${payload.phone}]: ${error.message}`);
                }
            }
        });
    } catch (err) {
        logger.error(`Fatal socket error: ${err.message}`);
        setTimeout(connectToWhatsApp, 10000);
    }
}

// ── REST control surface ───────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'whatsapp', status: connectionStatus });
});

app.get('/status', (req, res) => {
    res.json({
        status: connectionStatus,
        hasQr: !!currentQr,
        pairingCode: currentPairingCode,
        pairingError: pairingLastError,
        pairingElapsedMs: pairingConnectStartedAt ? Date.now() - pairingConnectStartedAt : null,
        method: pairingPhone ? 'code' : 'qr',
        lastConnectedAt,
        user: sock?.user?.id || null,
    });
});

// Start a QR-based link: clears any session and shows a fresh QR.
app.post('/connect/qr', (req, res) => {
    startFresh({ clearSession: true, phone: null });
    res.json({ status: 'connecting', method: 'qr' });
});

// Start a link-with-code flow for a given phone number (E.164 or local digits).
app.post('/connect/code', (req, res) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    if (phone.length < 7) return res.status(400).json({ error: 'valid phone number required' });
    startFresh({ clearSession: true, phone });
    res.json({ status: 'connecting', method: 'code' });
});

// Backwards-compatible restart.
app.post('/restart', (req, res) => {
    startFresh({ clearSession: req.body?.force === true, phone: null });
    res.json({ status: 'restarting' });
});

// Tear down and reconnect, optionally wiping credentials / setting a pairing phone.
function startFresh({ clearSession, phone }) {
    currentQr = null;
    currentPairingCode = null;
    pairingCodeRequested = false;
    pairingLastError = null;
    pairingConnectStartedAt = null;
    pairingPhone = phone || null;
    connectionStatus = 'connecting';
    retryCount = 0;
    if (sock) { try { sock.ws.close(); } catch (e) {} sock = null; }
    if (clearSession && fs.existsSync(SESSION_DIR)) {
        logger.warn('Clearing session directory for fresh link.');
        try {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        } catch (err) {
            logger.error(`Error clearing session dir: ${err.message}`);
        }
    }
    setTimeout(connectToWhatsApp, 500);
}

// Outgoing message support (e.g. sales follow-up acknowledgement to the lead).
app.post('/send', async (req, res) => {
    const recipient = String(req.body?.recipient || '').trim();
    const text = String(req.body?.text || '').trim();
    if (!recipient || !text) {
        return res.status(400).json({ success: false, error: 'recipient and text are required' });
    }
    if (!sock || connectionStatus !== 'connected') {
        return res.status(503).json({ success: false, error: 'WhatsApp is not connected' });
    }
    try {
        const jid = recipient.includes('@') ? recipient : `${recipient.replace(/\D/g, '')}@s.whatsapp.net`;
        await sock.sendPresenceUpdate('composing', jid);
        await sock.sendMessage(jid, { text });
        await sock.sendPresenceUpdate('paused', jid);
        return res.json({ success: true });
    } catch (err) {
        return res.status(502).json({ success: false, error: err.message });
    }
});

// QR as a PNG (or a friendly status SVG) for the linking screen.
app.get('/qr', async (req, res) => {
    if (connectionStatus === 'connected') {
        res.type('image/svg+xml').send(statusSvg('LINKED', '#16a34a', 'WhatsApp bridge active'));
        return;
    }
    if (!currentQr) {
        res.type('image/svg+xml').send(statusSvg('INITIALIZING', '#2563eb', 'Preparing session...'));
        return;
    }
    try {
        res.setHeader('Content-Type', 'image/png');
        await qrcode.toFileStream(res, currentQr, { width: 300, margin: 2 });
    } catch (err) {
        res.status(500).send('Error generating QR code');
    }
});

function statusSvg(title, color, subtitle) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
        <rect width="100%" height="100%" fill="#ffffff" rx="12" stroke="#e5e7eb" stroke-width="2"/>
        <circle cx="150" cy="120" r="40" fill="${color}22"/>
        <circle cx="150" cy="120" r="28" fill="${color}"/>
        <text x="150" y="200" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="${color}" text-anchor="middle">${title}</text>
        <text x="150" y="228" font-family="system-ui,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">${subtitle}</text>
    </svg>`;
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => logger.info(`NetOne WhatsApp adapter listening on :${PORT}`));
