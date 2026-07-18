# Production Smoke Test Checklist — Corporate PDF Standardization v1.0

Run against the live production deployment after PR #78 (merge commit `6ef759d`) has deployed. Requires a real browser and an authenticated session — not executable by an AI agent in this environment; use this as the manual verification script.

## Authentication

- [ ] Login with a valid dealer account succeeds and lands on the Dashboard.
- [ ] Login with an invalid password is rejected with a clear error (no stack trace/digest).
- [ ] Logout clears the session and redirects to `/login`; a protected route visited afterward redirects back to login.
- [ ] Role validation: log in as each of SuperAdmin / CentralAdmin / DealerAdmin / DealerUser and confirm the sidebar/available actions match that role (no action visible that the role can't actually perform).

## MQR (Quality Report)

- [ ] Create a new MQR report with at least one photo in each category (odometer, vehicle serial, damage point).
- [ ] Edit an existing MQR report — confirm previously-uploaded photos display correctly in the edit form (not broken/blank).
- [ ] View an MQR report's detail page — all fields, photos, and status display correctly.

## Images

- [ ] Upload a single image to a new MQR/PM/NTR record — confirm it appears in the form immediately.
- [ ] Upload multiple images across different categories on the same record — confirm all appear, none overwrite each other.
- [ ] **PDF rendering**: export a PDF for a record with photos in every category — confirm every photo that displays in the app also appears in the PDF (this was Defect 1 — the primary regression to watch for).
- [ ] **No image cropping**: confirm a portrait-oriented photo and a landscape-oriented photo both render fully visible in the PDF (letterboxed if needed), never cropped to fill a box.
- [ ] **Signed URL validation**: export a PDF for a record whose photos were uploaded more than an hour ago (a record from an earlier day, not one just created) — confirm the photos still render in the PDF rather than showing "Image unavailable."

## Translation

- [ ] Create/view a record with Thai text in a free-text field (Problem Details, Root Cause, Corrective Action, Recommendation, or PM Notes) — confirm the PDF shows both "TH" (original Thai, unchanged) and "EN" rows.
- [ ] **API key configured**: with `GOOGLE_TRANSLATE_API_KEY` set in the environment, confirm the "EN" row shows a real English translation, not "Translation unavailable."
- [ ] **API key missing (graceful fallback)**: with the key unset (or in an environment where it isn't configured), confirm the PDF still generates successfully, the "TH" row still shows the original text, and "EN" shows "Translation unavailable (`<reason>`)" — PDF generation must not fail or hang.
- [ ] Spot-check a sentence containing a known glossary term (e.g. a term for "bearing," "gearbox," or "hydraulic cylinder") — confirm the English output uses the approved engineering term.

## PDF

- [ ] Generate a PDF from each of NTR, PM, and MQR detail pages.
- [ ] Download the generated PDF and confirm it opens correctly in a standard PDF viewer (Adobe Reader / Chrome's built-in viewer).
- [ ] Print the PDF (or print-preview it) — confirm layout doesn't clip content at page edges.
- [ ] **Image quality**: zoom into a photo inside the downloaded PDF — confirm it isn't visibly over-compressed or resized down from the original.
- [ ] **Bilingual layout**: confirm the TH/EN rows are clearly distinguishable (label, spacing) and don't overlap or clip long text.

## Sign-off

- [ ] All boxes above checked by: ______________________ Date: ______________
- [ ] Any failed item is a release blocker — do not consider this release stable until resolved or explicitly accepted as a known issue.
