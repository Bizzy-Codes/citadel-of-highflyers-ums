# Hyperframes Composition Brief: Citadel of Highflyers Int'l Academy

## Objective
Create a short launch-style brag video for the Citadel of Highflyers website + school portal.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20.5 seconds

## Source Material
- Project root: `C:\Users\Acer\.gemini\antigravity\scratch\citadel-highflyers-ums`
- Primary files read: `index.html`, `src/index.css` (palette + Outfit font), `src/pages/marketing/Home.tsx` + `Home.css` (hero, badge, glass cards, CTA copy), `src/pages/portal/AdminAdmissions.tsx` (Admit dialog copy), `src/components/portal/ContactParentDialog.tsx` (parent chooser copy + green Send pill), `src/lib/outreach.ts` (WhatsApp login message), `src/lib/accounts.ts` (class names), `public/logo.jpg`, `public/gallery/hero.jpg`
- Product name: Citadel of Highflyers Int'l Academy
- Tagline / strongest claim: "Empowering The Next Generation Of Generals" · badge "Foundation for Future Generals"
- Key UI or visual moment to recreate: the admin Admit dialog → the "which parent?" chooser with green WhatsApp **Send** pills → the WhatsApp login message on a phone
- Copy that must appear verbatim:
  - Foundation for Future Generals
  - Empowering The Next Generation Of Generals
  - Apply for Admission
  - Academic Excellence · Modern Facilities · Godly Character
  - Class Admitted Into
  - Who should Amara's portal login go to?
  - WhatsApp opens with the message already written — you still press send.
  - Hello, this is Citadel of Highflyers Int'l Academy.
  - Here are the portal login details for Amara Okonkwo (Pre-Grade):
  - Login name: / Pupil ID: / Password: / Sign in here:
  - Citadel of Highflyers Int'l Academy

Privacy: pupil and parents are fictional (Amara Okonkwo, Mr/Mrs Okonkwo); phone numbers masked (`0803 ••• ••12`); the password is shown as `••••••` — never the real default value.

## Creative Direction
- Tone preset: polished
- Creative direction: a warm, confident school film — purple and gold, restrained, phone-first
- Interpretation: 4 scenes, soft 0.5–0.6s crossfades, every line held long enough to read, one idea on screen at a time; the energy comes from the flow completing, not from motion tricks.
- Angle: A school where everything already happens on WhatsApp finally has a portal that meets families there. Open in the school's own voice (motto + hero line), then prove the claim with the one moment that matters to the person running the school: admitting a child and handing the family their login without typing a thing. No feature lists — one flow, done properly, in the school's colours.
- Hook: purple full-bleed; badge "Foundation for Future Generals" then the H1 "Empowering The Next Generation Of Generals" (white, *Next Generation* in lavender).
- Outro / punchline: the crest lands on purple → "Citadel of Highflyers Int'l Academy" → "Foundation for Future Generals." → music fades.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Real pupil names, real phone numbers, the real default password

## Visual Identity
- Background: `#FDFBFF` (light scenes); `#6B21A8 → #3B0764` gradient (hook + outro); surfaces `#FFFFFF`
- Text: `#1E1B4B` main, `#6B7280` muted; white on purple
- Accent: `#6B21A8` primary, `#E9D5FF` lavender, `#D8B4FE` secondary, `#25D366` WhatsApp green, `#10B981` success
- Display font: Outfit 600/700 (Google Fonts; fall back to a local sans if fonts cannot load in the renderer)
- Body font: Outfit 400/500
- Visual references from the project: `.badge-refined` pill; hero H1 with coloured `<span>`; `.floating-card .premium-glass` cards; `.btn.btn-primary` purple pill buttons; the parent-chooser rows with a `#25D366` "Send" pill; the crest `assets/img/logo.jpg`; the hero photo `assets/img/hero.jpg`

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.0s — purple; badge then hero H1, held settled
2. Reveal: the real hero — 4.0s — light theme; H1 + buttons left, hero photo right; three glass cards arrive one by one (4.39 / 5.34 / 6.00)
3. The flow — 10.0s — application card → cursor presses **Admit** (8.74) → Admit dialog (Class Admitted Into: Pre-Grade) → cursor presses **Admit & Create Account** (10.93) → parent chooser rows arrive (11.46 / 12.02) → cursor presses Mother's **Send** (13.11) → phone with the WhatsApp login message (bubble 13.64) + caption "Application to portal login. One tap."
4. Outro — 3.5s — purple; crest lands (17.47), school name (18.0), motto (18.56), music fades

## Audio
- Audio role: warm, steady bed with sparse professional accents
- Audio arc: bed fades in under the hook, sits unchanged beneath the flow with a handful of motion-matched clicks and drops, resolves on one bell as the crest lands, then fades out under the motto
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
- Music treatment: start at 0, ~1s fade-in, volume ≈0.30, fade out 19.3 → 20.5
- Music cue guidance: bundled preset at `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (≈110 BPM). Strong cues to lock: 8.74 (Admit press), 13.11 (Send press), 17.47 (crest lands). Beat-grid: hero cards 4.39 / 5.34 / 6.00 (every other beat — they are text); parent rows 11.46 / 12.02; WhatsApp bubble 13.64.
- Audio-reactive treatment: subtle; music RMS breathes the purple radial glow behind the hook/outro and the lavender blob behind the hero photo. No waveforms, equalizers or pulsing text. Implementation note: the bundled `extract-audio-data.py` helper needs Python + numpy, which this machine lacks, so per-frame RMS was derived with ffmpeg `astats` (same `{fps,totalFrames,frames[{rms}]}` shape, 5-frame smoothed) into `composition/assets/audio-data.js` and applied as seek-safe per-frame `tl.set` calls.
- Audio-coupled moments:
  - Scene 1 hook line lands — one soft impact
  - Scene 2 glass cards — soft drop per card
  - Scene 3 cursor presses — UI click each (three total); Admit dialog pops — soft impact; parent rows — soft drop each; WhatsApp bubble — soft drop
  - Scene 4 crest lands — one bell
- SFX selection guidance: match the visible motion; keep it sparse; at most one SFX per beat; nothing on crossfades; nothing louder than the crest bell.
- SFX analysis guidance: `C:\Users\Acer\.claude\skills\brag\assets\sfx\sfx-analysis.md` — prefer low HF-risk files for repeated moments (`impactSoft_medium_*`, `drop_001/002`, `click_003`); the bell (`impactBell_heavy_000`, medium risk) is used once.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density and volume based on the implemented animation. Pre-staged in `assets/sfx/`: `impact/impactSoft_medium_001.ogg`, `impact/impactSoft_medium_002.ogg`, `impact/impactBell_heavy_000.ogg`, `interface/drop_001.ogg`, `interface/drop_002.ogg`, `interface/click_003.ogg`.
- Audio files: music and SFX already copied into `brag-output/composition/assets/`.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not `none`, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
