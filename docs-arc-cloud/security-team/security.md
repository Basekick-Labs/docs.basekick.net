---
sidebar_position: 1
---

# Account Security

Arc Cloud supports two-factor authentication (2FA) and passkeys to protect your account from unauthorized access.

## Two-Factor Authentication (TOTP)

Two-factor authentication adds a second verification step when signing in with email and password. After entering your credentials, you must provide a 6-digit code from an authenticator app such as Google Authenticator, Authy, or 1Password.

### Enabling 2FA

1. Go to **Settings** > **Security**.
2. Click **Enable two-factor authentication**.
3. Scan the QR code with your authenticator app (or enter the secret manually).
4. Enter the 6-digit code from your app to confirm.
5. Save your **recovery codes** — you will need these if you lose access to your authenticator.

### Recovery Codes

When you enable 2FA, you receive 8 single-use recovery codes. Each code can be used exactly once as a substitute for your authenticator code.

:::warning Store your recovery codes safely
Recovery codes are shown only when you first enable 2FA or explicitly regenerate them. Store them in a password manager or other secure location. If you lose both your authenticator device and your recovery codes, you will be locked out of your account.
:::

To regenerate recovery codes, go to **Settings** > **Security** and click **Regenerate recovery codes**. This invalidates all previous codes.

### Disabling 2FA

Go to **Settings** > **Security** and click **Disable two-factor authentication**. You must enter a valid authenticator code to confirm.

## Passkeys (WebAuthn)

Passkeys provide passwordless, phishing-resistant authentication. They use your device's built-in biometric or security key — such as Touch ID, Face ID, Windows Hello, or a hardware key like YubiKey.

### Adding a Passkey

1. Go to **Settings** > **Security**.
2. Click **Add passkey**.
3. Follow your browser or device prompt to register the credential.
4. Give the passkey a name (e.g., "MacBook Touch ID").

You can register multiple passkeys for different devices.

### Signing In with a Passkey

On the login page, click **Sign in with passkey**. Your browser will prompt you to select a registered credential. Passkey authentication is inherently multi-factor (something you have + something you are), so it bypasses the TOTP prompt entirely.

### Managing Passkeys

View and delete registered passkeys from **Settings** > **Security**. Deleting a passkey removes it permanently — you will no longer be able to use that credential to sign in.

## Single Sign-On (OAuth)

Arc Cloud supports signing in with third-party identity providers so you can skip creating a separate password.

### GitHub

Click **Continue with GitHub** on the login or signup page. Arc Cloud requests read-only access to your GitHub profile and email. Your account is linked by your GitHub ID — if you already have an Arc Cloud account with the same email, you will be asked to sign in with your password first and then link GitHub from Settings.

### Google

Click **Continue with Google** on the login or signup page. Arc Cloud requests access to your basic profile information (name and email). As with GitHub, your account is linked by your Google ID. If an account with the same email already exists, you must sign in with your password first.

:::info
OAuth accounts are auto-verified — no email confirmation step is required. A default organization is created automatically on first sign-in.
:::

## Login Methods

| Method | MFA Required | Notes |
|--------|-------------|-------|
| Email + password | Yes, if 2FA is enabled | Standard sign-in flow |
| Passkey | No — inherently multi-factor | Touch ID, Face ID, or security key |
| GitHub OAuth | No — relies on GitHub's own security | Links by GitHub ID |
| Google OAuth | No — relies on Google's own security | Links by Google ID |
