# Referrals

The Refer a Member page (`refer.html`) posts each referral to a Google Apps
Script web app, which appends a row to a Google Sheet. New rows start with the
status `Pending`. After saving the row, the script automatically emails
`contact@siliconhillsproject.com` with the submitted details and a link to the
new row. Update the status column as referrals are reviewed, then email the
referrer at the address in the row.

## Setup

1. Create a Google Sheet (for example "SHP Referrals") in the team account.
2. In the sheet, open **Extensions → Apps Script**, replace the editor contents
   with `tools/referrals-apps-script.gs`, and save.
3. Select **Deploy → New deployment**, choose type **Web app**, set
   **Execute as: Me** and **Who has access: Anyone**, then deploy and
   authorize access to both Google Sheets and email sending.
4. Copy the web app URL (it ends in `/exec`) into the `data-endpoint`
   attribute of `#refer-form` in `refer.html`, then commit and deploy.

The script creates a `Referrals` tab with headers on the first submission.

When you change the script later, use **Deploy → Manage deployments → Edit**,
pick **New version**, and deploy it so the URL stays the same. Google may ask
you to authorize the email permission the first time this notification version
is deployed.

Until `data-endpoint` is set, the form tells visitors to email
contact@siliconhillsproject.com instead.

## Privacy

The sheet holds the referrer's and referee's names, emails, the referee's
phone number, and the link they provided. Share it only with people who
review referrals.
