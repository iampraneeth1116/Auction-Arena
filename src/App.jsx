import Logo from './components/ui/Logo';
import Tag from './components/ui/Tag';

function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-grid px-6 text-center">
      <Tag tone="signal">Coming soon</Tag>
      <Logo size="lg" />
      <p className="max-w-md text-mist">
        Run a live IPL auction with your friends. Claim a franchise, bid in real time and build the best squad.
      </p>
    </main>
  );
}

export default App;
