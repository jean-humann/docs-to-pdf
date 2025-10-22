// See https://github.com/conventional-changelog/commitlint/blob/master/docs/reference-rules.md
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Override. The subject may be the name of a class.
    'subject-case': [0],
    // Override. Most UIs wrap the body.
    'body-max-line-length': [0],
    // Override. Most UIs wrap the footer.
    'footer-max-line-length': [0],
  },
};