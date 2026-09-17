// Ambient declaration — allows side-effect imports of CSS files (e.g. Tailwind globals)
declare module '*.css' {
  const styles: Record<string, string>
  export default styles
}

// Static asset imports — Vite resolves these to their public URL string
declare module '*.ico' {
  const url: string
  export default url
}

declare module '*.png' {
  const url: string
  export default url
}

declare module '*.svg' {
  const url: string
  export default url
}
