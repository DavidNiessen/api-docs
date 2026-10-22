const title = process.env.PR_TITLE ?? '';
const conventionalTitle =
  /^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-z0-9][a-z0-9._/-]*\))?!?: \S(?:[^\r\n]*\S)?$/;

if (!conventionalTitle.test(title) || /[\r\n]/.test(title)) {
  console.error(
    'PR title must use a conventional type, optional lowercase scope and breaking-change marker, and a description. Example: feat(explorer): add request examples',
  );
  process.exitCode = 1;
} else {
  console.log('PR title follows the conventional commit format.');
}
