import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import boundariesPlugin from "eslint-plugin-boundaries";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: {
      boundaries: boundariesPlugin,
    },
    rules: {
      // Reglas de TypeScript - relajadas para migración
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "warn",
      
      // Reglas de React
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      
      // Reglas generales de JavaScript
      "prefer-const": "warn",
      "no-console": "off",
      "no-debugger": "warn",
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-fallthrough": "warn",
      "no-irregular-whitespace": "warn",
      "no-unreachable": "warn",
      "no-useless-escape": "warn",

      // Límites de arquitectura
      "boundaries/dependencies": [2, {
        default: "disallow",
        policies: [
          { from: "components", allow: [["components"], ["hooks"], ["lib"], ["store"], ["types"]] },
          { from: "app/api", allow: [["lib"]] },
          { from: "lib", allow: [["lib"], ["types"]] },
          { from: "store", allow: [["lib"], ["types"], ["store"]] },
          { from: "hooks", allow: [["lib"]] },
          { from: "types", allow: [] },
        ],
      }],
    },
    settings: {
      "boundaries/elements": [
        { type: "components", pattern: "src/components/**/*" },
        { type: "app/api", pattern: "src/app/api/**/*" },
        { type: "lib", pattern: "src/lib/**/*" },
        { type: "store", pattern: "src/store/**/*" },
        { type: "hooks", pattern: "src/hooks/**/*" },
        { type: "types", pattern: "src/types/**/*" },
      ],
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
