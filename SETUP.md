# הקמת האתר

האתר הוא קבצים סטטיים (בלי בנייה). הנתונים והכניסה נשמרים ב-Firebase, והאתר עצמו מתפרסם ב-GitHub Pages.

## 1. פרויקט Firebase (בחינם)
1. נכנסים ל-https://console.firebase.google.com ויוצרים פרויקט חדש (למשל `yeshiva-accounts`). אפשר לכבות את Google Analytics.
2. **Build ← Authentication ← Get started ← Sign-in method**: מפעילים **Email/Password**.
3. בלשונית **Users** לוחצים **Add user** ויוצרים שני משתמשים: האימייל שלך ואימייל הבוס, כל אחד עם סיסמה.
4. **Authentication ← Settings ← User actions**: מבטלים את **Enable create (sign-up)**, כדי שאף אחד אחר לא יוכל להירשם.
5. **Build ← Firestore Database ← Create database**: מצב production, ובחירת מיקום (למשל `me-west1`).
6. בלשונית **Rules** מדביקים את התוכן של `firestore.rules`, אחרי שמחליפים בו את `OWNER@example.com` ו-`BOSS@example.com` בכתובות האמיתיות (באותיות קטנות), ולוחצים **Publish**.
7. **Project settings (גלגל השיניים) ← General**: מעתיקים את **Project ID** ואת **Web API Key**.

## 2. הגדרת האתר
ממלאים את `config.js`: `apiKey`, `projectId`, `ownerHash` (גיבוב SHA-256 של האימייל שלך).

## 3. פרסום ב-GitHub Pages
1. יוצרים ריפו **ציבורי** חדש (למשל `yeshiva-accounts`) ומעלים אליו את הקבצים שבתיקיית `site` (בלי קובץ האקסל).
2. בריפו: **Settings ← Pages ← Deploy from a branch ← main / (root)**.
3. הכתובת תהיה `https://<שם-משתמש>.github.io/yeshiva-accounts/`.

הקוד ציבורי אבל הנתונים לא: הם שמורים ב-Firebase, ורק שתי הכתובות שבכללי ההרשאות יכולות לקרוא אותם.

## 4. טעינת הנתונים
ההכנסות וההוצאות מתחילות ריקות ומוזנות ישירות באתר (תנועות ← תנועה חדשה). את הקייטרינג והחינוך אפשר לייבא מהאקסל המקורי: נכנסים עם האימייל של בעל ההרשאה, בסקירה לוחצים **ייבוא מאקסל**, בוחרים את הקובץ ומאשרים. הקובץ נקרא בדפדפן ולא נשמר באתר.
