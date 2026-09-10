# Pam Golding Dashboard V16 — Google Calendar sync

Upload every file in this patch to the matching path in the GitHub repository. Choose **Commit changes** after each upload.

## Replace

- `app/organizer-complete-v16.tsx`
- `app/organizer-complete-v16.css`

## Add

- `lib/google-calendar.ts`
- `app/api/google/connect/route.ts`
- `app/api/google/callback/route.ts`
- `app/api/google/status/route.ts`
- `app/api/google/disconnect/route.ts`
- `app/api/google/events/route.ts`

No existing files need to be deleted. `app/page.tsx` stays unchanged.

## Google Cloud setting

In the OAuth Web Client, add this exact **Authorized redirect URI**:

`https://pam-golding-dashboard.vercel.app/api/google/callback`

## Vercel variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

After uploading, wait for Vercel to finish deploying. Open the app, go to **My Profile**, and tap **Connect Google Calendar**. Each person connects their own Google account once.

The app imports events for today through the next 45 days. New appointments created in the app are saved directly to Google Calendar. Editing or deleting a Google event in the app also updates Google Calendar.
