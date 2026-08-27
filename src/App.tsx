export default function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-3xl items-baseline justify-between px-5 py-5 sm:px-8">
          <span className="font-display text-lg font-semibold tracking-tight">
            Backpay
          </span>
          <span className="text-sm text-slate">
            Quotes, invoices, and the chase email
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-16 sm:px-8">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
          Paste your first client thread to see what you&rsquo;re owed.
        </h1>
        <p className="mt-4 max-w-lg text-slate">
          Backpay reads the conversation you already had and drafts the money
          paperwork from it &mdash; a quote, the scope, the invoices. You approve
          every line before anything leaves your hands.
        </p>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto w-full max-w-3xl px-5 py-5 text-sm text-slate sm:px-8">
          Nothing sends. Nothing charges. You click the real send button
          yourself.
        </div>
      </footer>
    </div>
  )
}
