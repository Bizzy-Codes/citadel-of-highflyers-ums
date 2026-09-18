# Brag Plan: Citadel of Highflyers Int'l Academy — Website + Portal

## What is this app?
The public website and school-management portal for a private primary school in Jos, Nigeria — families apply online, the school admits a pupil with one tap (account created on the spot), and the login details land in the parent's WhatsApp. Behind it: registers, results, live-monitored tests and fee sheets, all built for the phone in a parent's hand.

## Inspection rubric (Step 1)
1. **What is the app?** Marketing site + admin/teacher/parent portal for Citadel of Highflyers Int'l Academy (React 19 + Vite + Supabase, deployed on Vercel).
2. **Funniest / most impressive claim?** The site's own hero line: *"Empowering The Next Generation Of Generals"* (badge: *"Foundation for Future Generals"*). Most impressive product claim: Admit → account created → login details on WhatsApp, in one tap.
3. **Visual hook?** The purple `#6B21A8` / lavender `#E9D5FF` glass-card look; the hero H1 with a highlighted span; the three floating glass cards; the WhatsApp-green `#25D366` "Send" pill inside the parent chooser.
4. **What to show from the actual UI?** The admissions flow in the admin portal: application card → "Admit" dialog (class select) → "Who should …'s portal login go to?" parent chooser → the real WhatsApp message.
5. **Shortest satisfying video?** ~20s. The flow needs ~10s to breathe; hook + reveal + outro fill the rest.
6. **Tone?** Preset `polished`. Direction: *a warm, confident school film — purple and gold, restrained, phone-first.* This is a real school, not a joke.
7. **Audio?** Steady clean bed (vol-12) at a modest level, 3–4 motion-matched SFX (soft impacts, UI clicks, soft drops), one bell on the crest. Subtle audio-reactive glow only.
8. **Share caption?** "Introducing the Citadel of Highflyers portal: a family applies on their phone, the school admits with one tap, and the login details land on WhatsApp."
9. **User flow worth showing?** Application arrives → admin taps **Admit** and picks the class → chooses **which parent** gets the login → WhatsApp opens with the message written.

## The angle
A school where everything already happens on WhatsApp finally has a portal that meets families there. The video opens in the school's own voice (its motto, its hero line), then proves the claim with the one moment that matters to the person running the school: admitting a child and handing the family their login without typing a thing. No feature lists — one flow, done properly, in the school's colours.

## Hook (first 2-3 seconds)
Deep purple, full-bleed. The badge *"Foundation for Future Generals"* settles first, small; then the hero line **"Empowering The Next Generation Of Generals"** lands in white with *Next Generation* in lavender. It's the site's own line, and "Generals" is the word nobody expects from a primary school.

## Key moments (the middle)
- The real hero recreated on the light theme — H1, "Apply for Admission" button, hero photo — with the three glass cards **Academic Excellence / Modern Facilities / Godly Character** arriving one by one.
- The **Admit** dialog: "Admit Amara Okonkwo" · Class Admitted Into: **Pre-Grade** · a cursor presses the button.
- The **parent chooser**: "Who should Amara's portal login go to?" — Father and Mother rows with green **Send** pills; the cursor picks Mother.
- A phone with the real WhatsApp message: *"Hello, this is Citadel of Highflyers Int'l Academy. Here are the portal login details for Amara Okonkwo (Pre-Grade): Login name … Pupil ID … Password …"*

## Outro / punchline
The crest scales in on purple. **Citadel of Highflyers Int'l Academy.** Then the motto: *Foundation for Future Generals.* Music fades. Nothing else.

## User flow worth showing
1. **Entry** — an application card in the admin portal (fictional pupil *Amara Okonkwo*, Pre-Grade, status *Under Review*) with an **Admit** button.
2. **Key action** — Admit dialog → class confirmed → parent chooser → the admin picks **Mother** and presses **Send**.
3. **Result** — WhatsApp opens on a phone with the login message already written.

Privacy rules for the recreation: fictional pupil and parent names, masked phone numbers (`0806 ••• ••45`), password shown as `••••••` — never the real default. Only the school's own public photo and crest are used.

## Tone
- Preset: polished
- Creative direction: a warm, confident school film — purple and gold, restrained, phone-first
- Interpretation: few scenes, long enough holds to read every line, soft crossfades, one idea on screen at a time; the energy comes from the flow completing, not from motion tricks.

## Format: landscape — 1920x1080
## Duration: 20.5 seconds

## Visual identity (from the project)
- Background (light theme): `#FDFBFF`; surface `#FFFFFF`
- Background (hook / outro): primary purple `#6B21A8` deepening to `#3B0764`
- Accent: `#6B21A8` primary, `#E9D5FF` lavender, `#D8B4FE` secondary; WhatsApp green `#25D366`; success `#10B981`
- Text: `#1E1B4B` main, `#6B7280` muted; white on purple
- Display font: Outfit (600/700) — from `src/index.css` Google Fonts import
- Body font: Outfit (400/500)
- Strongest visual element: the hero (badge pill + H1 with lavender span + floating glass cards) and the parent-chooser dialog with its green Send pill
- Assets to reference: `public/logo.jpg` (crest, 850×842), `public/gallery/hero.jpg` (pupils, 1600×1200)

## Share copy (draft)
Introducing the Citadel of Highflyers portal: a family applies on their phone, the school admits with one tap, and the login details land on WhatsApp.

## Audio direction
- Role: warm, steady bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady and clean; the `polished` pick)
- Music treatment: starts at 0 with a ~1s fade-in, volume ~0.30, fades out over the last ~1.2s under the motto
- Music cue guidance: preset read from `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.md` — tempo ≈110 BPM (beat ≈0.545s). Strong cues to target: **8.74s** (Admit click), **13.11s** (Send click), **17.47s** (crest lands). Beat-grid windows: hero cards at 4.39 / 5.34 / 6.00 (every other beat — they are text); parent rows at 11.46 / 12.02; WhatsApp bubble at 13.64.
- Audio-reactive treatment: subtle; music RMS may breathe the purple radial glow behind the hook and outro and the soft blob behind the hero photo. No waveforms, no pulsing text.
- SFX posture: sparse, motion-matched — one soft impact on the hook line, soft drops for the cards and rows, UI clicks for the three cursor presses, one bell on the crest.
- Audio-coupled moments: hook line landing; card-by-card hero cards; cursor click → dialog; row-by-row parent chooser; cursor click → phone; crest landing.
- Restraint rule: no sound on the crossfades, no typing ticks (nothing is typed), never more than one SFX per beat, nothing louder than the bell on the crest.

## Storyboard

### Scene 1 — Hook — 3.0s (0.0–3.0)
Full-bleed purple gradient (`#6B21A8` → `#3B0764`) with a soft radial glow. At 0.56 the badge pill "✦ Foundation for Future Generals" fades in small, lavender on translucent white. At 1.09 the H1 **"Empowering The Next Generation Of Generals"** rises into place (white, *Next Generation* in `#E9D5FF`), two lines, and holds settled through 3.0.
Sequential/interaction: badge, then headline — two beats, nothing else.
Audio intent: quiet confidence; the bed fades in under the first frame.
Audio-coupled idea: one soft impact as the headline lands (≈1.05s).
Music: bed fades in from 0.
Transition mood: soft crossfade (0.6s) → Scene 2

### Scene 2 — Reveal: the real hero — 4.0s (3.0–7.0)
Light theme `#FDFBFF`. Left column: badge pill (lavender), the same H1 now in `#1E1B4B` with the span in `#6B21A8`, the purple **Apply for Admission →** button and the **Meet Founders** outline button. Right column: `hero.jpg` in a rounded frame over a soft lavender blob. Three glass cards arrive one by one and float: **Academic Excellence** (4.39), **Modern Facilities** (5.34), **Godly Character** (6.00) — each holds at least 1.0s.
Sequential/interaction: yes — three glass cards, every other beat, all three stay on screen.
Audio intent: the product is real and warm.
Audio-coupled idea: soft drop on each card arrival.
Music: bed continues.
Transition mood: soft crossfade (0.5s) → Scene 3

### Scene 3 — The flow: Admit → choose the parent → WhatsApp — 10.0s (7.0–17.0)
Light theme, portal-style. This is one continuous scene; dialogs swap in place, no scene transitions.
- **Beat A · Admit (7.0–11.0).** An application card: avatar initials "AO", **Amara Okonkwo**, "Pre-Grade · applied 2 days ago", status pill *Under Review*, a purple **Admit** button. A cursor glides to it and presses at **8.74** (beat-locked). The **Admit dialog** pops: heading "Admit Amara Okonkwo", helper text "Choose the class this child is being admitted into. Their pupil account is created in the same step.", field **Class Admitted Into: Pre-Grade**, button **Admit & Create Account**. The cursor presses it at **10.93** (beat-locked).
- **Beat B · Which parent? (11.0–13.4).** The dialog swaps to the parent chooser: title "Send login details", description "Who should Amara's portal login go to?", then two rows arriving one by one — **Father — Mr Okonkwo · 0803 ••• ••12** (11.46) and **Mother — Mrs Okonkwo · 0806 ••• ••45** (12.02) — each with a green **Send** pill. Footnote: "WhatsApp opens with the message already written — you still press send." The cursor presses Mother's **Send** at **13.11** (beat-locked).
- **Beat C · WhatsApp (13.4–17.0).** A phone frame slides in (or the dialog gives way to it); a WhatsApp-green outgoing bubble lands at 13.64 with the real message copy: *Hello, this is Citadel of Highflyers Int'l Academy. / Here are the portal login details for Amara Okonkwo (Pre-Grade): / Login name: Amara Okonkwo / Pupil ID: CHF-0231 / Password: •••••• / Sign in here: …/login*. Beside it a single caption fades up at ~13.9: **"Application to portal login. One tap."** — holds through 17.0.
Sequential/interaction: yes — three simulated cursor presses; two parent rows one by one; one message bubble.
Audio intent: the satisfying part — each press does something.
Audio-coupled idea: UI click on each press; soft impact when the Admit dialog pops; soft drop per parent row; soft drop when the bubble lands.
Music: bed continues, unchanged.
Transition mood: soft crossfade (0.6s) → Scene 4

### Scene 4 — Outro — 3.5s (17.0–20.5)
Purple gradient again. The crest (`logo.jpg`, in a white circle) scales in and lands at **17.47** (beat-locked). At 18.0 **Citadel of Highflyers Int'l Academy** fades in below it; at 18.56 the motto *Foundation for Future Generals.* in lavender. Everything holds to 20.5 while the music fades.
Sequential/interaction: crest, name, motto — three quiet arrivals.
Audio intent: a clean, proud landing.
Audio-coupled idea: one bell as the crest lands; nothing after.
Music: fades out 19.3 → 20.5.
Transition mood: hold to black.

**Music mood for this video:** steady, warm, clean (polished)
**Audio summary:** a single clean bed fades in under the school's own words, ticks along quietly beneath the admit-to-WhatsApp flow with a handful of motion-matched clicks and drops, and resolves on one bell as the crest lands.
