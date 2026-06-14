// Flat ESLint config (ESLint 10). Type-aware linting via typescript-eslint's
// recommendedTypeChecked tier — catches real bugs (floating promises, unsafe
// any, misused promises) without no-unnecessary-condition, which would flag the
// codebase's defensive optional chaining. Prettier owns formatting, so
// eslint-config-prettier (kept LAST) switches off any conflicting style rules.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      ".claude/**", // worktrees / job scratch
      ".clone/**", // nested checkout
      "scripts/**", // one-off tsx scripts, not in tsconfig
      "docs/**",
      "*.config.js", // this file
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Honor the `_name` throwaway convention for args, vars, and caught errors.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Errors (block the push). The few legitimately-intentional setState-in-
      // effect sites are the draft-timer effects, opted out with a documented
      // inline/file disable; everything else should be treated as a real bug.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
    },
  },
  {
    // Node-context files: add node globals.
    files: ["**/*.test.{ts,tsx}", "api/**", "vite.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Tests cast fixtures and fire-and-forget freely; the type-aware "unsafe"
    // and promise rules are noise here, so relax them for spec files only.
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
  prettier,
);
