import React from 'react'
import { renderToString } from 'react-dom/server'

// Mocking just enough of framer-motion and lucide-react to render
const motion = { div: (props: any) => <div {...props} /> }
const ShieldCheck = (p: any) => <svg data-icon="shield-check" {...p} />
const AlertTriangle = (p: any) => <svg data-icon="alert-triangle" {...p} />

const CategoryCard = ({ cat }: any) => {
  const pct = 100;
  return (
    <div>
      {/* Target UI blocks from the real component */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-2xs text-text-muted tabular-nums shrink-0">
          {cat.isCapped ? "5,000+ files" : `${cat.fileCount.toLocaleString()} files`}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 mt-1.5">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span className="text-2xs text-emerald-400">Safe to remove</span>
        </div>
        {cat.isCapped && (
          <span className="text-[10px] leading-tight text-amber-400/90 mt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Scan limit reached — actual space may be larger
          </span>
        )}
      </div>
    </div>
  )
}

const cat = {
  id: 'browser-cache',
  name: 'Browser Cache',
  fileCount: 5000,
  isCapped: true,
}

const html = renderToString(<CategoryCard cat={cat} />)

console.log('=== UI Rendering Test for Capped Scan ===')
console.log('Does it render "5,000+ files"?', html.includes('5,000+ files'))
console.log('Does it render "Scan limit reached"?', html.includes('Scan limit reached'))

console.log('\nFULL HTML:\n', html)

