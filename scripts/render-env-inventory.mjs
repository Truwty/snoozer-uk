// One-time operator inventory: environment variable NAMES ONLY.
// NEVER log process.env values, even masked or shortened. Remove after audit.
// Only invoke at Node startup, never expose as an HTTP route.
const keys = Object.keys(process.env)
  .filter((key) => /^[A-Za-z_][A-Za-z0-9_]{1,100}$/.test(key))
  .sort();
console.info(JSON.stringify({ audit: "snoozer-render-env-inventory", names_only: true, count: keys.length, keys }));
