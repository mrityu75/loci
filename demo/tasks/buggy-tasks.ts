export interface BuggyTask {
  id: string;
  description: string;
  buggyCode: string;
  errorMessage: string;
  correctFix: string;
}

export const buggyTasks: BuggyTask[] = [
  {
    id: 'task-1-off-by-one',
    description: 'Off-by-one error: loop condition uses <= instead of <, reading past the end of the array',
    buggyCode: `
function getLastNItems<T>(arr: T[], n: number): T[] {
  const result: T[] = [];
  for (let i = arr.length - n; i <= arr.length; i++) {
    result.push(arr[i]);
  }
  return result;
}

// Caller
const items = [10, 20, 30, 40, 50];
console.log(getLastNItems(items, 3)); // Expected: [30, 40, 50]
`.trim(),
    errorMessage:
      'TypeError: Cannot read properties of undefined\n' +
      'The loop runs one iteration too many (i <= arr.length reaches index 5 on a 5-element array).\n' +
      'Result is [30, 40, 50, undefined] instead of [30, 40, 50].',
    correctFix: 'Change i <= arr.length to i < arr.length in the for-loop condition.',
  },

  {
    id: 'task-2-missing-await',
    description: 'Missing await: async function result assigned synchronously, producing a Promise object instead of the resolved value',
    buggyCode: `
async function fetchConfig(userId: string): Promise<string> {
  // Simulates a DB/network fetch
  return JSON.stringify({ theme: 'dark', language: 'en', userId });
}

async function loadUserConfig(userId: string): Promise<{ theme: string; language: string }> {
  const raw = fetchConfig(userId);   // ← missing await
  return JSON.parse(raw);
}

// Caller
loadUserConfig('user-42').then(console.log).catch(console.error);
`.trim(),
    errorMessage:
      "SyntaxError: Unexpected token 'o', \"[object Pr\"... is not valid JSON\n" +
      'raw holds a Promise object, not the resolved string. JSON.parse receives "[object Promise]".',
    correctFix: 'Add await before fetchConfig(userId) so raw receives the resolved string.',
  },

  {
    id: 'task-3-falsy-zero',
    description: 'Wrong null check: falsy guard treats 0 (a valid age) the same as null, misclassifying newborns',
    buggyCode: `
interface User {
  name: string;
  age: number | null;  // null means age is unknown
}

function classifyAge(user: User): string {
  if (!user.age) return 'unknown';   // ← BUG: 0 is falsy, so newborns are classified as unknown
  if (user.age < 13) return 'child';
  if (user.age < 18) return 'teen';
  return 'adult';
}

console.log(classifyAge({ name: 'Newborn', age: 0 }));   // Expected: 'child', actual: 'unknown'
console.log(classifyAge({ name: 'NoData',  age: null })); // Expected: 'unknown' ✓
console.log(classifyAge({ name: 'Alice',   age: 10 }));   // Expected: 'child'  ✓
`.trim(),
    errorMessage:
      "classifyAge({ name: 'Newborn', age: 0 }) returns 'unknown' instead of 'child'.\n" +
      '!user.age is true for both null and 0 because 0 is falsy in JavaScript.',
    correctFix:
      'Replace !user.age with user.age === null || user.age === undefined to distinguish missing data from a legitimate 0.',
  },
];
