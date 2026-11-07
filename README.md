# Dombivali Medical Association

API-first portal for medical stores in Dombivali. The admin site and the member site both call the same JSON API, so a mobile app can use those endpoints as they are.

## Run locally

```bash
php database/seed.php
php -S 127.0.0.1:8080 router.php
```

- Admin: http://127.0.0.1:8080/admin
- Member site: http://127.0.0.1:8080/
- Member app: `mobile/` (React Native, Expo)
- Username: `admin`
- Password: `admin123`

The member app uses the same API. Start the PHP server first, then:

```bash
cd mobile
npm install
npx expo start
```

`mobile/.env` sets `EXPO_PUBLIC_API_URL`. A phone on the same Wi-Fi needs this computer’s LAN address instead of `127.0.0.1`. The Android emulator rewrites `127.0.0.1` to `10.0.2.2` automatically.

Change the admin password after the first sign-in.

## RouteMobile OTP

Member sign-in asks RouteMobile to generate the OTP, then checks the code with RouteMobile. The app never sees the RouteMobile password.

Set these in `.env`:

```bash
RM_BASE_URL=https://api.rmlconnect.net
RM_USERNAME=your_http_username
RM_PASSWORD=your_http_password
RM_SENDER=your_sender_id
RM_OTP_LENGTH=6
RM_OTP_EXPIRY=300
RM_MESSAGE=Your Dombivali Medical Association login OTP is %m. It is valid for 5 minutes. Do not share this OTP.
```

`%m` is required. RouteMobile replaces it with the OTP before the SMS is sent. The final text has to match the DLT template registered for that sender ID.

While `RM_USERNAME` is empty and `APP_DEBUG=1`, no SMS is sent. The full message, including the OTP, is stored and listed in Admin → SMS Manager. Set `APP_DEBUG=0` before going live.

Generate: `GET /OtpApi/otpgenerate`  
Verify: `GET /OtpApi/checkotp`  
Success codes: `1701` for send, `101` for verify.

## What a member stores

The ID on a medical store is the **drug licence number** from FDA Maharashtra (retail Form 20, wholesale Form 21). Pharmacist registration with the Maharashtra State Pharmacy Council is optional.

New members stay pending until an admin approves them. Approved members can file complaints. Admin flyer images are the records shown on the member site and, through `GET /api/flyers`, in the app.

## API

Send `Authorization: Bearer <token>` after sign-in. Image fields are multipart; everything else is JSON.

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/otp/send` | Public. Body `{ "mobile", "purpose" }` where purpose is `login` or `register` |
| POST | `/api/auth/otp/verify` | Public. Body `{ "mobile", "otp", "purpose" }` |
| POST | `/api/auth/register` | Registration token + shop profile |
| POST | `/api/auth/logout` | Member or admin |
| GET, PUT | `/api/me` | Member |
| GET, POST | `/api/complaints` | Member. POST can include a `photo` |
| GET | `/api/flyers` | Public active flyers |
| GET | `/api/association` | Public name, logo, contact |
| POST | `/api/admin/login` | Admin `{ "username", "password" }` |
| GET | `/api/admin/dashboard` | Admin |
| GET, PATCH | `/api/admin/members` and `/api/admin/members/{id}` | Admin |
| GET | `/api/complaint-categories` and `/api/complaint-statuses` | Public active master lists |
| GET, PATCH | `/api/admin/complaints` and `/api/admin/complaints/{id}` | Admin |
| GET, POST, PATCH | `/api/admin/complaint-categories` and `/api/admin/complaint-statuses` | Admin master data |
| GET, POST, DELETE | `/api/admin/flyers` and `/api/admin/flyers/{id}` | Admin. POST is multipart |
| GET | `/api/admin/sms` | Admin message log |
| GET, POST | `/api/admin/settings` | Admin. POST is multipart |

Reset the local database with `php database/seed.php --fresh`.
