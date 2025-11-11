import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import ConnectWallet from "@/pages/connect-wallet";
import Dashboard from "@/pages/dashboard";
import DashboardLogin from "@/pages/dashboard-login";
import NotFound from "@/pages/not-found";
import { config } from './wagmi';
import '@rainbow-me/rainbowkit/styles.css';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/connect-wallet" component={ConnectWallet} />
      <Route path="/dashboard-login" component={DashboardLogin} />
      <Route path="/dashboard" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#3dd9b3',
            accentColorForeground: '#0a1614',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
        >
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
