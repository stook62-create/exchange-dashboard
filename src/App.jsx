import QuoteGrid from './components/QuoteGrid.jsx'

function App() {
  return (
    <div className="min-h-screen p-6 md:p-10">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
          交易所看板
        </h1>
        <p className="mt-2 text-slate-500">
          主要市场指数实时行情
        </p>
      </header>
      <main>
        <QuoteGrid />
      </main>
      <footer className="mt-10 text-sm text-slate-400">
        数据来自东方财富，延迟行情，仅供参考。
      </footer>
    </div>
  )
}

export default App
