import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/", "dashboard/dist/", "node_modules/", "dashboard/node_modules/"],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ["dashboard/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // cargar datos en un efecto y guardarlos con setState es justamente el diseño acá:
      // el proyecto no usa librería de fetching. La regla apunta a cascadas de renders
      // síncronas, que no es el caso cuando el setState pasa después de un await
      "react-hooks/set-state-in-effect": "off",
    },
  },

  {
    // un provider de contexto y su hook viven en el mismo archivo a propósito: es el patrón
    // habitual de React y separarlos solo para contentar a fast refresh no ayuda a nadie
    files: ["dashboard/src/lib/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },

  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      // supertest tipa res.body como any a propósito; pelearlo en cada assert es ruido
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },

  {
    files: ["eslint.config.js", "dashboard/vite.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,
);
