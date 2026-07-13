---
sidebar_position: 2
---

# First-run setup

The first time you open Launchpad, it funnels you to a one-time setup wizard. **The first account you create becomes the administrator.** After that, self-service signup is closed by default; additional users join by invitation only.

## Create the admin account

Open your Launchpad URL (e.g. **http://localhost:3000**). You'll see the setup wizard.

![Create your admin account](/img/launchpad/launchpad-create-admin-account.png)

Fill in:

- **First name** / **Last name**
- **Email**: becomes your login and the owner of the first organization
- **Password**: at least 8 characters, with an uppercase letter and a number or symbol

Click **Continue**.

## Configure email (optional)

The second step lets you configure an email provider for invitations, verification, and password resets.

![Setup wizard - email configuration](/img/launchpad/launchpad-wizard-email.png)

You can choose **Mailgun**, **SMTP**, or skip it entirely:

- **None**: email is skipped. Invitation and reset links are printed to the server console instead of being sent. This is fine for a single-admin or evaluation deployment.
- **Mailgun**: provide the from address, domain, and API key.
- **SMTP**: provide the from address, host, port, TLS setting, and (optionally) username/password.

Email configuration is best-effort and never blocks admin creation; you can set or change it later from **Settings**.

Finish the wizard to create your admin account. You'll be signed in and dropped on the dashboard.

:::note Setup is one-time
Once an account exists, the setup wizard is permanently closed and redirects to the login page. There's no way to re-run it against an existing database.
:::

## Next

Now connect your first Arc server: [Connecting to Arc](/launchpad/getting-started/connecting-to-arc).
