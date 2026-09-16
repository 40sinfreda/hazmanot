# חיבור האתר לגיליון

גיליון: https://docs.google.com/spreadsheets/d/18grfaZ1vMj8RtC7If_5efcGZKvZzgi1IP06dffEb3QU/edit

טוקן: `hazmanot-2026-hadar`

## 1. GitHub Pages
Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)` → Save  
האתר: https://40sinfreda.github.io/hazmanot/

## 2. גשר Apps Script
1. בגיליון: הרחבות → Apps Script.
2. הדבק את `Code.gs` מהריפו (קובץ חדש או באותו פרויקט של סנכרון המלאי).
3. שמור.
4. פריסה → פרוס כפרויקט אינטרנט
   - ביצוע בתור: אני
   - גישה: כל מי שיש לו את הקישור
5. העתק את כתובת ה-`/exec` (נראית כמו `https://script.google.com/macros/s/.../exec`).
6. עדכן ב-`config.js`:

```js
window.HAZMANOT_WEBAPP = "https://script.google.com/macros/s/XXXX/exec";
window.HAZMANOT_TOKEN = "hazmanot-2026-hadar";
```

7. דחוף לריפו. רענן את האתר.

בלי הגשר האתר נפתח אבל בלי נתונים מהשיטס.
