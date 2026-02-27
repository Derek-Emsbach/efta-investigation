import Link from 'next/link'

export function PublicFooter() {
  return (
    <footer className="border-t border-border-default bg-text-primary text-surface">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* About */}
          <div>
            <h3 className="font-display text-sm font-semibold mb-3">About</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              The Epstein Record is a systematic investigation of DOJ disclosures
              released under the Epstein Files Transparency Act.
            </p>
          </div>

          {/* Sections */}
          <div>
            <h3 className="font-display text-sm font-semibold mb-3">Sections</h3>
            <ul className="space-y-1.5 text-xs text-text-muted">
              <li><Link href="/stories" className="hover:text-surface transition-colors">Stories</Link></li>
              <li><Link href="/entities" className="hover:text-surface transition-colors">Entities</Link></li>
              <li><Link href="/case-files" className="hover:text-surface transition-colors">Case Files</Link></li>
              <li><Link href="/evidence" className="hover:text-surface transition-colors">Evidence Room</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-display text-sm font-semibold mb-3">Resources</h3>
            <ul className="space-y-1.5 text-xs text-text-muted">
              <li><Link href="/about" className="hover:text-surface transition-colors">Methodology</Link></li>
              <li><Link href="/about" className="hover:text-surface transition-colors">About This Project</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-display text-sm font-semibold mb-3">Legal</h3>
            <ul className="space-y-1.5 text-xs text-text-muted">
              <li><Link href="/disclaimer" className="hover:text-surface transition-colors">Disclaimer</Link></li>
              <li><Link href="/privacy" className="hover:text-surface transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-surface transition-colors">Terms of Use</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border-default pt-6 text-center text-xs text-text-muted">
          <p>
            All documents are publicly released government records. Analysis and presentation by Cyclops Digital LLC.
          </p>
          <p className="mt-1">
            Presence in this database does not imply guilt. All individuals are presumed innocent unless proven guilty in a court of law.
          </p>
        </div>
      </div>
    </footer>
  )
}
