import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Hourglass',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'c6c9bacd38281eb108ef8833053a1f92',
  chains: [mainnet],
  ssr: false,
});
