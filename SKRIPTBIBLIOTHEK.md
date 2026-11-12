# Script library submission

**Name:** Snipe Timer DE

**Categories:** Defense helpers, Attack helpers

**Requirements:** none

**User data:** yes (optional, colours only)

## Description (English, as submitted)

Snipe Timer DE shows a precise millisecond countdown on the attack/support confirmation page, so you can time your send by hand (snipe, back-time, support timing). It is based on the snipe tool by Ricardo/Bottenkraker and was reworked to calculate entirely in server time. The time zone of your PC does not matter.

How to use:
1. Open the confirmation page of an attack or support (rally point or map) and run the script from the quickbar.
2. Enter the desired arrival in server time, e.g. `20:15:30:123`, `tomorrow 20:15:30:123` or `24.09. 20:15:30:123`. Alternatively, click one of the commands already heading to the target village (listed above the bar) to take over its arrival time.
3. The panel shows the send time, a countdown and a bar that runs once per second. The red line in the centre of the bar marks the optimal click moment. Click the send button yourself when the bar reaches the red line.

Settings (in-game panel, saved per world in localStorage):
- Beep: optional countdown beeps that lead up to the red line (Web Audio, no external files). The number of seconds is adjustable, and a test button is included.
- Click latency (ms): the time from your click until the server registers the command. Calibrate it once with a 1-unit support to your own village: target time minus actual arrival, corrected by the "Last send" deviation shown in the panel.
- "Last send" shows how many ms your click was off the send moment and the red line.

Optional user data (JSON) for bar colours and width:
`{"timeColor":"green","waitingColor":"#ff9933","noDateColor":"green","barWidth":600}`

Rules compliance:
- The script never sends, clicks or focuses the send button. The player always sends manually.
- The only server request is one load of the target village's info page on start, used to list commands to the target.
- No external requests, no cookies; settings are kept in localStorage.
- The interface is in German on German-speaking markets and in English elsewhere.
