/*
 * Snipe Timer DE
 * Based on the snipe tool by Ricardo/Bottenkraker – reworked to calculate entirely in SERVER TIME.
 * The time zone of the player's PC does not matter: everything entered and shown is game time.
 *
 * What it does (display only):
 *   - countdown bar on the attack/support confirmation page, synced to the optimal click moment
 *   - optional countdown beeps (Web Audio, no external files)
 *   - lists the commands already heading to the target village (one request on start)
 * What it does NOT do:
 *   - it never sends, clicks or focuses the send button – the player always sends manually
 *
 * Optional user data (TribalWars.scriptData, JSON):
 *   { "timeColor": "green", "waitingColor": "#ff9933", "noDateColor": "green", "barWidth": 600 }
 * Latency, beep and target time are set in the in-game panel and stored in localStorage.
 */
(function () {
    'use strict';

    if (window.SnipeDE && window.SnipeDE.loaded) {
        window.SnipeDE.tryStart();
        return;
    }

    /* ------------------------------------------------------------------ */
    /* Settings (user data)                                                */
    /* ------------------------------------------------------------------ */
    let UD = {};
    try {
        const sd = window.TribalWars && TribalWars.scriptData;
        UD = (typeof sd === 'string' ? JSON.parse(sd) : sd) || {};
    } catch (e) { UD = {}; }
    const isColor = v => typeof v === 'string' && /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\))$/i.test(v.trim());
    const CFG = {
        timeColor: isColor(UD.timeColor) ? UD.timeColor : 'green',
        waitingColor: isColor(UD.waitingColor) ? UD.waitingColor : '#ff9933',
        noDateColor: isColor(UD.noDateColor) ? UD.noDateColor : 'green',
        lateColor: '#c0392b',
        barWidth: Number.isFinite(+UD.barWidth) && +UD.barWidth >= 300 ? +UD.barWidth : false,
    };

    /* ------------------------------------------------------------------ */
    /* Language: German on German-speaking markets, English otherwise      */
    /* ------------------------------------------------------------------ */
    const LANG = (window.game_data && /^de/i.test(game_data.locale || game_data.market || '')) ? 'de' : 'en';
    const TXT = {
        de: {
            wd: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
            late: 'zu spät', tooLate: 'Zu spät!', sendIn: 'Abschicken in ',
            arrival: 'Ankunft (Serverzeit):', ph: '20:15:30:123  ·  morgen 20:15:30:123  ·  24.09. 20:15:30:123',
            clear: 'Zielzeit löschen', sound: 'Ton:', on: 'an', before: 's vorher', test: '▶ Test', testT: 'Ton testen',
            lat: 'Klick-Laufzeit (ms):', latHint: 'rote Linie (Balkenmitte) = optimaler Klickzeitpunkt',
            send: 'Abschicken:', noDur: 'Laufzeit nicht gefunden', local: 'bei dir', clockSuffix: ' Uhr', arr: 'Ankunft',
            bad: '?? Format z.B. 20:15:30:123', mark: 'Optimaler Klickzeitpunkt',
            last: 'Letzter Versand: Klick bei', toSend: 'ms zum Abschickzeitpunkt', toLine: 'ms zur roten Linie',
            cmds: 'Befehle zum Ziel', cmdsHint: '(Zeile anklicken = Ankunft übernehmen)', cmdCol: 'Abschicken in',
            wm: 'Basis: Ricardo/Bottenkraker · Serverzeit-Umbau',
            dur: /^\s*(Dauer|Duration)/i, today: /heute|today/, tomorrow: /morgen|tomorrow/, dayAfter: /übermorgen|uebermorgen/,
        },
        en: {
            wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            late: 'too late', tooLate: 'Too late!', sendIn: 'Send in ',
            arrival: 'Arrival (server time):', ph: '20:15:30:123  ·  tomorrow 20:15:30:123  ·  24.09. 20:15:30:123',
            clear: 'Clear target time', sound: 'Beep:', on: 'on', before: 's before', test: '▶ Test', testT: 'Test sound',
            lat: 'Click latency (ms):', latHint: 'red line (bar centre) = optimal click moment',
            send: 'Send at:', noDur: 'Travel time not found', local: 'your time', clockSuffix: '', arr: 'arrival',
            bad: '?? format e.g. 20:15:30:123', mark: 'Optimal click moment',
            last: 'Last send: click at', toSend: 'ms to send moment', toLine: 'ms to red line',
            cmds: 'Commands to target', cmdsHint: '(click a row = use its arrival)', cmdCol: 'Send in',
            wm: 'Based on Ricardo/Bottenkraker · server-time rework',
            dur: /^\s*(Duration|Dauer)/i, today: /today|heute/, tomorrow: /tomorrow|morgen/, dayAfter: /day after tomorrow|übermorgen/,
        },
    };
    const T = TXT[LANG];

    const DAY = 86400000;
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const mod = (a, b) => ((a % b) + b) % b;

    /* ------------------------------------------------------------------ */
    /* Server clock (uses the game's own clock, no extra requests)         */
    /* ------------------------------------------------------------------ */
    const Clock = {
        offset: 0, // ms: server wall clock minus UTC
        now() {
            return (window.Timing && typeof Timing.getCurrentServerTime === 'function')
                ? Timing.getCurrentServerTime()
                : Date.now();
        },

        init() {
            try {
                const t = $('#serverTime').text().match(/(\d+):(\d+):(\d+)/);
                const d = $('#serverDate').text().match(/(\d+)\/(\d+)\/(\d+)/);
                if (t && d) {
                    const wall = Date.UTC(+d[3], +d[2] - 1, +d[1], +t[1], +t[2], +t[3]);
                    // round to 15 min – removes the display's second offset
                    this.offset = Math.round((wall - this.now()) / 900000) * 900000;
                    return;
                }
            } catch (e) { /* fallback below */ }
            this.offset = (typeof window.server_utc_diff === 'number') ? window.server_utc_diff * 1000 : 0;
        },

        parts(epoch) {
            const x = new Date(epoch + this.offset);
            return {
                y: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate(),
                h: x.getUTCHours(), mi: x.getUTCMinutes(), s: x.getUTCSeconds(),
                ms: x.getUTCMilliseconds(), wd: x.getUTCDay(),
            };
        },

        fromParts(y, mo, d, h, mi, s, ms) {
            return Date.UTC(y, mo - 1, d, h, mi, s, ms) - this.offset;
        },

        fmtTime(epoch, withMs = true) {
            const p = this.parts(epoch);
            return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}` + (withMs ? `:${pad(p.ms, 3)}` : '');
        },

        fmtFull(epoch) {
            const p = this.parts(epoch);
            return `${T.wd[p.wd]} ${pad(p.d)}.${pad(p.mo)}. ${this.fmtTime(epoch)}`;
        },

        /* Input (server time) -> epoch ms. Accepts e.g.:
         *   20:15:30   20:15:30:123   20:15:30.5 (=500 ms)
         *   today/heute 20:15:30:123   tomorrow/morgen 20:15:30:123
         *   24.09. 20:15:30:123   24/09/2026 20:15:30
         * Without a date: today, or tomorrow if the time has already passed. */
        parse(input, nowEp = this.now()) {
            const s = String(input || '').toLowerCase().trim();
            if (!s) return null;

            const tm = s.match(/(\d{1,2}):(\d{2}):(\d{2})(?:([:.,])(\d{1,3}))?/);
            if (!tm) return null;
            const h = +tm[1], mi = +tm[2], se = +tm[3];
            if (h > 23 || mi > 59 || se > 59) return null;
            let ms = 0;
            if (tm[5]) ms = tm[4] === ':' ? +tm[5] : +tm[5].padEnd(3, '0');

            const rest = s.replace(tm[0], ' ');
            const now = this.parts(nowEp);
            let y = now.y, mo = now.mo, d = now.d;
            let explicitDay = false, explicitYear = false;

            const dm = rest.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
            if (dm) {
                d = +dm[1]; mo = +dm[2];
                if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
                if (dm[3]) { y = dm[3].length === 2 ? 2000 + +dm[3] : +dm[3]; explicitYear = true; }
                explicitDay = true;
            } else if (TXT.de.dayAfter.test(rest) || TXT.en.dayAfter.test(rest)) {
                d += 2; explicitDay = true;
            } else if (TXT.de.tomorrow.test(rest)) {
                d += 1; explicitDay = true;
            } else if (TXT.de.today.test(rest)) {
                explicitDay = true;
            }

            let ep = this.fromParts(y, mo, d, h, mi, se, ms);
            if (!explicitDay && ep < nowEp - 1000) ep += DAY;
            if (dm && !explicitYear && ep < nowEp - 180 * DAY) ep = this.fromParts(y + 1, mo, d, h, mi, se, ms);
            return ep;
        },
    };

    /* ------------------------------------------------------------------ */
    /* Storage (localStorage only, no cookies)                             */
    /* ------------------------------------------------------------------ */
    const Store = {
        key() { return (window.game_data ? game_data.world : 'tw') + '_snipeDE'; },
        load() {
            try { return JSON.parse(localStorage.getItem(this.key())) || {}; } catch (e) { return {}; }
        },
        save(obj) {
            try { localStorage.setItem(this.key(), JSON.stringify(obj)); } catch (e) { /* ignore */ }
        },
    };

    /* ------------------------------------------------------------------ */
    /* Page helpers                                                        */
    /* ------------------------------------------------------------------ */
    function getDuration() {
        const dur = $('#date_arrival [data-duration]').first().data('duration');
        if (dur) return dur * 1000;
        let ms = null;
        $('#command-data-form td').each(function () {
            if (ms === null && T.dur.test($(this).text())) {
                const m = $(this).next().text().match(/(\d+):(\d{2}):(\d{2})/);
                if (m) ms = ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000;
            }
        });
        return ms;
    }

    function fmtCountdown(ms) {
        if (ms <= 0) return T.late;
        const t = Math.floor(ms / 1000);
        return `${Math.floor(t / 3600)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
    }

    function fmtLocal(epoch) {
        return new Date(epoch).toLocaleTimeString(LANG === 'de' ? 'de-DE' : undefined,
            { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /* Countdown beeps, scheduled on the AudioContext clock:
     *   every full second before the optimal click: short beep 880 Hz
     *   1 s before: long high beep 1320 Hz
     *   optimal click (red line): very high click 1760 Hz                      */
    const Sound = {
        ctx: null,
        nodes: [],
        vol: 0.5,

        get() {
            if (!this.ctx) {
                try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        },

        beep(at, freq, dur) {
            const c = this.ctx;
            const o = c.createOscillator(), g = c.createGain();
            o.type = 'square';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(this.vol, at + 0.004);
            g.gain.setValueAtTime(this.vol, at + dur - 0.01);
            g.gain.linearRampToValueAtTime(0, at + dur);
            o.connect(g);
            g.connect(c.destination);
            o.start(at);
            o.stop(at + dur + 0.02);
            this.nodes.push(o);
            o.onended = () => { this.nodes = this.nodes.filter(n => n !== o); };
        },

        cancel() {
            this.nodes.forEach(o => { try { o.stop(); } catch (e) { /* already done */ } });
            this.nodes = [];
        },

        schedule(clickEpoch, secs) {
            const c = this.get();
            if (!c) return;
            this.cancel();
            const base = c.currentTime, now = Clock.now();
            for (let k = secs; k >= 0; k--) {
                const t = (clickEpoch - k * 1000 - now) / 1000;
                if (t < 0) continue;
                if (k === 0) this.beep(base + t, 1760, 0.08);
                else if (k === 1) this.beep(base + t, 1320, 0.25);
                else this.beep(base + t, 880, 0.12);
            }
        },

        test() {
            const c = this.get();
            if (!c) return;
            this.cancel();
            const b = c.currentTime + 0.05;
            this.beep(b, 880, 0.12);
            this.beep(b + 1, 880, 0.12);
            this.beep(b + 2, 1320, 0.25);
            this.beep(b + 3, 1760, 0.08);
        },
    };

    function addStyle() {
        if (document.getElementById('snp-style')) return;
        const css = `
#snp-box{margin-top:6px;font-size:12px}
#snp-bar{position:relative;width:100%;height:22px;background:#888;border:1px solid #603000}
#snp-fill{position:absolute;left:0;top:0;height:100%;width:0}
#snp-clock{position:absolute;inset:0;text-align:center;line-height:22px;font-weight:bold;color:#fff;text-shadow:0 0 2px #000}
#snp-box table{width:100%;margin-top:4px}
#snp-box td{padding:2px 4px;vertical-align:middle}
#snp-box td.snp-l{white-space:nowrap;width:1%}
#snp-target{width:230px}
#snp-lat,#snp-alarm-s{width:60px}
#snp-mark{position:absolute;top:-3px;bottom:-3px;width:3px;margin-left:-1px;background:#e00;box-shadow:0 0 2px #fff;display:none;z-index:2}
#snp-ok{margin-left:6px}
#snp-ok.bad{color:#c0392b}
#snp-send b{font-size:13px}
.snp-sub{color:#666;font-size:11px}
#snp-last{color:#666;font-size:11px;margin-top:2px}
#snp-cmds{margin-bottom:6px}
#snp-cmds tr.command-row{cursor:pointer}
#snp-cmds tr.command-row.snp-sel td{background:#fff !important}
.snp-cd{font-weight:bold;color:darkblue;white-space:nowrap}
#snp-wm{font-size:8px;color:#999;text-align:right}`;
        $('<style id="snp-style">').text(css).appendTo('head');
    }

    /* ------------------------------------------------------------------ */
    /* Main                                                                */
    /* ------------------------------------------------------------------ */
    function start() {
        Clock.init();
        addStyle();

        const duration = getDuration();
        const saved = Store.load();
        const state = {
            target: null,                          // desired arrival (epoch ms)
            alarm: saved.alarm !== false,
            alarmSec: Number.isFinite(saved.alarmSec) ? saved.alarmSec : 5,
            lat: Number.isFinite(saved.lat) ? saved.lat : 0,     // ms from click until the server has the command (calibrate)
            alarmDone: false,
            sendEpoch: null,
        };
        if (Number.isFinite(saved.target) && saved.target > Clock.now()) state.target = saved.target;
        const cmdRows = [];

        const $box = $(`
<div id="snp-box">
  <div id="snp-cmds"></div>
  <div id="snp-bar"><div id="snp-fill"></div><div id="snp-mark" title="${T.mark}"></div><div id="snp-clock"></div></div>
  <table>
    <tr><td class="snp-l">${T.arrival}</td>
        <td><input id="snp-target" type="text" autocomplete="off" placeholder="${T.ph}">
            <a href="#" id="snp-clear" title="${T.clear}">✕</a><span id="snp-ok"></span></td></tr>
    <tr><td class="snp-l">${T.sound}</td>
        <td><label><input id="snp-alarm" type="checkbox"> ${T.on}</label>
            <input id="snp-alarm-s" type="number" min="1" step="1"> ${T.before}
            <a href="#" id="snp-test" title="${T.testT}">${T.test}</a></td></tr>
    <tr><td class="snp-l">${T.lat}</td>
        <td><input id="snp-lat" type="number" step="1" min="0">
            <span class="snp-sub">${T.latHint}</span></td></tr>
    <tr><td class="snp-l">${T.send}</td><td id="snp-send">–</td></tr>
  </table>
  <div id="snp-last"></div>
  <div id="snp-wm">${T.wm}</div>
</div>`);
        $('#date_arrival').append($box);

        if (CFG.barWidth) $('#command-data-form .vis:first, #date_arrival').width(CFG.barWidth);

        const $target = $('#snp-target'), $ok = $('#snp-ok'), $send = $('#snp-send');
        $('#snp-lat').val(state.lat);
        $('#snp-alarm').prop('checked', state.alarm);
        $('#snp-alarm-s').val(state.alarmSec);

        if (saved.last) {
            const l = saved.last;
            const sg = v => (v >= 0 ? '+' : '') + v;
            $('#snp-last').text(`${T.last} :${pad(l.ms, 3)}` +
                (Number.isFinite(l.diff) ? ` (${sg(l.diff)} ${T.toSend}` +
                    (Number.isFinite(l.lat) ? `, ${sg(l.diff + l.lat)} ${T.toLine}` : '') + ')' : ''));
        }

        const persist = () => {
            const cur = Store.load();
            Store.save(Object.assign(cur, {
                target: state.target, alarm: state.alarm, alarmSec: state.alarmSec, lat: state.lat,
            }));
        };

        const recompute = () => {
            state.alarmDone = false;
            Sound.cancel();
            if (state.target === null || !duration) {
                state.sendEpoch = null;
                $send.html(duration ? '–' : `<span class="snp-sub">${T.noDur}</span>`);
            } else {
                state.sendEpoch = state.target - duration;
                $send.html(`<b>${Clock.fmtFull(state.sendEpoch)}</b>
                    &nbsp;<span id="snp-send-cd" class="snp-cd"></span>
                    <br><span class="snp-sub">${T.local}: ${fmtLocal(state.sendEpoch)}${T.clockSuffix} · ${T.arr} ${Clock.fmtFull(state.target)}</span>`);
            }
            updateCmdRows();
            updateMark();
            persist();
        };

        /* Red line: click moment at which the command arrives exactly at the target time
         *   optimal click = send moment - click latency
         * The bar is synced to this click moment: it runs 0 -> 100 % every second and is
         * at exactly 50 % at the optimal click -> the red line is always in the centre. */
        const clickEpoch = () => state.sendEpoch === null ? null : state.sendEpoch - (Number.isFinite(state.lat) ? state.lat : 0);
        function updateMark() {
            const m = document.getElementById('snp-mark');
            if (!m) return;
            m.style.left = '50%';
            m.style.display = state.sendEpoch === null ? 'none' : 'block';
        }

        const setTarget = (epoch, writeInput) => {
            state.target = epoch;
            if (writeInput) $target.val(epoch === null ? '' : Clock.fmtFull(epoch));
            $ok.removeClass('bad').text(epoch === null ? '' : '✓ ' + Clock.fmtFull(epoch));
            recompute();
        };

        $target.on('input change', () => {
            const v = $target.val();
            if (!v.trim()) { setTarget(null, false); return; }
            const ep = Clock.parse(v);
            if (ep === null) { $ok.addClass('bad').text(T.bad); return; }
            setTarget(ep, false);
        });
        $('#snp-clear').on('click', (e) => { e.preventDefault(); setTarget(null, true); });
        $('#snp-alarm').on('change', function () {
            state.alarm = this.checked;
            state.alarmDone = false;
            if (!state.alarm) Sound.cancel();
            persist();
        });
        $('#snp-lat').on('input', function () {
            const v = parseInt(this.value, 10);
            state.lat = Number.isFinite(v) && v >= 0 ? v : 0;
            recompute();
        });
        $('#snp-test').on('click', (e) => { e.preventDefault(); Sound.test(); });
        // browsers only allow sound after a user action -> unlock on first click/key in the panel
        $box.on('pointerdown keydown', () => Sound.get());
        $('#snp-alarm-s').on('input', function () {
            const v = parseInt(this.value, 10);
            state.alarmSec = Number.isFinite(v) && v > 0 ? v : 5;
            state.alarmDone = false;
            persist();
        });
        // Enter inside the panel's fields must not submit the command form
        $box.on('keydown', 'input', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); }
        });

        // hand-over via link (?arrivalTimestamp=... in the referrer, as in the original)
        let fromRef = null;
        try {
            const p = new URL(document.referrer).searchParams.get('arrivalTimestamp');
            if (p && /^\d+$/.test(p)) fromRef = parseInt(p, 10);
        } catch (e) { /* no referrer */ }

        if (fromRef) setTarget(fromRef, true);
        else if (state.target !== null) setTarget(state.target, true);
        else recompute();

        /* ---------- commands heading to the target (one request on start) ---------- */
        function updateCmdRows() {
            cmdRows.forEach(r => { r.sendAt = duration ? r.arrival - duration : null; });
        }

        function loadCommands() {
            const a = $('#command-data-form .village_anchor a').first().attr('href');
            const id = a && (a.match(/[?&]id=(\d+)/) || [])[1];
            if (!id || !window.game_data) return;
            $.get(game_data.link_base_pure + 'info_village&id=' + id).done(function (html) {
                const $tbl = $(html).find('.commands-container').first();
                if (!$tbl.length || !$tbl.find('tr.command-row').length) return;
                $tbl.find('tr:first').append(`<th>${T.cmdCol}</th>`);
                $tbl.find('tr.command-row').each(function () {
                    const $r = $(this);
                    const end = parseInt($r.find('[data-endtime]').last().data('endtime'), 10);
                    if (!end) return;
                    const msM = $r.text().match(/\d{1,2}:\d{2}:\d{2}:(\d{3})/);
                    const arrival = end * 1000 + (msM ? +msM[1] : 0);
                    const $cd = $('<td class="snp-cd"></td>');
                    $r.append($cd);
                    $r.find('[data-endtime]').removeClass('timer widget-command-timer'); // avoid double game timer
                    const row = { $r, $cd, $end: $r.find('[data-endtime]').last(), end: end * 1000, arrival, sendAt: null };
                    cmdRows.push(row);
                    $r.on('click', () => {
                        $('#snp-cmds tr.command-row').removeClass('snp-sel');
                        $r.addClass('snp-sel');
                        setTarget(arrival, true);
                    });
                });
                updateCmdRows();
                $('#snp-cmds').append(`<div><b>${T.cmds}</b> <span class="snp-sub">${T.cmdsHint}</span></div>`).append($tbl);
            });
        }
        loadCommands();

        /* ---------- loops (display only) ---------- */
        const origTitle = document.title;
        const fill = document.getElementById('snp-fill');
        const clock = document.getElementById('snp-clock');
        let rafId = null, tickId = null, stopped = false;

        function alive() {
            if (stopped) return false;
            if (!document.body.contains($box[0])) { stop(); return false; }
            return true;
        }

        function stop(keepTitle) {
            stopped = true;
            if (!keepTitle) Sound.cancel();
            if (rafId) cancelAnimationFrame(rafId);
            if (tickId) clearInterval(tickId);
            if (!keepTitle) document.title = origTitle;
        }

        function frame() {
            if (!alive()) return;
            const now = Clock.now();
            clock.textContent = Clock.fmtTime(now);
            if (state.sendEpoch === null) {
                fill.style.width = (mod(now, 1000) / 10) + '%';
                fill.style.background = CFG.noDateColor;
            } else {
                const ce = clickEpoch();
                const diff = ce - now;   // ms until the optimal click
                fill.style.width = (mod(now - ce + 500, 1000) / 10) + '%';
                // green: the second around the optimal click, red: after it, orange: before it
                fill.style.background = (diff > -500 && diff <= 500) ? CFG.timeColor
                    : (diff <= -500 && diff > -1500) ? CFG.lateColor : CFG.waitingColor;
            }
            rafId = requestAnimationFrame(frame);
        }

        function tick() {
            if (!alive()) return;
            const now = Clock.now();
            if (state.sendEpoch !== null) {
                const left = state.sendEpoch - now;
                const cd = fmtCountdown(left);
                $('#snp-send-cd').text('(' + cd + ')').css('color', left > 0 ? 'darkblue' : CFG.lateColor);
                document.title = left > 0 ? T.sendIn + cd : T.tooLate;
                const toClick = clickEpoch() - now;   // beeps count down to the optimal click (red line)
                if (state.alarm && !state.alarmDone && toClick > 0 && toClick <= state.alarmSec * 1000 + 500) {
                    state.alarmDone = true;
                    Sound.schedule(clickEpoch(), state.alarmSec);
                }
            } else {
                document.title = origTitle;
            }
            cmdRows.forEach(r => {
                r.$cd.text(r.sendAt === null ? '–' : fmtCountdown(r.sendAt - now))
                    .css('color', r.sendAt !== null && r.sendAt - now > 0 ? 'darkblue' : CFG.lateColor);
                r.$end.text(fmtCountdown(r.end - now));
            });
        }

        frame();
        tick();
        tickId = setInterval(tick, 100);

        /* ---------- after the player clicks send: log the click (read-only listener) ---------- */
        $('#troop_confirm_submit').on('click', function () {
            const now = Clock.now();
            const last = { ms: Clock.parts(now).ms, diff: state.sendEpoch !== null ? Math.round(now - state.sendEpoch) : null, lat: state.lat };
            const cur = Store.load();
            cur.last = last;
            Store.save(cur);
            stop(true);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Start: rally point confirm page, or the map's command popup         */
    /* ------------------------------------------------------------------ */
    function tryStart() {
        if (document.getElementById('date_arrival') && !document.getElementById('snp-box')) {
            try { start(); } catch (e) { console.error('[Snipe Timer]', e); }
        }
    }

    window.SnipeDE = { loaded: true, tryStart, Clock };

    tryStart();
    let pending = false;
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        setTimeout(() => { pending = false; tryStart(); }, 50);
    }).observe(document.body, { childList: true, subtree: true });
})();
