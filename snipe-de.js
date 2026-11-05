/*
 * Snipe-Timer DE
 * Umbau des Bottenkraker-Snipetools (Ricardo) – rechnet komplett in SERVERZEIT.
 * Die Zeitzone des eigenen PCs spielt keine Rolle mehr: alles, was man eingibt
 * und was angezeigt wird, ist die Zeit, die das Spiel anzeigt.
 *
 * Optionale Einstellungen vor dem Laden (wie beim Original):
 *   var timeColor = "green";      // Balken in der letzten Sekunde vor dem Abschicken
 *   var waitingColor = "#ff9933"; // Balken, solange noch Zeit ist
 *   var noDateColor = "green";    // Balken ohne Zielzeit
 *   var timeBarWidth = false;     // z.B. 600 für feste Breite
 *   var focusDelay = 5;           // s nach der letzten Eingabe -> Fokus auf "Abschicken"-Button (0 = aus)
 *
 * Fokus-Modus: Nach der letzten Eingabe im Snipe-Feld springt der Fokus nach
 * focusDelay Sekunden auf den Abschicken-Button (grün hinterlegt = Enter bereit).
 * Enter in den Snipe-Feldern schickt NICHT ab. Abschicken immer selbst (Enter/Klick).
 */
(function () {
    'use strict';

    if (window.SnipeDE && window.SnipeDE.loaded) {
        window.SnipeDE.tryStart();
        return;
    }

    const CFG = {
        timeColor: typeof timeColor !== 'undefined' ? timeColor : 'green',
        waitingColor: typeof waitingColor !== 'undefined' ? waitingColor : '#ff9933',
        noDateColor: typeof noDateColor !== 'undefined' ? noDateColor : 'green',
        lateColor: '#c0392b',
        barWidth: typeof timeBarWidth !== 'undefined' ? timeBarWidth : false,
        focusDelay: typeof focusDelay !== 'undefined' && Number.isFinite(+focusDelay) ? +focusDelay : 5,
        // Uhr-Sync über time_generated ist (noch) unzuverlässig -> standardmäßig aus
        clockSync: typeof clockSync !== 'undefined' ? !!clockSync : false,
    };

    const DAY = 86400000;
    const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    const mod = (a, b) => ((a % b) + b) % b;

    /* ------------------------------------------------------------------ */
    /* Serveruhr                                                           */
    /* ------------------------------------------------------------------ */
    const Clock = {
        offset: 0, // ms: Server-Wanduhr minus UTC (Deutschland: 3600000 / 7200000)
        corr: 0,   // ms: Feinkorrektur der Spieluhr aus dem Uhr-Sync
        rtt: null, // ms: kürzester gemessener Ping beim Sync
        synced: false,

        base() {
            return (window.Timing && typeof Timing.getCurrentServerTime === 'function')
                ? Timing.getCurrentServerTime()
                : Date.now();
        },

        now() { return this.base() + this.corr; },

        /* Die Spieluhr (Timing) startet mit der Serverzeit beim Erzeugen der Seite und liegt je nach
         * Ladezeit mehrere 100 ms daneben. Sync: ein paar kleine Anfragen, Server-Zeitstempel
         * (time_generated, ms) gegen die Mitte der Anfrage legen, kürzesten Ping nehmen. */
        async sync(samples = 3) {
            if (!window.game_data) return null;
            const url = location.pathname + '?village=' + game_data.village.id + '&screen=settings&mode=vacation&_partial';
            let best = null;
            for (let i = 0; i < samples; i++) {
                if (i) await new Promise(r => setTimeout(r, 400));
                try {
                    const a = this.base();
                    const txt = await (await fetch(url + '&_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })).text();
                    const b = this.base();
                    const m = txt.match(/"time_generated"\s*:\s*(\d+)/);
                    if (!m) continue;
                    const smp = { rtt: b - a, corr: (+m[1]) - (a + b) / 2 };
                    if (!best || smp.rtt < best.rtt) best = smp;
                } catch (e) { /* nächster Versuch */ }
            }
            if (best) { this.corr = Math.round(best.corr); this.rtt = Math.round(best.rtt); this.synced = true; }
            return best;
        },

        init() {
            try {
                const t = $('#serverTime').text().match(/(\d+):(\d+):(\d+)/);
                const d = $('#serverDate').text().match(/(\d+)\/(\d+)\/(\d+)/);
                if (t && d) {
                    const wall = Date.UTC(+d[3], +d[2] - 1, +d[1], +t[1], +t[2], +t[3]);
                    // auf 15 min runden – der Sekundenversatz der Anzeige fällt so weg
                    this.offset = Math.round((wall - this.now()) / 900000) * 900000;
                    return;
                }
            } catch (e) { /* Fallback unten */ }
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
            return `${WD[p.wd]} ${pad(p.d)}.${pad(p.mo)}. ${this.fmtTime(epoch)}`;
        },

        /* Eingabe (Serverzeit) -> Epoch-ms. Akzeptiert u.a.:
         *   20:15:30            20:15:30:123        20:15:30.5 (=500 ms)
         *   heute um 20:15:30:123     morgen 20:15:30:123
         *   24.09. 20:15:30:123       am 24.09.26 um 20:15:30:123
         *   Mi 24.09. 20:15:30:123    24/09/2026 20:15:30
         * Ohne Datum: heute, bzw. morgen falls die Uhrzeit schon vorbei ist. */
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
            } else if (/übermorgen|uebermorgen/.test(rest)) {
                d += 2; explicitDay = true;
            } else if (/morgen|tomorrow/.test(rest)) {
                d += 1; explicitDay = true;
            } else if (/heute|today|vandaag/.test(rest)) {
                explicitDay = true;
            }

            let ep = this.fromParts(y, mo, d, h, mi, se, ms);
            if (!explicitDay && ep < nowEp - 1000) ep += DAY;
            if (dm && !explicitYear && ep < nowEp - 180 * DAY) ep = this.fromParts(y + 1, mo, d, h, mi, se, ms);
            return ep;
        },
    };

    /* ------------------------------------------------------------------ */
    /* Speicher                                                            */
    /* ------------------------------------------------------------------ */
    const Store = {
        key() { return (window.game_data ? game_data.world : 'tw') + '_snipeDE'; },
        load() {
            try { return JSON.parse(localStorage.getItem(this.key())) || {}; } catch (e) { return {}; }
        },
        save(obj) {
            try { localStorage.setItem(this.key(), JSON.stringify(obj)); } catch (e) { /* egal */ }
        },
    };

    /* ------------------------------------------------------------------ */
    /* Hilfsfunktionen Spielseite                                          */
    /* ------------------------------------------------------------------ */
    function getDuration() {
        const dur = $('#date_arrival [data-duration]').first().data('duration');
        if (dur) return dur * 1000;
        let ms = null;
        $('#command-data-form td').each(function () {
            if (ms === null && /^\s*(Dauer|Duration|Duur)/i.test($(this).text())) {
                const m = $(this).next().text().match(/(\d+):(\d{2}):(\d{2})/);
                if (m) ms = ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) * 1000;
            }
        });
        return ms;
    }

    function fmtCountdown(ms) {
        if (ms <= 0) return 'zu spät';
        const t = Math.floor(ms / 1000);
        return `${Math.floor(t / 3600)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
    }

    function fmtLocal(epoch) {
        return new Date(epoch).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    /* Countdown-Piepser: harte Rechteck-Töne, zeitgenau über die AudioContext-Uhr geplant.
     *   jede volle Sekunde vor dem optimalen Klick (rote Linie): kurzer Piep 880 Hz
     *   1 s vorher: langer hoher Piep 1320 Hz
     *   optimaler Klick (rote Linie): sehr hoher Klick 1760 Hz                    */
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
            this.nodes.forEach(o => { try { o.stop(); } catch (e) { /* schon fertig */ } });
            this.nodes = [];
        },

        schedule(sendEpoch, secs) {
            const c = this.get();
            if (!c) return;
            this.cancel();
            const base = c.currentTime, now = Clock.now();
            for (let k = secs; k >= 0; k--) {
                const t = (sendEpoch - k * 1000 - now) / 1000;
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
#snp-delay,#snp-lat,#snp-alarm-s{width:60px}
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
#snp-wm{font-size:8px;color:#999;text-align:right}
#troop_confirm_submit.snp-armed{background:#1e8c3a !important;color:#fff !important;box-shadow:0 0 0 3px #2ecc71;outline:none}
#snp-focus{margin-left:8px;font-weight:bold;font-size:12px}
#snp-focus.on{color:#1e8c3a}
#snp-focus.off{color:#c0392b}`;
        $('<style id="snp-style">').text(css).appendTo('head');
    }

    /* ------------------------------------------------------------------ */
    /* Hauptteil                                                           */
    /* ------------------------------------------------------------------ */
    function start() {
        Clock.init();
        addStyle();

        const duration = getDuration();
        const saved = Store.load();
        const state = {
            target: null,                          // gewünschte Ankunft (epoch ms)
            delay: Number.isFinite(saved.delay) ? saved.delay : 0,
            alarm: saved.alarm !== false,
            alarmSec: Number.isFinite(saved.alarmSec) ? saved.alarmSec : 5,
            lat: Number.isFinite(saved.lat) ? saved.lat : 390,   // ms vom Klick bis der Server den Befehl hat (inkl. Versatz der Spieluhr)
            latAuto: CFG.clockSync && saved.latAuto === true,   // nur mit Uhr-Sync: Klick-Laufzeit = halber Ping
            alarmDone: false,
            sendEpoch: null,
        };
        if (Number.isFinite(saved.target) && saved.target > Clock.now()) state.target = saved.target;
        const cmdRows = [];

        const $box = $(`
<div id="snp-box">
  <div id="snp-cmds"></div>
  <div id="snp-bar"><div id="snp-fill"></div><div id="snp-mark" title="Optimaler Klickzeitpunkt"></div><div id="snp-clock"></div></div>
  <table>
    <tr><td class="snp-l">Ankunft (Serverzeit):</td>
        <td><input id="snp-target" type="text" autocomplete="off"
             placeholder="20:15:30:123  ·  morgen 20:15:30:123  ·  24.09. 20:15:30:123">
            <a href="#" id="snp-clear" title="Zielzeit löschen">✕</a><span id="snp-ok"></span></td></tr>
    <tr><td class="snp-l">Korrektur (ms):</td>
        <td><input id="snp-delay" type="number" step="1">
            &nbsp; <label><input id="snp-alarm" type="checkbox"> Ton</label>
            <input id="snp-alarm-s" type="number" min="1" step="1"> s vorher
            <a href="#" id="snp-test" title="Ton testen">▶ Test</a></td></tr>
    <tr><td class="snp-l">Klick-Laufzeit (ms):</td>
        <td><input id="snp-lat" type="number" step="1" min="0">
            ${CFG.clockSync ? '<a href="#" id="snp-lat-auto" title="Klick-Laufzeit wieder automatisch aus dem Ping">auto</a>' : ''}
            <span class="snp-sub">rote Linie (Balkenmitte) = optimaler Klickzeitpunkt</span></td></tr>
    ${CFG.clockSync ? '<tr><td class="snp-l">Uhr-Sync:</td><td id="snp-sync" class="snp-sub">läuft …</td></tr>' : ''}
    <tr><td class="snp-l">Abschicken:</td><td id="snp-send">–</td></tr>
  </table>
  <div id="snp-last"></div>
  <div id="snp-wm">Basis: Ricardo/Bottenkraker · Serverzeit-Umbau</div>
</div>`);
        $('#date_arrival').append($box);

        if (CFG.barWidth) $('#command-data-form .vis:first, #date_arrival').width(CFG.barWidth);

        const $target = $('#snp-target'), $ok = $('#snp-ok'), $send = $('#snp-send');
        $('#snp-delay').val(state.delay);
        $('#snp-lat').val(state.lat);
        $('#snp-alarm').prop('checked', state.alarm);
        $('#snp-alarm-s').val(state.alarmSec);

        if (saved.last) {
            const l = saved.last;
            const sg = v => (v >= 0 ? '+' : '') + v;
            $('#snp-last').text(`Letzter Versand: Klick bei :${pad(l.ms, 3)}` +
                (Number.isFinite(l.diff) ? ` (${sg(l.diff)} ms zum Abschickzeitpunkt` +
                    (Number.isFinite(l.lat) ? `, ${sg(l.diff + l.lat)} ms zur roten Linie` : '') + ')' : ''));
        }

        const persist = () => {
            const cur = Store.load();
            Store.save(Object.assign(cur, {
                target: state.target, delay: state.delay, alarm: state.alarm, alarmSec: state.alarmSec, lat: state.lat, latAuto: state.latAuto,
            }));
        };

        const recompute = () => {
            state.alarmDone = false;
            Sound.cancel();
            if (state.target === null || !duration) {
                state.sendEpoch = null;
                $send.html(duration ? '–' : '<span class="snp-sub">Laufzeit nicht gefunden</span>');
            } else {
                state.sendEpoch = state.target + state.delay - duration;
                $send.html(`<b>${Clock.fmtFull(state.sendEpoch)}</b>
                    &nbsp;<span id="snp-send-cd" class="snp-cd"></span>
                    <br><span class="snp-sub">bei dir: ${fmtLocal(state.sendEpoch)} Uhr · Ankunft ${Clock.fmtFull(state.target + state.delay)}</span>`);
            }
            updateCmdRows();
            updateMark();
            persist();
        };

        /* Rote Linie: Klickzeitpunkt, bei dem der Befehl genau zur Zielzeit (+Korrektur) ankommt
         *   Klick optimal = Abschickzeitpunkt - Klick-Laufzeit
         * Der Balken ist auf diesen Klickzeitpunkt synchronisiert: er läuft jede Sekunde von 0 bis 100 %
         * und steht genau beim optimalen Klick auf 50 % -> rote Linie immer in der Mitte. */
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
            if (ep === null) { $ok.addClass('bad').text('?? Format z.B. 20:15:30:123'); return; }
            setTarget(ep, false);
        });
        $('#snp-clear').on('click', (e) => { e.preventDefault(); setTarget(null, true); });
        $('#snp-delay').on('input', function () {
            const v = parseInt(this.value, 10);
            state.delay = Number.isFinite(v) ? v : 0;
            recompute();
        });
        $('#snp-alarm').on('change', function () {
            state.alarm = this.checked;
            state.alarmDone = false;
            if (!state.alarm) Sound.cancel();
            persist();
        });
        $('#snp-lat').on('input', function () {
            const v = parseInt(this.value, 10);
            state.lat = Number.isFinite(v) && v >= 0 ? v : 0;
            state.latAuto = false;
            $('#snp-lat-auto').css('font-weight', 'normal');
            recompute();
        });
        const applyAutoLat = () => {
            $('#snp-lat-auto').css('font-weight', state.latAuto ? 'bold' : 'normal');
            if (state.latAuto && Clock.rtt !== null) {
                state.lat = Math.round(Clock.rtt / 2);
                $('#snp-lat').val(state.lat);
                recompute();
            }
        };
        if (CFG.clockSync) {
            $('#snp-lat-auto').on('click', (e) => { e.preventDefault(); state.latAuto = true; applyAutoLat(); persist(); });
            applyAutoLat();
            Clock.sync().then((r) => {
                $('#snp-sync').text(r
                    ? `Spieluhr ${Clock.corr >= 0 ? '+' : ''}${Clock.corr} ms korrigiert · Ping ${Clock.rtt} ms`
                    : 'nicht möglich – Spieluhr ungenau (±300 ms)');
                applyAutoLat();
            });
        }
        $('#snp-test').on('click', (e) => { e.preventDefault(); Sound.test(); });
        // Browser erlauben Ton erst nach einer Nutzeraktion -> beim ersten Klick/Tippen freischalten
        $box.on('pointerdown keydown', () => Sound.get());
        $('#snp-alarm-s').on('input', function () {
            const v = parseInt(this.value, 10);
            state.alarmSec = Number.isFinite(v) && v > 0 ? v : 5;
            state.alarmDone = false;
            persist();
        });

        // Übergabe per Link (?arrivalTimestamp=... im Referrer, wie beim Original)
        let fromRef = null;
        try {
            const p = new URL(document.referrer).searchParams.get('arrivalTimestamp');
            if (p && /^\d+$/.test(p)) fromRef = parseInt(p, 10);
        } catch (e) { /* kein Referrer */ }

        if (fromRef) setTarget(fromRef, true);
        else if (state.target !== null) setTarget(state.target, true);
        else recompute();

        /* ---------- laufende Befehle zum Ziel ---------- */
        function updateCmdRows() {
            cmdRows.forEach(r => { r.sendAt = duration ? r.arrival + state.delay - duration : null; });
        }

        function loadCommands() {
            const a = $('#command-data-form .village_anchor a').first().attr('href');
            const id = a && (a.match(/[?&]id=(\d+)/) || [])[1];
            if (!id || !window.game_data) return;
            $.get(game_data.link_base_pure + 'info_village&id=' + id).done(function (html) {
                const $tbl = $(html).find('.commands-container').first();
                if (!$tbl.length || !$tbl.find('tr.command-row').length) return;
                $tbl.find('tr:first').append('<th>Abschicken in</th>');
                $tbl.find('tr.command-row').each(function () {
                    const $r = $(this);
                    const end = parseInt($r.find('[data-endtime]').last().data('endtime'), 10);
                    if (!end) return;
                    const msM = $r.text().match(/\d{1,2}:\d{2}:\d{2}:(\d{3})/);
                    const arrival = end * 1000 + (msM ? +msM[1] : 0);
                    const $cd = $('<td class="snp-cd"></td>');
                    $r.append($cd);
                    $r.find('[data-endtime]').removeClass('timer widget-command-timer'); // TW-Timer nicht doppelt
                    const row = { $r, $cd, $end: $r.find('[data-endtime]').last(), end: end * 1000, arrival, sendAt: null };
                    cmdRows.push(row);
                    $r.on('click', () => {
                        $('#snp-cmds tr.command-row').removeClass('snp-sel');
                        $r.addClass('snp-sel');
                        setTarget(arrival, true);
                    });
                });
                updateCmdRows();
                $('#snp-cmds').append('<div><b>Befehle zum Ziel</b> <span class="snp-sub">(Zeile anklicken = Ankunft übernehmen)</span></div>').append($tbl);
            });
        }
        loadCommands();

        /* ---------- Schleifen ---------- */
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
            cleanupFocus();
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
                const diff = ce - now;   // ms bis zum optimalen Klick
                fill.style.width = (mod(now - ce + 500, 1000) / 10) + '%';
                // grün: die Sekunde um den optimalen Klick (Linie in der Mitte), rot: danach, orange: davor
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
                document.title = left > 0 ? 'Abschicken in ' + cd : 'Zu spät!';
                const toClick = clickEpoch() - now;   // Ton läuft auf den optimalen Klick (rote Linie) hin
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

        /* ---------- Fokus auf den Abschicken-Button ---------- */
        // Nach der letzten Eingabe im Snipe-Feld (focusDelay s) und beim Zurückwechseln in den Tab
        // springt der Fokus auf den Button -> grün = Enter bereit. Es wird NICHTS automatisch abgeschickt.
        var focusTimer = null;
        const $btn = $('#troop_confirm_submit');
        const $fs = $('<span id="snp-focus"></span>');
        if ($btn.length) $fs.insertAfter($btn);

        const editing = () => {
            const a = document.activeElement;
            return !!a && $box[0].contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
        };

        function showFocus() {
            if (!$btn.length) return;
            const on = document.activeElement === $btn[0] && document.hasFocus();
            $btn.toggleClass('snp-armed', on);
            $fs.toggleClass('on', on).toggleClass('off', !on)
                .text(on ? '⏎ Enter bereit' : (CFG.focusDelay > 0 ? 'Fokus nicht auf dem Button' : ''));
        }

        function armFocus(delayMs) {
            if (!$btn.length || CFG.focusDelay <= 0 || stopped) return;
            clearTimeout(focusTimer);
            focusTimer = setTimeout(() => {
                if (stopped || !document.body.contains($btn[0])) return;
                $btn[0].focus();
                showFocus();
            }, delayMs);
        }

        function onVisible() {
            if (document.visibilityState === 'visible' && !editing()) armFocus(0);
        }

        function onFocusChange() { setTimeout(showFocus, 0); }

        // Klick irgendwo in die Seite (nicht in ein Eingabefeld/Link) -> Fokus kurz danach zurück
        function onPointer(e) {
            if (e.target.closest && e.target.closest('input,textarea,select,a,button,label')) return;
            armFocus(700);
        }

        function cleanupFocus() {
            clearTimeout(focusTimer);
            clearInterval(focusShowId);
            document.removeEventListener('pointerdown', onPointer, true);
            window.removeEventListener('focus', onVisible);
            document.removeEventListener('visibilitychange', onVisible);
            document.removeEventListener('focusin', onFocusChange);
            document.removeEventListener('focusout', onFocusChange);
        }

        // Enter in den Snipe-Feldern darf das Formular nicht abschicken
        $box.on('keydown', 'input', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); }
        });
        // jede Eingabe im Snipe-Feld startet die Wartezeit neu
        $box.on('input change keydown pointerdown', () => armFocus(CFG.focusDelay * 1000));
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        document.addEventListener('pointerdown', onPointer, true);
        var focusShowId = setInterval(showFocus, 200);   // grün nur, wenn Fenster UND Button Fokus haben
        document.addEventListener('focusin', onFocusChange);
        document.addEventListener('focusout', onFocusChange);
        armFocus(CFG.focusDelay * 1000);
        showFocus();

        /* ---------- Abschicken ---------- */
        $('#troop_confirm_submit').on('click', function () {
            const now = Clock.now();
            const last = { ms: Clock.parts(now).ms, diff: state.sendEpoch !== null ? Math.round(now - state.sendEpoch) : null, lat: state.lat };
            const cur = Store.load();
            cur.last = last;
            Store.save(cur);
            console.log('[Snipe-Timer] Klick bei', Clock.fmtTime(now),
                last.diff !== null ? `(${last.diff} ms zum Abschickzeitpunkt)` : '');
            stop(true);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Start: Versammlungsplatz direkt, Karte über Popup-Erkennung         */
    /* ------------------------------------------------------------------ */
    function tryStart() {
        if (document.getElementById('date_arrival') && !document.getElementById('snp-box')) {
            try { start(); } catch (e) { console.error('[Snipe-Timer]', e); }
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
