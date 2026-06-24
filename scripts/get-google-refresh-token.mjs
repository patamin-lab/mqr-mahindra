#!/usr/bin/env node
/**
 * One-time helper: mint a Google OAuth refresh token for the Gmail account
 * that owns the MQR Drive folder. Run this on YOUR OWN computer, logged in
 * as that account in your browser - it never sends anything to anyone but
 * Google, and the resulting refresh token is printed only to your terminal.
 *
 * Setup (Google Cloud Console, same project that has Drive API enabled):
 *   1. APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
 *   2. Application type: "Desktop app"
 *   3. Copy the Client ID and Client Secret it gives you
 *
 * Usage:
 *   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy \
 *     node scripts/get-google-refresh-token.mjs
 *
 * It opens (prints) a Google consent URL - open it in a browser, log in as
 * the account that owns the destination Drive folder, click Allow. The
 * script catches the redirect automatically and prints your refresh token.
 * Put that value into GOOGLE_OAUTH_REFRESH_TOKEN in Vercel + .env.local.
 */
import http from 'http';
import { google } from 'googleapis';

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('ตั้งค่า GOOGLE_OAUTH_CLIENT_ID และ GOOGLE_OAUTH_CLIENT_SECRET ก่อนรันสคริปต์นี้ (ดูคอมเมนต์ด้านบนของไฟล์นี้)');
  process.exit(1);
}

const server = http.createServer();

server.listen(0, () => {
  const port = server.address().port;
  const redirectUri = `http://localhost:${port}`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  });

  console.log('\n1) เปิดลิงก์นี้ในเบราว์เซอร์ แล้วล็อกอิน/เลือกบัญชี Gmail ที่เป็นเจ้าของโฟลเดอร์ปลายทาง:\n');
  console.log(authUrl);
  console.log('\n2) กด "Allow" — สคริปต์นี้จะรับโทเค็นจากเบราว์เซอร์อัตโนมัติ แล้วพิมพ์ refresh token ออกมาที่นี่\n');

  server.on('request', async (req, res) => {
    try {
      const url = new URL(req.url, redirectUri);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.end('เกิดข้อผิดพลาด: ' + error + ' — ปิดแท็บนี้แล้วลองรันสคริปต์ใหม่');
        console.error('OAuth error:', error);
        server.close();
        process.exit(1);
      }
      if (!code) {
        res.end('ไม่พบ code ในคำตอบ ลองรันสคริปต์ใหม่');
        return;
      }
      res.end('สำเร็จ! ปิดแท็บนี้ได้เลย แล้วกลับไปดู terminal ของคุณ');
      const { tokens } = await oauth2Client.getToken(code);
      if (!tokens.refresh_token) {
        console.error(
          '\nไม่ได้รับ refresh_token กลับมา (Google อาจเคยออกให้ไปแล้วก่อนหน้านี้) — ไปที่ ' +
            'https://myaccount.google.com/permissions เพิกถอนสิทธิ์แอปนี้ออกก่อน แล้วรันสคริปต์นี้ใหม่อีกครั้ง\n'
        );
        process.exit(1);
      }
      console.log('\n=== คัดลอกค่านี้ไปตั้งเป็น GOOGLE_OAUTH_REFRESH_TOKEN ===\n');
      console.log(tokens.refresh_token);
      console.log('\n========================================================\n');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('แลกโทเค็นไม่สำเร็จ:', err.message);
      res.end('เกิดข้อผิดพลาด ดู terminal');
      server.close();
      process.exit(1);
    }
  });
});
