import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Uniswap',
  projectId: 'e567c2ad31ee5e65d8ed972b0b289b76',
  chains: [mainnet, bsc, polygon, arbitrum, optimism, avalanche, base],
  ssr: false,
});
