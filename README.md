# Unified Portal

Build a secure web portal that combines my existing websites/content into one website using my own Cloudflare/custom domain.

IMPORTANT:
The Cloudflare/custom domain is the ONLY public website users should use.

The existing websites below are SOURCE CONTENT. They should be integrated into the new application rather than being exposed as the public URLs.

━━━━━━━━━━━━━━━━━━━━
SOURCE WEBSITES
━━━━━━━━━━━━━━━━━━━━

GAMES

Google Site:
https://sites.google.com/view/docsmath/home

This is the source for the Games section.

I want the existing Google Site UI and functionality preserved as closely as technically possible.

DO NOT redesign the Games section.

DO NOT create a new UI that merely looks similar.

Preserve the existing:

Layout

Buttons

Colors

Fonts

Spacing

Text

Navigation

Games

Functionality

The goal is for the Games section to look and work like the existing Google Site, except it is accessed through my Cloudflare/custom domain.

DOC EDITOR / PASSWORD GATEWAY

Existing Doc Editor:
https://document-editor.mathfun.workers.dev/

This is the PASSWORD ENTRY GATEWAY.

Integrate this into the new application.

Do not unnecessarily redesign or change its existing UI or functionality.

The user should enter their access password through this Doc Editor/password gateway.

IMPORTANT:
The Doc Editor is NOT an assignable permission.

There should never be an "Editor" or "Doc Editor" checkbox in the admin permission system.

SPORTS STREAMS

Existing Sports Streams site:
https://tvfun.mathfun.workers.dev/

Integrate this into the Sports section.

Do not unnecessarily redesign or change its existing UI or functionality.

━━━━━━━━━━━━━━━━━━━━
MAIN APPLICATION STRUCTURE
━━━━━━━━━━━━━━━━━━━━

The finished application should work like this:

USER OPENS CLOUDFLARE DOMAIN
↓
DOC EDITOR / PASSWORD GATEWAY
↓
PASSWORD VERIFIED
↓
USER GETS ONLY THE PERMISSIONS
ASSIGNED TO THAT PASSWORD
↓
┌─────────────────┬─────────────────┐
│ │ │
GAMES SPORTS STREAMS ADMIN
│ │ │
Mathsucks Tvtime Imtoogood




The Doc Editor/password gateway is the initial entry point.




The user enters a password there.




After the password is successfully verified, the backend determines what that credential is allowed to access.




━━━━━━━━━━━━━━━━━━━━

PUBLIC ROUTES

━━━━━━━━━━━━━━━━━━━━




Create routes similar to:




/

= Doc Editor/password gateway




/editor

= Doc Editor/password gateway if needed internally




/games

= Games




/sports

= Sports Streams




/admin

= Admin dashboard




All public URLs must use my Cloudflare/custom domain.




Do NOT expose these source URLs as the public navigation:




https://sites.google.com/view/docsmath/home




https://document-editor.mathfun.workers.dev/




https://tvfun.mathfun.workers.dev/




The browser address bar should show my Cloudflare/custom domain while users navigate the combined application.




━━━━━━━━━━━━━━━━━━━━

CLOUDFLARE DOMAIN

━━━━━━━━━━━━━━━━━━━━




The final application will be connected to my Cloudflare/custom domain.




Do not hard-code the temporary Lovable URL as the permanent public URL.




Build the routing architecture so it works correctly behind Cloudflare.




The source websites are not supposed to be the final public URLs.




━━━━━━━━━━━━━━━━━━━━

ACCESS PASSWORD SYSTEM

━━━━━━━━━━━━━━━━━━━━




IMPORTANT:




Passwords are SECTION-SPECIFIC.




A password must NEVER automatically grant access to every section of the website.




The Doc Editor is the PASSWORD ENTRY GATEWAY.




Users enter their access password through the Doc Editor/access screen before they can enter the protected application.




The Doc Editor itself is NOT an assignable permission.




Do NOT create an "Editor" or "Doc Editor" checkbox.




The available permissions are:




☐ Games

☐ Sports Streams

☐ Admin




INITIAL PASSWORDS:




Games password:

"Mathsucks"




Sports Streams password:

"Tvtime"




Administrator password:

"Imtoogood"




INITIAL ACCESS RULES:




"Mathsucks" → Games ONLY




"Tvtime" → Sports Streams ONLY




"Imtoogood" → Admin ONLY




The Games password must NOT grant Sports access.




The Sports password must NOT grant Games access.




The Games password must NOT grant Admin access.




The Sports password must NOT grant Admin access.




Normal passwords must only have the permissions explicitly assigned to them.




━━━━━━━━━━━━━━━━━━━━

ADMIN PASSWORD MANAGEMENT

━━━━━━━━━━━━━━━━━━━━




Create a secure /admin dashboard.




Only a credential with Admin permission can access /admin.




The administrator must be able to create and manage access credentials.




When creating or editing a credential, show:




Password:

[enter password]




Access:




☐ Games

☐ Sports Streams

☐ Admin




Do NOT include:




☐ Editor

☐ Doc Editor




The Doc Editor is always the authentication gateway and therefore does not need to be selected as a permission.




The administrator can:




- Add passwords

- Change passwords

- Delete passwords

- Enable passwords

- Disable passwords

- Change their permissions

- Revoke active sessions

- Set optional expiration dates

- View which permissions each credential has

- View whether each credential is enabled

- Turn the global password gate on/off




The administrator should be able to give one credential multiple permissions.




For example:




☑ Games

☑ Sports Streams

☐ Admin




would allow that credential to access both Games and Sports.




A credential with:




☑ Admin




would only have administrator access unless additional permissions are explicitly assigned.




Do NOT automatically grant additional permissions.




━━━━━━━━━━━━━━━━━━━━

AUTHENTICATION FLOW

━━━━━━━━━━━━━━━━━━━━




1. User opens the Cloudflare domain.




2. User reaches the Doc Editor/password gateway.




3. User enters a password.




4. The backend securely verifies the password.




5. The backend determines the permissions associated with that credential.




6. The application creates a secure authenticated session containing the user's permissions.




7. The raw password is immediately removed from the Doc Editor input/content.




8. The user is allowed to access only the sections associated with that credential.




Example:




User enters:




"Mathsucks"




Result:




→ Authentication succeeds

→ Games permission granted

→ Sports permission denied

→ Admin permission denied




User enters:




"Tvtime"




Result:




→ Authentication succeeds

→ Sports Streams permission granted

→ Games permission denied

→ Admin permission denied




User enters:




"Imtoogood"




Result:




→ Administrator authentication

→ Admin permission granted

→ Games/Sports are NOT automatically granted unless explicitly configured




━━━━━━━━━━━━━━━━━━━━

DIRECT URL SECURITY

━━━━━━━━━━━━━━━━━━━━




This is extremely important.




Authentication and authorization must be checked when accessing every protected route.




If someone has NOT authenticated and directly opens:




mydomain.com/games




they must be immediately redirected to the password gateway.




This must work even if they:




- Click the Games URL from browser history

- Use a bookmark

- Paste the Games URL into the address bar

- Manually type the Games URL

- Open the Games URL in a new tab

- Receive the Games URL from someone else




Browser history must NOT provide a way around authentication.




Example:




Unauthenticated user:




mydomain.com/games




↓




Immediately redirect to:




mydomain.com/




↓




User enters a valid credential.




If their credential has Games permission:




↓




Allow /games.




If their credential does NOT have Games permission:




↓




Deny access.




━━━━━━━━━━━━━━━━━━━━

WRONG-PERMISSION URL SECURITY

━━━━━━━━━━━━━━━━━━━━




Users must also be prevented from accessing sections they are not authorized for.




For example:




A user authenticates with:




"Mathsucks"




Their session has:




Games = TRUE

Sports = FALSE

Admin = FALSE




If they manually open:




mydomain.com/sports




they MUST NOT be allowed into Sports.




Immediately reject the request and redirect them appropriately.




Likewise:




A Sports-only credential must not be able to open /games.




A normal Games or Sports credential must not be able to open /admin.




Do NOT rely on hiding navigation buttons.




Even if a navigation button is hidden, the backend must independently verify the user's permission whenever a protected route is requested.




━━━━━━━━━━━━━━━━━━━━

SERVER-SIDE SECURITY

━━━━━━━━━━━━━━━━━━━━




Authentication and authorization must NOT rely only on frontend JavaScript.




Protected routes must be secured by backend/server-side checks whenever technically possible.




Do not use a simple client-side variable such as:




isAdmin = true




to determine permissions.




Do not put passwords directly into frontend JavaScript.




Do not put passwords into publicly accessible source code.




Do not trust permission values supplied by the client.




The backend must determine the authenticated user's actual permissions.




━━━━━━━━━━━━━━━━━━━━

PASSWORD STORAGE

━━━━━━━━━━━━━━━━━━━━




Never store raw passwords in the database.




Passwords must be securely hashed.




Never expose stored password hashes through public APIs.




Never return raw passwords to the frontend.




The administrator dashboard should never display the actual stored password after it has been created.




Credentials should have information such as:




- ID

- Secure password hash

- Enabled/disabled status

- Creation date

- Optional expiration date

- Last-used date

- Assigned permissions

- Session/revocation status




━━━━━━━━━━━━━━━━━━━━

DOC EDITOR PASSWORD CLEARING

━━━━━━━━━━━━━━━━━━━━




There is an existing problem with the current Doc Editor that MUST be fixed.




Currently, after entering the access password and successfully getting through the password gate, the password can sometimes remain as text inside the Doc Editor.




This is a security/privacy problem because someone else who later uses the same computer could see the password.




Fix this completely.




After the password has been successfully verified:




1. Immediately clear the password from the Doc Editor input/text area.




2. Reset the Doc Editor to its normal empty/default state.




3. Do NOT leave the password in the editor's content.




4. Do NOT save the raw password to localStorage.




5. Do NOT save the raw password to sessionStorage.




6. Do NOT put the raw password in the URL.




7. Do NOT put the raw password in query parameters.




8. Do NOT preserve the raw password in the saved document/editor state.




9. Do NOT continue passing the raw password around the application after authentication.




10. Use a secure authenticated session/token after successful verification.




The next time the Doc Editor/password gateway is opened, the input/text area must be completely empty/reset.




The previously entered password must never automatically appear in the Doc Editor.




IMPORTANT:




Do not merely visually hide the password.




Actually remove it from the editor/input state.




━━━━━━━━━━━━━━━━━━━━

SESSION MANAGEMENT

━━━━━━━━━━━━━━━━━━━━




After authentication, maintain a secure authenticated session.




The session should contain the user's permissions, not their raw password.




If the administrator disables a credential, users authenticated using that credential must no longer be able to access its protected sections.




If the administrator revokes active sessions, those sessions must stop working.




If the user logs out, protected routes must require authentication again.




━━━━━━━━━━━━━━━━━━━━

GLOBAL PASSWORD SWITCH

━━━━━━━━━━━━━━━━━━━━




Create a global setting:




password_gate_enabled




When TRUE:




Users must authenticate before accessing protected content.




When FALSE:




Normal users can access the application without entering an access password.




However:




Turning the global password gate OFF must NOT expose the /admin dashboard.




The /admin route must remain administrator-only regardless of the global password setting.




The administrator must still be authenticated and authorized to access /admin.




━━━━━━━━━━━━━━━━━━━━

ADMIN SECURITY

━━━━━━━━━━━━━━━━━━━━




The initial administrator password is:




"Imtoogood"




This credential has Admin permission.




Admin authorization must be enforced server-side.




Do not expose the administrator password in frontend code.




Do not allow normal users to access /admin.




Do not allow someone to become an administrator by changing frontend values, URLs, cookies, or local storage.




━━━━━━━━━━━━━━━━━━━━

SOURCE SITE INTEGRATION

━━━━━━━━━━━━━━━━━━━━




Before implementing the UI, inspect the existing source websites and determine the best technically reliable way to integrate them.




Do NOT simply create screenshots of the websites.




Do NOT create fake versions of the Games site.




Do NOT redesign the Games site.




Do NOT replace the existing Games UI with a generic new UI.




If iframe embedding works without breaking functionality, determine whether it is appropriate.




If iframe embedding prevents the required routing, authentication, or navigation behavior, use an appropriate server-side/proxy approach where technically and legally appropriate.




The goal is for the existing content to appear and function as it currently does while being accessed through my Cloudflare domain.




━━━━━━━━━━━━━━━━━━━━

LINK HANDLING

━━━━━━━━━━━━━━━━━━━━




All public navigation should stay on my Cloudflare domain.




If the Games Google Site contains internal links to other pages within the Google Site, convert those internal destinations to equivalent routes on my Cloudflare domain whenever technically possible.




Do NOT send users back to:




sites.google.com




Likewise, do not send users back to the original Worker URLs when navigating between sections.




The source URLs are for retrieving/integrating the content, not for user-facing navigation.




━━━━━━━━━━━━━━━━━━━━

FINAL USER EXPERIENCE

━━━━━━━━━━━━━━━━━━━━




The finished experience should be:




1. User opens my Cloudflare domain.




2. They see the existing Doc Editor/password gateway.




3. They enter their password.




4. The password is securely verified.




5. The password determines their permissions.




6. The password is immediately removed from the Doc Editor text/input area.




7. The user can access ONLY the sections their credential allows.




8. Games credentials can access Games.




9. Sports credentials can access Sports Streams.




10. Admin credentials can access the Admin dashboard.




11. A user cannot bypass authentication by opening a URL from browser history.




12. A user cannot bypass authorization by manually entering another section's URL.




13. If a user opens a protected URL without the required permission, they are immediately redirected/denied.




14. All public URLs use my Cloudflare/custom domain.




15. The original Games UI remains unchanged rather than being redesigned.




16. The Doc Editor password field is reset so the previously entered password is never left visible for the next person using the computer.




Build this as a complete working application, not just a visual mockup.




Make the site auto scan and scrape though for all sites included. I will be adding another site later with its own secret code. I want the auto scan and scrape so if i add a game to the google site it will transfer to this version.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://unified-gate-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/171657ae-12b3-4f51-b081-3914da41843f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
