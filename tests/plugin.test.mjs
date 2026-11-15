import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PLUGIN = join(ROOT, "plugins/tal-office");
const SKILLS = join(PLUGIN, "skills");
const TEMPLATES = join(PLUGIN, "templates");
const EXPECTED = [
  "office",
  "office-start",
  "office-business",
  "office-map",
  "office-skill",
  "office-agent",
];

function frontmatter(file) {
  const m = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${file}: אין frontmatter`);
  return Object.fromEntries(
    m[1]
      .split("\n")
      .filter((l) => /^[a-z-]+: /.test(l))
      .map((l) => [l.slice(0, l.indexOf(": ")), l.slice(l.indexOf(": ") + 2)]),
  );
}

test("כל ששת הסקילים קיימים, ורק הם", () => {
  const dirs = readdirSync(SKILLS).filter((d) =>
    existsSync(join(SKILLS, d, "SKILL.md")),
  );
  assert.deepEqual([...dirs].sort(), [...EXPECTED].sort());
});

for (const name of EXPECTED) {
  test(`${name}: ה-frontmatter תקין`, () => {
    const fm = frontmatter(join(SKILLS, name, "SKILL.md"));
    assert.equal(fm.name, name);
    assert.equal(fm["user-invocable"], "true");
    const d = fm.description ?? "";
    assert.ok(d.length > 50, "חסר תיאור");
    const quoted = /^'.*'$/.test(d) || /^".*"$/.test(d);
    if (!quoted)
      assert.ok(
        !d.includes(": ") && !d.includes(" #"),
        "תיאור עם ': ' או ' #' חייב להיות בתוך מרכאות",
      );
  });

  test(`${name}: מפנה ליסודות, וכל תבנית שהוא מזכיר קיימת`, () => {
    const body = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
    assert.ok(body.includes("references/basics.md"), "לא מפנה ליסודות");
    for (const m of body.matchAll(
      /templates\/([\w./-]+\.(?:md|html|json|txt))/g,
    ))
      assert.ok(existsSync(join(TEMPLATES, m[1])), `חסרה תבנית: ${m[1]}`);
  });

  test(`${name}: לא יוצר תיקיות בפקודות טרמינל`, () => {
    const body = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
    assert.ok(!/`mkdir |`cp |node '/.test(body), "פקודת טרמינל ליצירת קבצים");
  });
}

test("היסודות קיימים", () => {
  assert.ok(existsSync(join(PLUGIN, "references/basics.md")));
});

test("תבנית CLAUDE.md: מתחילה בסימן, ויש בה כל הסעיפים", () => {
  const t = readFileSync(join(TEMPLATES, "CLAUDE.md"), "utf8");
  assert.equal(t.split("\n")[0], "<!-- tal-office:business -->");
  for (const h of [
    "## העסק",
    "## איפה כל דבר",
    "## הצוות",
    "## זיכרון",
    "## כללים",
    "## אבטחה",
  ])
    assert.ok(t.includes(h), `חסר סעיף: ${h}`);
  assert.ok(t.includes("@memory/MEMORY.md"), "הזיכרון לא נטען");
  assert.ok(t.includes("{{businessName}}") && t.includes("{{address}}"));
  const left = t.replace(/\{\{(businessName|address)\}\}/g, "");
  assert.ok(!left.includes("{{"), "משתנה לא מוכר בתבנית");
});

test("הגדרות: JSON תקין, עם הגנה על הכספת", () => {
  const s = JSON.parse(readFileSync(join(TEMPLATES, "settings.json"), "utf8"));
  assert.equal(s.permissions.defaultMode, "acceptEdits");
  assert.ok(s.permissions.deny.includes("Read(./.env)"));
});

test(".gitignore מסתיר את הכספת", () => {
  const g = readFileSync(join(TEMPLATES, "gitignore.txt"), "utf8");
  assert.ok(g.split("\n").includes(".env"));
});

test("קבצי ה-marketplace וה-plugin תקינים ומסונכרנים", () => {
  const mp = JSON.parse(
    readFileSync(join(ROOT, ".claude-plugin/marketplace.json"), "utf8"),
  );
  const pl = JSON.parse(
    readFileSync(join(PLUGIN, ".claude-plugin/plugin.json"), "utf8"),
  );
  assert.equal(mp.plugins[0].name, pl.name);
  assert.equal(mp.plugins[0].version, pl.version);
  assert.equal(mp.metadata.version, pl.version);
  assert.equal(mp.plugins[0].source, "./plugins/tal-office");
});

test("תבניות המיפוי: בלי לשון זכר בפנייה, ועם הוראות גם לווינדוס", () => {
  for (const f of ["mapping/mapping-form.html", "mapping/business-map.html"]) {
    const h = readFileSync(join(TEMPLATES, f), "utf8");
    assert.ok(!/אתה|תרצה/.test(h), `${f}: לשון זכר`);
    assert.ok(h.includes("Ctrl+V"), `${f}: אין הוראה לווינדוס`);
  }
});

test("המבנה החדש: projects ו-team-ai, ובלי work", () => {
  const t = readFileSync(join(TEMPLATES, "CLAUDE.md"), "utf8");
  for (const f of ["`projects/`", "`team-ai/`", "`archive/`", "`systems/`"])
    assert.ok(t.includes(f), `חסר בתבנית: ${f}`);
  for (const name of EXPECTED) {
    const body = readFileSync(join(SKILLS, name, "SKILL.md"), "utf8");
    assert.ok(!/`work[/`]/.test(body), `${name}: עדיין מזכיר work`);
  }
  assert.ok(!/`work[/`]/.test(t), "התבנית עדיין מזכירה work");
});

test("תעודת הזהות: תקרה של 200 שורות, וכלל 'קלוד עושה'", () => {
  const t = readFileSync(join(TEMPLATES, "CLAUDE.md"), "utf8");
  assert.ok(t.includes("200 שורות"));
  assert.ok(t.includes("קלוד עושה, לא שולח"));
  assert.ok(t.split("\n").length < 120, "התבנית ארוכה מדי כבר בהתחלה");
});

test("זיכרון בשתי רמות: תוכן עניינים קצר וקבצי נושא", () => {
  const m = readFileSync(join(TEMPLATES, "MEMORY.md"), "utf8");
  assert.ok(m.includes("40 שורות"));
  for (const f of ["customers.md", "decisions.md", "what-didnt-work.md", "sources.md"])
    assert.ok(m.includes(f), `תוכן העניינים לא מפנה ל-${f}`);
  assert.ok(existsSync(join(TEMPLATES, "memory-topic.md")));
  const start = readFileSync(join(SKILLS, "office-start", "SKILL.md"), "utf8");
  for (const f of ["memory/customers.md", "memory/decisions.md", "memory/what-didnt-work.md", "memory/sources.md"])
    assert.ok(start.includes(f), `ההקמה לא יוצרת את ${f}`);
});

test("ההקמה בונה את כל התיקיות, עם שלט בכל אחת", () => {
  const start = readFileSync(join(SKILLS, "office-start", "SKILL.md"), "utf8");
  const dirs = ["systems", "projects", "team-ai", "archive",
    ...["marketing", "sales", "service", "finance", "operations", "management"].map((d) => `systems/${d}`)];
  for (const d of dirs) assert.ok(start.includes(`\`${d}/README.md\``), `אין שלט ל-${d}`);
  assert.ok(existsSync(join(TEMPLATES, "folder-readme.md")));
});

test("מפת העסק: שאלון בשיחה, בלי לפתוח טופס", () => {
  const map = readFileSync(join(SKILLS, "office-map", "SKILL.md"), "utf8");
  assert.ok(map.includes("systems/mapping-answers.md"));
  assert.ok(!map.includes("mapping-form.html"), "עדיין פותח את הטופס");
  const qs = [...map.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  for (let n = 1; n <= 14; n++) assert.ok(qs.includes(n), `חסרה שאלה ${n}`);
});

test("העובד מקבל כרטיס ב-team-ai", () => {
  const agent = readFileSync(join(SKILLS, "office-agent", "SKILL.md"), "utf8");
  assert.ok(agent.includes("team-ai/<שם>.md"));
});

test("הפוקוס עכשיו: בתבנית, ונמלא בשלב המפה", () => {
  const t = readFileSync(join(TEMPLATES, "CLAUDE.md"), "utf8");
  assert.ok(t.includes("## הפוקוס עכשיו"));
  const map = readFileSync(join(SKILLS, "office-map", "SKILL.md"), "utf8");
  assert.ok(map.includes("\"הפוקוס עכשיו\""));
});

test("תעודת הזהות בשני שלבים: המסמך המלא נשמר בזיכרון, והכרטיס נבנה ממנו", () => {
  const biz = readFileSync(join(ROOT, "plugins/tal-office/skills/office-business/SKILL.md"), "utf8");
  assert.match(biz, /memory\/about-business\.md/);
  assert.match(biz, /מילה במילה, בלי לקצר/);
  assert.match(biz, /מתחת ל-200 שורות/);
  const map = readFileSync(join(ROOT, "plugins/tal-office/skills/office-map/SKILL.md"), "utf8");
  assert.match(map, /memory\/about-business\.md/);
});
