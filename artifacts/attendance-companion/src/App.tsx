import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import { Attendance, Dashboard, Insights, Issues, Notifications, People, Profile, Requests, SettingsPage } from '@/pages/main-pages';
import { useGetCurrentUser } from '@workspace/api-client-react';
import {
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Authenticated({ children }: { children: (user: import('@workspace/api-client-react').CurrentUser) => ReactNode }) {
  const [, setLocation] = useLocation();
  const query = useGetCurrentUser();
  useEffect(() => {
    if (query.isError || (!query.isLoading && !query.data)) setLocation('/login');
  }, [query.isError, query.isLoading, query.data, setLocation]);
  if (query.isLoading) return <div className="min-h-[100dvh] bg-background p-8"><div className="mx-auto max-w-6xl animate-pulse space-y-5"><div className="h-10 w-48 rounded-xl bg-muted"/><div className="h-40 rounded-2xl bg-muted"/><div className="grid gap-4 sm:grid-cols-3"><div className="h-28 rounded-2xl bg-muted"/><div className="h-28 rounded-2xl bg-muted"/><div className="h-28 rounded-2xl bg-muted"/></div></div></div>;
  if (query.isError || !query.data) return null;
  return <>{children(query.data)}</>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/"><Authenticated>{(user) => <Dashboard user={user}/>}</Authenticated></Route>
        <Route path="/attendance"><Authenticated>{(user) => <Attendance user={user}/>}</Authenticated></Route>
        <Route path="/requests"><Authenticated>{(user) => <Requests user={user}/>}</Authenticated></Route>
        <Route path="/issues"><Authenticated>{(user) => <Issues user={user}/>}</Authenticated></Route>
        <Route path="/insights"><Authenticated>{(user) => <Insights user={user}/>}</Authenticated></Route>
        <Route path="/notifications"><Authenticated>{(user) => <Notifications user={user}/>}</Authenticated></Route>
        <Route path="/settings"><Authenticated>{(user) => <SettingsPage user={user}/>}</Authenticated></Route>
        <Route path="/people"><Authenticated>{(user) => <People user={user}/>}</Authenticated></Route>
        <Route path="/profile/:id"><Authenticated>{(user) => <Profile user={user}/>}</Authenticated></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
