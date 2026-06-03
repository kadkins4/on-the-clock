/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Formspree endpoint for the alpha suggestion box. Unset in local dev →
  // suggestions are stashed in localStorage instead (see SuggestionBox).
  readonly VITE_FORMSPREE_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
